import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './create-test-app.js';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  function createUser(body: object) {
    return request(app.getHttpServer()).post('/users').send(body);
  }

  describe('POST /users', () => {
    it('should create a user', async () => {
      const res = await createUser({ email: 'john@gmail.com', name: 'John' }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(Number),
        email: 'john@gmail.com',
        name: 'John',
        createdAt: expect.any(String),
      });
    });

    it('should allow leaving out the name', async () => {
      const res = await createUser({ email: 'john@gmail.com' }).expect(201);

      expect(res.body.name).toBeNull();
    });

    it('should return 409 for a duplicate email', async () => {
      await createUser({ email: 'john@gmail.com' }).expect(201);

      const res = await createUser({ email: 'john@gmail.com' }).expect(409);

      expect(res.body.message).toBe('Email john@gmail.com is already in use');
    });

    it.each([
      ['an invalid email', { email: 'not-an-email' }],
      ['a missing email', { name: 'John' }],
      ['an empty name', { email: 'john@gmail.com', name: '' }],
      ['an unknown field', { email: 'john@gmail.com', role: 'admin' }],
    ])('should return 400 for %s', async (_label, body) => {
      await createUser(body).expect(400);
    });
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      for (const [email, name] of [
        ['alice@gmail.com', 'Alice'],
        ['bob@gmail.com', 'Bob'],
        ['carol@yahoo.com', 'Carol'],
      ]) {
        await createUser({ email, name }).expect(201);
      }
    });

    it('should return users in id order with pagination meta', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);

      expect(res.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice', 'Bob', 'Carol']);
      expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    });

    it('should return the requested page', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(res.body.data.map((u: { name: string }) => u.name)).toEqual(['Carol']);
      expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('should search email and name, ignoring case', async () => {
      const byName = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'ALICE' })
        .expect(200);
      expect(byName.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice']);

      const byEmail = await request(app.getHttpServer())
        .get('/users')
        .query({ search: 'gmail' })
        .expect(200);
      expect(byEmail.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice', 'Bob']);
      expect(byEmail.body.meta.total).toBe(2);
    });

    it.each([
      ['limit above 100', { limit: 101 }],
      ['page below 1', { page: 0 }],
      ['a non-numeric page', { page: 'abc' }],
    ])('should return 400 for %s', async (_label, query) => {
      await request(app.getHttpServer()).get('/users').query(query).expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('should return the user', async () => {
      const { body: created } = await createUser({ email: 'john@gmail.com' }).expect(201);

      const res = await request(app.getHttpServer()).get(`/users/${created.id}`).expect(200);

      expect(res.body).toEqual(created);
    });

    it('should never include the password hash', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'john@gmail.com', password: 'supersecret123' })
        .expect(201);

      const one = await request(app.getHttpServer()).get(`/users/${body.user.id}`).expect(200);
      const list = await request(app.getHttpServer()).get('/users').expect(200);

      expect(one.body).not.toHaveProperty('passwordHash');
      expect(list.body.data[0]).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for an unknown id', async () => {
      const res = await request(app.getHttpServer()).get('/users/999999').expect(404);

      expect(res.body.message).toBe('User with id 999999 not found');
    });

    it('should return 400 for a non-numeric id', async () => {
      await request(app.getHttpServer()).get('/users/abc').expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update the user', async () => {
      const { body: created } = await createUser({ email: 'john@gmail.com', name: 'John' }).expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/users/${created.id}`)
        .send({ name: 'Johnny' })
        .expect(200);

      expect(res.body).toEqual({ ...created, name: 'Johnny' });
    });

    it('should return 409 when changing to an email that is taken', async () => {
      await createUser({ email: 'taken@gmail.com' }).expect(201);
      const { body: created } = await createUser({ email: 'john@gmail.com' }).expect(201);

      await request(app.getHttpServer())
        .patch(`/users/${created.id}`)
        .send({ email: 'taken@gmail.com' })
        .expect(409);
    });

    it('should return 404 for an unknown id', async () => {
      await request(app.getHttpServer()).patch('/users/999999').send({ name: 'Johnny' }).expect(404);
    });

    it('should return 400 for an invalid email', async () => {
      const { body: created } = await createUser({ email: 'john@gmail.com' }).expect(201);

      await request(app.getHttpServer())
        .patch(`/users/${created.id}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete the user and return 204 with no body', async () => {
      const { body: created } = await createUser({ email: 'john@gmail.com' }).expect(201);

      const res = await request(app.getHttpServer()).delete(`/users/${created.id}`).expect(204);

      expect(res.body).toEqual({});
      await request(app.getHttpServer()).get(`/users/${created.id}`).expect(404);
    });

    it('should return 404 for an unknown id', async () => {
      await request(app.getHttpServer()).delete('/users/999999').expect(404);
    });
  });

  describe('GET /health', () => {
    it('should report the database as connected', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    });
  });
});
