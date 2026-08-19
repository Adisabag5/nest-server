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
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './../src/auth/auth.controller';
import { AuthService } from './../src/auth/auth.service';
import { JwtStrategy } from './../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { UserController } from './../src/user/user.controller';
import { UserService } from './../src/user/user.service';
import { User } from './../src/user/entities/user.entity';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';

// An in-memory stand-in for Repository<User>: enough surface for the code
// under test, so the suite exercises the real HTTP pipeline without MySQL.
function createFakeUserRepo() {
  const rows: User[] = [];
  let nextId = 1;

  return {
    rows,
    find: () => Promise.resolve(rows),
    findOneBy: (where: Partial<User>) =>
      Promise.resolve(
        rows.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof User] === value,
          ),
        ) ?? null,
      ),
    create: (dto: Partial<User>) => Object.assign(new User(), dto),
    save: (user: User) => {
      if (!user.id) {
        user.id = String(nextId++);
        user.createdAt = new Date();
        rows.push(user);
      }
      return Promise.resolve(user);
    },
    delete: (id: string) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) return Promise.resolve({ affected: 0 });
      rows.splice(index, 1);
      return Promise.resolve({ affected: 1 });
    },
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const credentials = { email: 'adi@example.com', password: 'password123' };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController, UserController],
      providers: [
        AuthService,
        UserService,
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => TEST_SECRET } },
        { provide: getRepositoryToken(User), useValue: createFakeUserRepo() },
        // the same global guard the real app registers
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  const signup = () =>
    request(app.getHttpServer()).post('/auth/signup').send(credentials);

  describe('POST /auth/signup', () => {
    it('creates the account and returns a token', async () => {
      const response = await signup().expect(201);
      const body = response.body as { access_token: string; user: User };

      expect(typeof body.access_token).toBe('string');
      expect(body.user.email).toBe(credentials.email);
      // the interceptor must strip the hash even nested inside the response
      expect(JSON.stringify(body)).not.toContain('passwordHash');
    });

    it('rejects a duplicate email with 409', async () => {
      await signup().expect(201);
      await signup().expect(409);
    });

    it('rejects a weak password with 400 (CreateUserDto rules apply)', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'x@example.com', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/signin', () => {
    beforeEach(async () => {
      await signup().expect(201);
    });

    it('returns a token for correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send(credentials)
        .expect(200); // 200, not 201 — nothing was created

      const body = response.body as { access_token: string };
      expect(body.access_token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('answers 401 identically for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ ...credentials, password: 'wrong-password' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'nobody@example.com', password: credentials.password })
        .expect(401);

      // byte-identical: the route must not reveal which accounts exist
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });
  });

  describe('the global guard', () => {
    it('blocks a protected route without a token', () => {
      return request(app.getHttpServer()).get('/user').expect(401);
    });

    it('blocks a protected route with a garbage token', () => {
      return request(app.getHttpServer())
        .get('/user')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('allows a protected route with a valid token', async () => {
      const response = await signup().expect(201);
      const { access_token } = response.body as { access_token: string };

      const users = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(Array.isArray(users.body)).toBe(true);
      expect(JSON.stringify(users.body)).not.toContain('passwordHash');
    });

    it('lets @Public() routes through without a token', () => {
      // signin itself is public, or nobody could ever get a first token
      return request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: 'nobody@example.com', password: 'whatever' })
        .expect(401); // 401 from bad credentials, NOT from the guard
    });

    it('requires a token for signout', async () => {
      await request(app.getHttpServer()).post('/auth/signout').expect(401);

      const response = await signup().expect(201);
      const { access_token } = response.body as { access_token: string };

      await request(app.getHttpServer())
        .post('/auth/signout')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
    });
  });
});
