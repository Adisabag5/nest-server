import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { signIn: jest.Mock; signup: jest.Mock; signOut: jest.Mock };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn().mockResolvedValue({ access_token: 't' }),
      signup: jest.fn().mockResolvedValue({ access_token: 't' }),
      signOut: jest.fn().mockReturnValue({ message: 'bye' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the credentials straight through to the service', async () => {
    await controller.signIn({ email: 'adi@example.com', password: 'pw' });

    // controllers stay thin: no logic here to test beyond the handoff
    expect(authService.signIn).toHaveBeenCalledWith('adi@example.com', 'pw');
  });

  it('passes the signup DTO through to the service', async () => {
    await controller.signup({
      email: 'adi@example.com',
      password: 'password123',
    });

    expect(authService.signup).toHaveBeenCalledWith({
      email: 'adi@example.com',
      password: 'password123',
    });
  });
});
