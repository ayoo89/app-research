import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compression = require('compression');
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Use structured JSON logger in production
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  // ── Static assets (product images) ─────────────────────────────
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/uploads' });

  // ── Middleware ──────────────────────────────────────────────────
  app.use(compression());
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

  // ── PostgreSQL extensions + performance indexes ─────────────────
  try {
    const ds = app.get(DataSource);
    await ds.query('CREATE EXTENSION IF NOT EXISTS vector');
    await ds.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    new Logger('Bootstrap').log('PostgreSQL extensions ready (vector, pg_trgm) ✓');

    // GIN index for full-text search — accelerates websearch_to_tsquery queries
    await ds.query(`
      CREATE INDEX IF NOT EXISTS products_fts_gin ON products USING gin(
        to_tsvector('simple',
          name || ' ' || COALESCE(brand,'') || ' ' || COALESCE("codeGold",'') || ' ' ||
          COALESCE(category,'') || ' ' || COALESCE(family,'') || ' ' || COALESCE(subcategory,'')
        )
      )
    `).catch((e: any) => new Logger('Bootstrap').warn(`FTS GIN index: ${e.message}`));

    // Trigram GIN index — accelerates LIKE and similarity() queries on product name
    await ds.query(`
      CREATE INDEX IF NOT EXISTS products_name_trgm ON products USING gin(lower(name) gin_trgm_ops)
    `).catch((e: any) => new Logger('Bootstrap').warn(`Trigram index: ${e.message}`));

    new Logger('Bootstrap').log('PostgreSQL performance indexes ensured ✓');
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
