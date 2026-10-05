import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Boots the real app (real controllers, validation and database) without listening on a port
export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
