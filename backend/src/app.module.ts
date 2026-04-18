import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { ProductModule } from './product/product.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ReindexModule } from './reindex/reindex.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    // ── PostgreSQL — production connection pool ──────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get('DB_HOST', 'localhost'),
        port:     cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USERNAME', 'postgres'),
        password: cfg.get('DB_PASSWORD', 'postgres'),
        database: cfg.get('DB_NAME', 'product_search'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') !== 'production',
        logging: cfg.get('NODE_ENV') === 'development' ? ['query', 'error'] : ['error'],
        // Connection pool — tune for your instance count
        extra: {
          max: cfg.get<number>('DB_POOL_MAX', 20),
          min: cfg.get<number>('DB_POOL_MIN', 2),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 10_000,  // kill queries > 10s
        },
        // Read replicas (set DB_REPLICA_HOST for read scaling)
        ...(cfg.get('DB_REPLICA_HOST') ? {
          replication: {
            master: {
              host: cfg.get('DB_HOST'),
              port: cfg.get<number>('DB_PORT', 5432),
              username: cfg.get('DB_USERNAME'),
              password: cfg.get('DB_PASSWORD'),
              database: cfg.get('DB_NAME'),
            },
            slaves: [{
              host: cfg.get('DB_REPLICA_HOST'),
              port: cfg.get<number>('DB_REPLICA_PORT', 5432),
              username: cfg.get('DB_USERNAME'),
              password: cfg.get('DB_PASSWORD'),
              database: cfg.get('DB_NAME'),
            }],
          },
        } : {}),
      }),
    }),

    // ── Bull — Redis queue with retry + dead-letter config ───────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host:     cfg.get('REDIS_HOST', 'localhost'),
          port:     cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASSWORD'),
          // Sentinel support for HA Redis
          ...(cfg.get('REDIS_SENTINEL_HOST') ? {
            sentinels: [{ host: cfg.get('REDIS_SENTINEL_HOST'), port: 26379 }],
            name: cfg.get('REDIS_SENTINEL_NAME', 'mymaster'),
          } : {}),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: false,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 1000 },  // keep last 1k completed
          removeOnFail: false,                 // keep failed for inspection
          timeout: 60_000,
        },
        settings: {
          stalledInterval: 30_000,
          maxStalledCount: 2,
        },
      }),
    }),

    CommonModule,
    AuthModule,
    UserModule,
    ProductModule,
    SearchModule,
    AdminModule,
    ReindexModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
