import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = { email: 'john@gmail.com', password: 'supersecret123' };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  function registerUser(body: object = { ...credentials, name: 'John' }) {
    return request(app.getHttpServer()).post('/auth/register').send(body);
  }

  describe('POST /auth/register', () => {
    it('should create the user and return a token', async () => {
      const res = await registerUser().expect(201);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        user: {
          id: expect.any(Number),
          email: 'john@gmail.com',
          name: 'John',
          createdAt: expect.any(String),
        },
      });
    });

    it('should store a hash, never the plain password', async () => {
      await registerUser().expect(201);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'john@gmail.com' },
        omit: { passwordHash: false },
      });
      expect(stored.passwordHash).toEqual(expect.any(String));
      expect(stored.passwordHash).not.toContain('supersecret123');
    });

    it('should return 409 when the email is already registered', async () => {
      await registerUser().expect(201);

      const res = await registerUser().expect(409);

      expect(res.body.message).toBe('Email john@gmail.com is already in use');
    });

    it.each([
      ['an invalid email', { email: 'not-an-email', password: 'supersecret123' }],
      ['a password shorter than 8 characters', { email: 'john@gmail.com', password: 'short' }],
      ['a missing password', { email: 'john@gmail.com' }],
      ['an unknown field', { ...credentials, role: 'admin' }],
    ])('should return 400 for %s', async (_label, body) => {
      await registerUser(body).expect(400);

      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await registerUser().expect(201);
    });

    it('should return a token for the correct password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'john@gmail.com', name: 'John' });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 for a wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...credentials, password: 'wrongpassword' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should return the same 401 for an unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...credentials, email: 'nobody@gmail.com' })
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should return 401 for a user created without a password', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'nopassword@gmail.com' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nopassword@gmail.com', password: 'anything123' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return the logged-in user for a valid token', async () => {
      const { body } = await registerUser().expect(201);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body).toEqual(body.user);
    });

    it('should return 401 without a token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);

      expect(res.body.message).toBe('Missing bearer token');
    });

    it('should return 401 for an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);

      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('should return 401 when the user was deleted after logging in', async () => {
      const { body } = await registerUser().expect(201);
      await request(app.getHttpServer()).delete(`/users/${body.user.id}`).expect(204);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(401);

      expect(res.body.message).toBe('User no longer exists');
    });
  });
});
