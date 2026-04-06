import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx  = host.switchToHttp();
    const req  = ctx.getRequest<Request>();
    const res  = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    const correlationId = req['correlationId'];

    this.logger.error(
      JSON.stringify({
        correlationId,
        status,
        method: req.method,
        path: req.url,
        message,
        stack: exception instanceof Error ? exception.stack?.split('\n').slice(0, 5) : undefined,
      }),
    );

    res.status(status).json({
      statusCode: status,
      correlationId,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
