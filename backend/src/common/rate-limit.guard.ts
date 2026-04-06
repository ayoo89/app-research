import {
  Injectable, CanActivate, ExecutionContext,
  HttpException, HttpStatus, Inject, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../search/cache.module';

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSec: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';

/** Decorator: @RateLimit({ limit: 60, windowSec: 60 }) */
export const RateLimit = (opts: RateLimitOptions) =>
  (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, opts, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, ctx.getHandler());
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest();
    // Respect X-Forwarded-For when behind nginx/load balancer
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null)
      ?? req.ip
      ?? req.connection?.remoteAddress
      ?? 'unknown';
    const key = `rl:${ctx.getClass().name}:${ctx.getHandler().name}:${ip}`;

    const current = await this.redis.incr(key);
    if (current === 1) await this.redis.expire(key, opts.windowSec);

    if (current > opts.limit) {
      this.logger.warn(`Rate limit exceeded: ${ip} on ${req.path}`);
      throw new HttpException(
        { message: 'Too many requests', retryAfter: opts.windowSec },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
