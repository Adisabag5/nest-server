import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { REFRESH_COOKIE } from './cookies';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    signup: jest.Mock;
    signOut: jest.Mock;
    refresh: jest.Mock;
  };
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const session = () => ({
    access_token: 'access.jwt',
    refresh_token: 'refresh.jwt',
    refresh_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    user: Object.assign(new User(), { id: '1', email: 'adi@example.com' }),
  });

  beforeEach(async () => {
    authService = {
      signIn: jest.fn().mockResolvedValue(session()),
      signup: jest.fn().mockResolvedValue(session()),
      refresh: jest.fn().mockResolvedValue(session()),
      signOut: jest.fn().mockResolvedValue({ message: 'Signed out.' }),
    };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: { get: () => 'test' } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  const asResponse = () => res as unknown as Response;

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes credentials through and never returns the refresh token in the body', async () => {
    const body = await controller.signIn(
      { email: 'adi@example.com', password: 'pw' },
      asResponse(),
    );

    expect(authService.signIn).toHaveBeenCalledWith('adi@example.com', 'pw');
    expect(body.access_token).toBe('access.jwt');
    expect(JSON.stringify(body)).not.toContain('refresh.jwt');
  });

  it('sets the refresh token as an httpOnly cookie', async () => {
    await controller.signIn(
      { email: 'adi@example.com', password: 'pw' },
      asResponse(),
    );

    const [name, value, options] = res.cookie.mock.calls[0] as [
      string,
      string,
      { httpOnly: boolean; path: string },
    ];
    expect(name).toBe(REFRESH_COOKIE);
    expect(value).toBe('refresh.jwt');
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/auth');
  });

  it('refresh rotates using the token the guard put on the request', async () => {
    const req = { user: { id: '1', refreshToken: 'presented.jwt' } };

    await controller.refresh(
      req as unknown as Parameters<typeof controller.refresh>[0],
      asResponse(),
    );

    expect(authService.refresh).toHaveBeenCalledWith('presented.jwt');
    expect(res.cookie).toHaveBeenCalled();
  });

  it('signout revokes the session and clears the cookie', async () => {
    const req = { user: { id: '1', refreshToken: 'presented.jwt' } };

    await controller.signOut(
      req as unknown as Parameters<typeof controller.signOut>[0],
      asResponse(),
    );

    expect(authService.signOut).toHaveBeenCalledWith('presented.jwt');
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({ path: '/auth' }),
    );
  });
});
