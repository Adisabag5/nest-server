import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token';
import { Role } from './enums/roles.enum';

const PASSWORD = 'password123';

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'did not throw';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('AuthService', () => {
  let service: AuthService;
  let userService: { findByEmail: jest.Mock; create: jest.Mock };
  let rows: RefreshToken[];
  let storedUser: User;

  beforeAll(async () => {
    storedUser = Object.assign(new User(), {
      id: '1',
      email: 'adi@example.com',
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: Role.USER,
      createdAt: new Date(),
    });
  });

  function fakeRefreshRepo() {
    let nextId = 1;
    return {
      create: (dto: Partial<RefreshToken>) =>
        Object.assign(new RefreshToken(), dto),
      save: (row: RefreshToken) => {
        if (!row.id) {
          row.id = String(nextId++);
          rows.push(row);
        }
        return Promise.resolve(row);
      },
      findOne: ({ where }: { where: { tokenHash: string } }) => {
        const row = rows.find((r) => r.tokenHash === where.tokenHash) ?? null;
        if (row) row.user = storedUser;
        return Promise.resolve(row);
      },
      findOneBy: (where: { tokenHash: string }) =>
        Promise.resolve(
          rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
        ),
      update: (
        where: { userId: string },
        patch: Partial<RefreshToken>,
      ): Promise<unknown> => {
        rows
          .filter((r) => r.userId === where.userId && r.revokedAt === null)
          .forEach((r) => Object.assign(r, patch));
        return Promise.resolve({ affected: rows.length });
      },
      delete: () => Promise.resolve({ affected: 0 }),
    };
  }

  let jwtSignCalls: () => Record<string, unknown>[];

  beforeEach(async () => {
    rows = [];
    userService = { findByEmail: jest.fn(), create: jest.fn() };

    let tokenCounter = 0;
    const jwtService = {
      signAsync: jest.fn((payload: Record<string, unknown>): Promise<string> =>
        Promise.resolve(`token-${++tokenCounter}-${String(payload.sub)}`),
      ),
      decode: jest.fn(() => ({
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      })),
    };

    jwtSignCalls = () => jwtService.signAsync.mock.calls.map((call) => call[0]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => `config-${key}` },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: fakeRefreshRepo(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    it('issues both tokens and records the session', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);

      const session = await service.signIn('adi@example.com', PASSWORD);

      expect(session.access_token).toBeDefined();
      expect(session.refresh_token).toBeDefined();
      expect(session.access_token).not.toBe(session.refresh_token);
      expect(jwtSignCalls()[0]).toMatchObject({
        sub: '1',
        email: 'adi@example.com',
        role: Role.USER,
      });
      expect(rows).toHaveLength(1);
    });

    it('stores only a hash of the refresh token, never the token', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);

      const session = await service.signIn('adi@example.com', PASSWORD);

      expect(rows[0].tokenHash).not.toBe(session.refresh_token);
      expect(rows[0].tokenHash).toHaveLength(64);
    });

    it('rejects a wrong password with 401', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.signIn('adi@example.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('gives the SAME message for unknown email and wrong password', async () => {
      userService.findByEmail.mockResolvedValueOnce(null);
      const unknownEmail = await messageOf(
        service.signIn('nobody@example.com', PASSWORD),
      );

      userService.findByEmail.mockResolvedValueOnce(storedUser);
      const wrongPassword = await messageOf(
        service.signIn('adi@example.com', 'wrong'),
      );

      expect(unknownEmail).toBe(wrongPassword);
    });
  });

  describe('signup', () => {
    it('delegates to UserService and starts a session', async () => {
      userService.create.mockResolvedValue(storedUser);

      const session = await service.signup({
        email: 'adi@example.com',
        password: PASSWORD,
      });

      expect(userService.create).toHaveBeenCalled();
      expect(session.refresh_token).toBeDefined();
      expect(rows).toHaveLength(1);
    });

    it('propagates the duplicate-email 409', async () => {
      userService.create.mockRejectedValue(new ConflictException());

      await expect(
        service.signup({ email: 'adi@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('refresh', () => {
    const signIn = async () => {
      userService.findByEmail.mockResolvedValue(storedUser);
      return service.signIn('adi@example.com', PASSWORD);
    };

    it('rotates: the old token is revoked and a new one issued', async () => {
      const first = await signIn();

      const second = await service.refresh(first.refresh_token);

      expect(second.refresh_token).not.toBe(first.refresh_token);
      expect(rows).toHaveLength(2);
      expect(rows[0].revokedAt).not.toBeNull();
      expect(rows[1].revokedAt).toBeNull();
    });

    it('rejects a token it never issued', async () => {
      await expect(service.refresh('never-issued')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired session', async () => {
      const session = await signIn();
      rows[0].expiresAt = new Date(Date.now() - 1000);

      await expect(
        service.refresh(session.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('treats replay of a rotated token as theft and kills every session', async () => {
      const first = await signIn();
      await service.refresh(first.refresh_token);
      await signIn();

      expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(2);

      await expect(service.refresh(first.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(0);
    });
  });

  describe('signOut', () => {
    it('revokes only the presented session', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);
      const phone = await service.signIn('adi@example.com', PASSWORD);
      const laptop = await service.signIn('adi@example.com', PASSWORD);

      await service.signOut(phone.refresh_token);

      const live = rows.filter((r) => r.revokedAt === null);
      expect(live).toHaveLength(1);
      expect(live[0].tokenHash).not.toBe(rows[0].tokenHash);
      expect(laptop.refresh_token).toBeDefined();
    });

    it('a retry after signout is rejected without killing other sessions', async () => {
      userService.findByEmail.mockResolvedValue(storedUser);
      const phone = await service.signIn('adi@example.com', PASSWORD);
      await service.signIn('adi@example.com', PASSWORD);

      await service.signOut(phone.refresh_token);

      await expect(service.refresh(phone.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    });

    it('reports success even for an unknown token', async () => {
      await expect(service.signOut('nonsense')).resolves.toEqual({
        message: expect.stringContaining('Signed out') as string,
      });
    });
  });
});
