import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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

  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Connected to database ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// "postgresql://user:secret@host:5432/db?schema=public" → "host:5432/db (user postgres)", never the password
export function describeDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    return '(DATABASE_URL is not set)';
  }
  try {
    const url = new URL(databaseUrl);
    const port = url.port || '5432';
    return `${url.hostname}:${port}${url.pathname} (user ${decodeURIComponent(url.username)})`;
  } catch {
    return '(DATABASE_URL is not a valid URL)';
  }
}
