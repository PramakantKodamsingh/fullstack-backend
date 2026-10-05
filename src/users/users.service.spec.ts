import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock: any = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  const existingUser = {
    id: 1,
    name: 'John',
    email: 'john@gmail.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const uniqueEmailError = new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed',
    {
      code: 'P2002',
      clientVersion: '6.0.0',
    },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaMock as any);
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto = {
        name: 'John',
        email: 'john@gmail.com',
      };

      const createdUser = {
        id: 1,
        name: 'John',
        email: 'john@gmail.com',
      };

      prismaMock.user.create.mockResolvedValue(createdUser);

      const result = await service.create(dto);

      expect(result).toEqual(createdUser);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: dto,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      const dto = {
        name: 'John',
        email: 'john@gmail.com',
      };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
        },
      );

      prismaMock.user.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException(
          'Email john@gmail.com is already in use',
        ),
      );
    });

    it('should rethrow errors that are not a duplicate email', async () => {
      const dbError = new Error('Connection lost');

      prismaMock.user.create.mockRejectedValue(dbError);

      await expect(
        service.create({ email: 'john@gmail.com' }),
      ).rejects.toBe(dbError);
    });
  });

  describe('findAll', () => {
    it('should return users with pagination meta', async () => {
      prismaMock.$transaction.mockResolvedValue([[existingUser], 25]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({
        data: [existingUser],
        meta: { page: 1, limit: 10, total: 25, totalPages: 3 },
      });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
      expect(prismaMock.user.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should skip users from earlier pages', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 25]);

      await service.findAll({ page: 3, limit: 10 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should filter by email or name when search is given', async () => {
      prismaMock.$transaction.mockResolvedValue([[existingUser], 1]);

      await service.findAll({ page: 1, limit: 10, search: 'john' });

      const where = {
        OR: [
          { email: { contains: 'john', mode: 'insensitive' } },
          { name: { contains: 'john', mode: 'insensitive' } },
        ],
      };

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prismaMock.user.count).toHaveBeenCalledWith({ where });
    });

    it('should return 0 total pages when there are no users', async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });
  });

  describe('findOne', () => {
    it('should return the user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.findOne(1);

      expect(result).toEqual(existingUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(
        new NotFoundException('User with id 99 not found'),
      );
    });
  });

  describe('update', () => {
    it('should update the user', async () => {
      const dto = { name: 'Johnny' };
      const updatedUser = { ...existingUser, name: 'Johnny' };

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(1, dto);

      expect(result).toEqual(updatedUser);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('should throw NotFoundException and not update when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.update(99, { name: 'Johnny' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the new email is already in use', async () => {
      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockRejectedValue(uniqueEmailError);

      await expect(
        service.update(1, { email: 'taken@gmail.com' }),
      ).rejects.toThrow(
        new ConflictException('Email taken@gmail.com is already in use'),
      );
    });

    it('should rethrow errors that are not a duplicate email', async () => {
      const dbError = new Error('Connection lost');

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockRejectedValue(dbError);

      await expect(service.update(1, { name: 'Johnny' })).rejects.toBe(dbError);
    });
  });

  describe('remove', () => {
    it('should delete the user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.delete.mockResolvedValue(existingUser);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException and not delete when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
    });
  });
});