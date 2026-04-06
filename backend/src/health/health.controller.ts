import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../search/cache.module';

@ApiTags('observability')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + readiness check' })
  async check() {
    const checks = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);

    const db    = checks[0].status === 'fulfilled';
    const cache = checks[1].status === 'fulfilled';
    const ok    = db && cache;

    return {
      status:    ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: db    ? 'ok' : 'error',
        redis:    cache ? 'ok' : 'error',
      },
    };
  }
}
