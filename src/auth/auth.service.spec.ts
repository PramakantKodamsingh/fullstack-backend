import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';
import { hashPassword, verifyPassword } from './password.js';

describe('AuthService', () => {
  let service: AuthService;
  let storedHash: string;

  const prismaMock: any = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const jwtMock: any = {
    signAsync: jest.fn(),
  };

  const user = {
    id: 1,
    name: 'John',
    email: 'john@gmail.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeAll(async () => {
    storedHash = await hashPassword('supersecret123');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwtMock.signAsync.mockResolvedValue('signed-token');
    service = new AuthService(prismaMock, jwtMock);
  });

  describe('register', () => {
    const dto = { email: 'john@gmail.com', password: 'supersecret123', name: 'John' };

    it('should create the user and return a token', async () => {
      prismaMock.user.create.mockResolvedValue(user);

      const result = await service.register(dto);

      expect(result).toEqual({ accessToken: 'signed-token', user });
      expect(jwtMock.signAsync).toHaveBeenCalledWith({ sub: 1, email: 'john@gmail.com' });
    });

    it('should store a hash of the password, not the password itself', async () => {
      prismaMock.user.create.mockResolvedValue(user);

      await service.register(dto);

      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data).toEqual({
        email: 'john@gmail.com',
        name: 'John',
        passwordHash: expect.any(String),
      });
      expect(data.passwordHash).not.toContain('supersecret123');
      await expect(verifyPassword('supersecret123', data.passwordHash)).resolves.toBe(true);
    });

    it('should throw ConflictException when the email is already in use', async () => {
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('Email john@gmail.com is already in use'),
      );
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('should rethrow errors that are not a duplicate email', async () => {
      const dbError = new Error('Connection lost');
      prismaMock.user.create.mockRejectedValue(dbError);

      await expect(service.register(dto)).rejects.toBe(dbError);
    });
  });

  describe('login', () => {
    it('should return a token and the user without the password hash', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash: storedHash });

      const result = await service.login({ email: 'john@gmail.com', password: 'supersecret123' });

      expect(result).toEqual({ accessToken: 'signed-token', user });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should ask Prisma to include the password hash', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash: storedHash });

      await service.login({ email: 'john@gmail.com', password: 'supersecret123' });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@gmail.com' },
        omit: { passwordHash: false },
      });
    });

    it('should throw UnauthorizedException for a wrong password', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash: storedHash });

      await expect(
        service.login({ email: 'john@gmail.com', password: 'wrongpassword' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

    it('should throw the same error when the email is not registered', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@gmail.com', password: 'supersecret123' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('should reject users that have no password set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash: null });

      await expect(
        service.login({ email: 'john@gmail.com', password: 'supersecret123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('should return the user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);

      await expect(service.me(1)).resolves.toEqual(user);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw UnauthorizedException when the user was deleted', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.me(1)).rejects.toThrow(
        new UnauthorizedException('User no longer exists'),
      );
    });
  });
});
