import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { ProfilesModule } from './../src/profiles/profiles.module';
import { Profile } from './../src/profiles/profiles.service';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProfilesModule],
      controllers: [AppController],
      providers: [AppService],
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

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/profiles (GET) returns the seeded profiles', async () => {
    const response = await request(app.getHttpServer())
      .get('/profiles')
      .expect(200);

    const profiles = response.body as Profile[];
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);
  });

  it('/profiles (POST) rejects a body that fails validation', () => {
    return request(app.getHttpServer()).post('/profiles').send({}).expect(400);
  });

  it('/profiles (POST) rejects unknown properties', () => {
    return request(app.getHttpServer())
      .post('/profiles')
      .send({ name: 'Ada', description: 'Engineer', role: 'admin' })
      .expect(400);
  });

  it('/profiles/:id (GET) is a 404 for an unknown id', () => {
    return request(app.getHttpServer())
      .get('/profiles/does-not-exist')
      .expect(404);
  });

  it('/profiles (POST then PUT) merges without letting the body rewrite the id', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/profiles')
      .send({ name: 'Ada', description: 'Engineer' })
      .expect(201);
    const created = createResponse.body as Profile;

    const updateResponse = await request(app.getHttpServer())
      .put(`/profiles/${created.id}`)
      .send({ name: 'Ada Lovelace' })
      .expect(200);

    expect(updateResponse.body).toEqual({
      id: created.id,
      name: 'Ada Lovelace',
      description: 'Engineer',
    });
  });
});
