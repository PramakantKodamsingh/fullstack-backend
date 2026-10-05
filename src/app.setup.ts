import { INestApplication, ValidationPipe } from '@nestjs/common';

// Request handling shared by main.ts and the e2e tests, so tests exercise the same app that runs
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  });
}
