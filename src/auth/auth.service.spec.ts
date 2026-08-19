import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  const PASSWORD = 'password123';
  let storedUser: User;

  beforeAll(async () => {
    storedUser = Object.assign(new User(), {
      id: '1',
      email: 'adi@example.com',
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      createdAt: new Date(),
    });
  });

  beforeEach(async () => {
    userService = { findByEmail: jest.fn(), create: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    it('returns a token for correct credentials', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);

      const result = await service.signIn('adi@example.com', PASSWORD);

      expect(result.access_token).toBe('signed.jwt.token');
      // the payload identifies the user by the standard `sub` claim...
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '1',
        email: 'adi@example.com',
      });
      // ...and never carries the hash
      expect(JSON.stringify(jwtService.signAsync.mock.calls)).not.toContain(
        storedUser.passwordHash,
      );
    });

    it('rejects a wrong password with 401', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.signIn('adi@example.com', 'not-the-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with 401', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.signIn('nobody@example.com', PASSWORD),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('gives the SAME message for unknown email and wrong password', async () => {
      userService.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = await service
        .signIn('nobody@example.com', PASSWORD)
        .catch((error: UnauthorizedException) => error);

      userService.findByEmail.mockResolvedValueOnce(storedUser);
      const wrongPassword = await service
        .signIn('adi@example.com', 'wrong')
        .catch((error: UnauthorizedException) => error);

      // distinguishable errors here would leak which accounts exist
      expect((unknownEmail as UnauthorizedException).message).toBe(
        (wrongPassword as UnauthorizedException).message,
      );
    });

    it('never compares the plain password against the stored hash', async () => {
      // the hash itself must not work as a password
      userService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.signIn('adi@example.com', storedUser.passwordHash),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signup', () => {
    it('delegates account creation to UserService and returns a token', async () => {
      userService.create.mockResolvedValue(storedUser);

      const result = await service.signup({
        email: 'adi@example.com',
        password: PASSWORD,
      });

      expect(userService.create).toHaveBeenCalledWith({
        email: 'adi@example.com',
        password: PASSWORD,
      });
      expect(result.access_token).toBe('signed.jwt.token');
    });

    it('propagates the duplicate-email 409 from UserService', async () => {
      userService.create.mockRejectedValue(new ConflictException());

      await expect(
        service.signup({ email: 'adi@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('signOut', () => {
    it('returns a message without touching the token store', () => {
      expect(service.signOut()).toEqual({
        message: expect.stringContaining('discard') as string,
      });
    });
  });
});
