import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler, Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class SearchMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SearchMetrics');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap((response) => {
        const ms = Date.now() - start;
        const meta = response?.meta;

        this.logger.log(
          JSON.stringify({
            path: req.path,
            method: req.method,
            latencyMs: ms,
            cacheHit: meta?.cacheHit ?? false,
            resultCount: response?.results?.length ?? 0,
            matchMethods: meta?.methods ?? [],
            // Warn if we're approaching the 1s SLA
            slowQuery: ms > 800,
          }),
        );

        if (ms > 1000) {
          this.logger.warn(`Slow search: ${ms}ms — consider tuning KNN num_candidates or Redis TTL`);
        }
      }),
    );
  }
}
