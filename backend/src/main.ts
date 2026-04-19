import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Use structured JSON logger in production
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // ── Middleware ──────────────────────────────────────────────────
  app.use(new CorrelationIdMiddleware().use.bind(new CorrelationIdMiddleware()));

  // ── Global config ───────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Swagger ─────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Product Search API')
      .setDescription('Hybrid product search: barcode, image, text')
      .setVersion('2.0')
      .addBearerAuth()
      .addTag('search')
      .addTag('products')
      .addTag('auth')
      .addTag('admin')
      .addTag('observability')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  // ── Graceful shutdown ───────────────────────────────────────────
  app.enableShutdownHooks();

  // ── PostgreSQL extensions ───────────────────────────────────────
  try {
    const ds = app.get(DataSource);
    await ds.query('CREATE EXTENSION IF NOT EXISTS vector');
    await ds.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    new Logger('Bootstrap').log('PostgreSQL extensions ready (vector, pg_trgm) ✓');
  } catch (e) {
    new Logger('Bootstrap').warn(`PostgreSQL extensions setup: ${e.message}`);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API running on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
