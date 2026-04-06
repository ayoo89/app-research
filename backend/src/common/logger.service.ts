import { Injectable, LoggerService, Scope } from '@nestjs/common';

/**
 * Structured JSON logger — drop-in replacement for NestJS Logger.
 * Every log line is a JSON object with timestamp, level, context,
 * correlationId, and message. Pipe stdout to Loki / CloudWatch / Datadog.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context = 'App';
  private correlationId: string | undefined;

  setContext(ctx: string) { this.context = ctx; return this; }
  setCorrelationId(id: string) { this.correlationId = id; return this; }

  log(message: any, ...meta: any[])   { this.write('info',  message, meta); }
  error(message: any, ...meta: any[]) { this.write('error', message, meta); }
  warn(message: any, ...meta: any[])  { this.write('warn',  message, meta); }
  debug(message: any, ...meta: any[]) { this.write('debug', message, meta); }
  verbose(message: any, ...meta: any[]) { this.write('verbose', message, meta); }

  private write(level: string, message: any, meta: any[]) {
    const entry: Record<string, any> = {
      ts: new Date().toISOString(),
      level,
      context: this.context,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
    };
    if (this.correlationId) entry.correlationId = this.correlationId;
    if (meta.length) entry.meta = meta.length === 1 ? meta[0] : meta;
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
