import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const client = redisUrl
          ? new Redis(redisUrl, {
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
            })
          : new Redis({
              host:     config.get('REDIS_HOST', 'localhost'),
              port:     config.get<number>('REDIS_PORT', 6379),
              password: config.get('REDIS_PASSWORD'),
              tls: config.get('REDIS_TLS') === 'true' ? { rejectUnauthorized: false } : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            });
        client.on('error', (err) =>
          new Logger('RedisClient').error(`Redis error: ${err.message}`),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule {}
