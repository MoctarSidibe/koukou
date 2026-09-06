import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) non authentifié -> 401 (JwtAuthGuard global)', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/auth/register (POST) est public', () => {
    const phone = `+24160${Date.now()}`;
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        phone,
        fullName: 'Test E2E',
        code: 'secret123',
      })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });
});
