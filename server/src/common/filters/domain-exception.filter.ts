import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConflictError } from '../errors/conflict.error.js';
import { DomainError } from '../errors/domain-error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { ValidationError } from '../errors/validation.error.js';

/** The single place a domain concept becomes an HTTP status code (CLAUDE.md). */
const DOMAIN_ERROR_STATUSES: ReadonlyArray<readonly [new (...args: never[]) => DomainError, HttpStatus]> = [
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ValidationError, HttpStatus.BAD_REQUEST],
  [ConflictError, HttpStatus.CONFLICT],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [UnauthorizedError, HttpStatus.UNAUTHORIZED],
];

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  };
  requestId: string | undefined;
  path: string;
}

/**
 * Turns every thrown thing into one response shape, so the web app has exactly one error
 * contract to parse. Services throw domain errors and stay unaware that HTTP exists.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { status, body } = this.describe(exception, request);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { requestId: request.requestId, path: request.originalUrl, err: exception },
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown, request: Request): { status: HttpStatus; body: ErrorBody } {
    const base = { requestId: request.requestId, path: request.originalUrl };

    if (exception instanceof DomainError) {
      const match = DOMAIN_ERROR_STATUSES.find(([type]) => exception instanceof type);
      return {
        status: match?.[1] ?? HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          ...base,
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }

    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), body: { ...base, error: this.fromHttpException(exception) } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { ...base, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end.' } },
    };
  }

  /** Normalises Nest's own exceptions — chiefly ValidationPipe's field list — into our shape. */
  private fromHttpException(exception: HttpException): ErrorBody['error'] {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { code: this.codeFor(exception.getStatus()), message: response };
    }

    const { message, error } = response as { message?: string | string[]; error?: string };

    if (Array.isArray(message)) {
      return {
        code: 'VALIDATION_FAILED',
        message: 'Some fields are invalid.',
        details: { fields: message },
      };
    }

    return {
      code: this.codeFor(exception.getStatus()),
      message: message ?? error ?? exception.message,
    };
  }

  private codeFor(status: HttpStatus): string {
    return HttpStatus[status] ?? 'ERROR';
  }
}
