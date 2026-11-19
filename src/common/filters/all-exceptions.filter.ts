import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** getStatus() returns a number, so compare against one. */
const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** The shape every error response has, whatever went wrong. */
export interface ErrorBody {
  statusCode: number;
  /**
   * Kept as-is from the exception — a string, or the array class-validator
   * produces. The frontend reads this field to explain a 400 to the person, so
   * replacing it with a tidier shape would silently blank those messages.
   */
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

/**
 * One shape for every error, and one place that decides what leaves the
 * building.
 *
 * Anything that is not an HttpException is a bug, not a refusal: it becomes a
 * flat 500 whose body says nothing, while the real error and its stack go to
 * the log. A TypeORM QueryFailedError, for instance, carries SQL and column
 * names — useful to us, a free schema tour for anyone else.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorBody = {
      statusCode: status,
      message: messageFrom(exception, status),
      error: nameFor(exception, status),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // 5xx is ours to fix, so it gets a stack. 4xx is the client being told no,
    // which is routine and would only drown the log.
    if (status >= SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }
}

/**
 * HttpException bodies come in two shapes: a bare string, or an object with
 * `message` (which ValidationPipe fills with an array).
 */
function messageFrom(exception: unknown, status: number): string | string[] {
  if (!(exception instanceof HttpException)) return 'Internal server error';

  const payload = exception.getResponse();

  if (typeof payload === 'string') return payload;

  const message = (payload as { message?: unknown }).message;

  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.map(String);

  return defaultReason(status);
}

function nameFor(exception: unknown, status: number): string {
  if (!(exception instanceof HttpException)) return 'Internal Server Error';

  const payload = exception.getResponse();

  if (typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }

  return defaultReason(status);
}

/**
 * HttpStatus[404] is 'NOT_FOUND', but Nest's own exceptions carry 'Not Found'.
 * Title-casing here keeps one spelling across every response — otherwise the
 * reason reads differently depending on which layer refused, which is exactly
 * the inconsistency this filter exists to remove.
 */
function defaultReason(status: number): string {
  const name = HttpStatus[status] as string | undefined;
  if (name === undefined) return 'Error';

  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
