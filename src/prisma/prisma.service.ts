import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

// Never return password hashes unless a query opts back in with `omit: { passwordHash: false }`
const prismaOptions = {
  omit: { user: { passwordHash: true } },
} as const satisfies Prisma.PrismaClientOptions;

@Injectable()
export class PrismaService
  extends PrismaClient<typeof prismaOptions>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(prismaOptions);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
