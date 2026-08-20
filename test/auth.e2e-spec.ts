import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './../src/auth/auth.controller';
import { AuthService } from './../src/auth/auth.service';
import { JwtStrategy } from './../src/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from './../src/auth/strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RefreshToken } from './../src/auth/entities/refresh-token';
import { UserController } from './../src/user/user.controller';
import { UserService } from './../src/user/user.service';
import { User } from './../src/user/entities/user.entity';
import { Role } from './../src/auth/enums/roles.enum';
import { DataSource } from 'typeorm';
import { ProfileService } from './../src/profile/profile.service';
import { Profile } from './../src/profile/entities/profile.entity';

const ACCESS_SECRET = 'access-secret-at-least-32-characters!!!';
const REFRESH_SECRET = 'refresh-secret-at-least-32-characters!!';

const TEST_CONFIG: Record<string, string> = {
  JWT_SECRET: ACCESS_SECRET,
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: '7d',
  NODE_ENV: 'test',
};

function createFakes() {
  const users: User[] = [];
  const sessions: RefreshToken[] = [];
  const profiles: Profile[] = [];
  let nextUserId = 1;
  let nextSessionId = 1;
  let nextProfileId = 1;

  const match = <T extends object>(row: T, where: Partial<T>) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof T] === value,
    );

  const userRepo = {
    find: () => Promise.resolve(users),
    findOneBy: (where: Partial<User>) =>
      Promise.resolve(users.find((u) => match(u, where)) ?? null),
    create: (dto: Partial<User>) => Object.assign(new User(), dto),
    save: (user: User) => {
      if (!user.id) {
        user.id = String(nextUserId++);
        user.createdAt = new Date();
        users.push(user);
      }
      return Promise.resolve(user);
    },
    delete: (id: string) => {
      const i = users.findIndex((u) => u.id === id);
      if (i === -1) return Promise.resolve({ affected: 0 });
      users.splice(i, 1);
      return Promise.resolve({ affected: 1 });
    },
  };

  const refreshRepo = {
    create: (dto: Partial<RefreshToken>) =>
      Object.assign(new RefreshToken(), dto),
    save: (row: RefreshToken) => {
      if (!row.id) {
        row.id = String(nextSessionId++);
        sessions.push(row);
      }
      return Promise.resolve(row);
    },
    findOne: ({ where }: { where: Partial<RefreshToken> }) => {
      const row = sessions.find((s) => match(s, where)) ?? null;
      if (row) row.user = users.find((u) => u.id === row.userId)!;
      return Promise.resolve(row);
    },
    findOneBy: (where: Partial<RefreshToken>) =>
      Promise.resolve(sessions.find((s) => match(s, where)) ?? null),
    update: (where: { userId: string }, patch: Partial<RefreshToken>) => {
      sessions
        .filter((s) => s.userId === where.userId && s.revokedAt === null)
        .forEach((s) => Object.assign(s, patch));
      return Promise.resolve({ affected: sessions.length });
    },
    delete: () => Promise.resolve({ affected: 0 }),
  };

  const profileRepo = {
    findOneBy: (where: Partial<Profile>) =>
      Promise.resolve(profiles.find((p) => match(p, where)) ?? null),
    create: (dto: Partial<Profile>) => Object.assign(new Profile(), dto),
    save: (row: Profile) => {
      if (!row.id) {
        row.id = String(nextProfileId++);
        profiles.push(row);
      }
      return Promise.resolve(row);
    },
  };

  // UserService.create() runs inside a transaction; this stands in for the
  // EntityManager it hands to ProfileService
  const manager = {
    findOneBy: (_entity: unknown, where: Partial<Profile>) =>
      Promise.resolve(profiles.find((p) => match(p, where)) ?? null),
    create: (_entity: unknown, dto: Partial<User & Profile>) =>
      dto.email !== undefined
        ? Object.assign(new User(), dto)
        : Object.assign(new Profile(), dto),
    save: (row: User | Profile) => {
      if (row instanceof User) return userRepo.save(row);
      return profileRepo.save(row);
    },
  };

  const dataSource = {
    transaction: (cb: (m: unknown) => unknown) => cb(manager),
  };

  return { userRepo, refreshRepo, profileRepo, dataSource, sessions, profiles };
}

describe('Auth + refresh (e2e)', () => {
  let app: INestApplication<App>;
  let fakes: ReturnType<typeof createFakes>;

  const credentials = { email: 'adi@example.com', password: 'password123' };

  beforeEach(async () => {
    fakes = createFakes();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: ACCESS_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController, UserController],
      providers: [
        AuthService,
        UserService,
        JwtStrategy,
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => TEST_CONFIG[key] },
        },
        { provide: getRepositoryToken(User), useValue: fakes.userRepo },
        { provide: getRepositoryToken(Profile), useValue: fakes.profileRepo },
        ProfileService,
        { provide: DataSource, useValue: fakes.dataSource },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: fakes.refreshRepo,
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const cookiesFrom = (res: request.Response): string[] => {
    const header = res.headers['set-cookie'];
    return Array.isArray(header) ? header : header ? [header] : [];
  };
  const refreshCookie = (res: request.Response): string =>
    cookiesFrom(res)
      .find((c) => c.startsWith('refresh_token='))!
      .split(';')[0];

  const signup = () =>
    request(app.getHttpServer()).post('/auth/signup').send(credentials);
  const signin = () =>
    request(app.getHttpServer()).post('/auth/signin').send(credentials);

  describe('signup / signin', () => {
    it('returns an access token in the body and the refresh token as an httpOnly cookie', async () => {
      const response = await signup().expect(201);
      const body = response.body as { access_token: string; user: User };

      expect(typeof body.access_token).toBe('string');
      expect(body.user.role).toBe(Role.USER);
      expect(JSON.stringify(body)).not.toContain('passwordHash');

      const cookie = cookiesFrom(response).find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/auth');
      expect(JSON.stringify(body)).not.toContain('refresh_token');
    });

    it('creates the profile alongside the user', async () => {
      await signup().expect(201);

      expect(fakes.profiles).toHaveLength(1);
      expect(fakes.profiles[0].username).toBe('adi');
      expect(fakes.profiles[0].userId).toBe('1');
    });

    it('rejects a duplicate email with 409', async () => {
      await signup().expect(201);
      await signup().expect(409);
    });

    it('refuses a client-supplied role', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ ...credentials, role: Role.ADMIN })
        .expect(400);
    });

    it('answers 401 identically for a wrong password and an unknown email', async () => {
      await signup().expect(201);

      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ ...credentials, password: 'nope-wrong' })
        .expect(401);
      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'ghost@example.com', password: credentials.password })
        .expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });
  });

  describe('POST /auth/refresh', () => {
    it('exchanges the cookie for a new access token', async () => {
      const first = await signup().expect(201);

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(first))
        .expect(200);

      const body = refreshed.body as { access_token: string };
      expect(body.access_token.split('.')).toHaveLength(3);
      expect(refreshCookie(refreshed)).not.toBe(refreshCookie(first));
    });

    it('401s with no cookie at all', () => {
      return request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('401s for a token signed with the ACCESS secret', async () => {
      const response = await signup().expect(201);
      const { access_token } = response.body as { access_token: string };

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${access_token}`)
        .expect(401);
    });

    it('kills every session when a rotated token is replayed', async () => {
      const first = await signup().expect(201);
      const stale = refreshCookie(first);

      const rotated = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', stale)
        .expect(200);
      const current = refreshCookie(rotated);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', stale)
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', current)
        .expect(401);
    });
  });

  describe('POST /auth/signout', () => {
    it('revokes the session, so its cookie can no longer refresh', async () => {
      const session = await signup().expect(201);
      const cookie = refreshCookie(session);

      await request(app.getHttpServer())
        .post('/auth/signout')
        .set('Cookie', cookie)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('leaves other devices signed in', async () => {
      const phone = await signup().expect(201);
      const laptop = await signin().expect(200);

      await request(app.getHttpServer())
        .post('/auth/signout')
        .set('Cookie', refreshCookie(phone))
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(laptop))
        .expect(200);
    });

    it('a stale client retrying after signout does NOT kill other devices', async () => {
      const phone = await signup().expect(201);
      const laptop = await signin().expect(200);

      await request(app.getHttpServer())
        .post('/auth/signout')
        .set('Cookie', refreshCookie(phone))
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(phone))
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(laptop))
        .expect(200);
    });

    it('clears the cookie in the response', async () => {
      const session = await signup().expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/signout')
        .set('Cookie', refreshCookie(session))
        .expect(200);

      const cleared = cookiesFrom(response).find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(cleared).toContain('refresh_token=;');
    });

    it('401s without a cookie', () => {
      return request(app.getHttpServer()).post('/auth/signout').expect(401);
    });
  });

  describe('the access token still guards the API', () => {
    it('blocks without a token and allows with one', async () => {
      await request(app.getHttpServer()).get('/user').expect(401);

      const response = await signup().expect(201);
      const { access_token } = response.body as { access_token: string };

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
    });

    it('accepts the access token issued by a refresh', async () => {
      const first = await signup().expect(201);

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie(first))
        .expect(200);
      const { access_token } = refreshed.body as { access_token: string };

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
    });
  });
});
