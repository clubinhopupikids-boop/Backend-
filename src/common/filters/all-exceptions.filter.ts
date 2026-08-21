import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Central error handler. Returns a stable JSON shape and never leaks internals
 * (stacks, raw Prisma messages, etc.) to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, code } = this.map(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private map(exception: unknown): {
    status: number;
    message: string;
    code: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] })?.message ?? exception.message;
      const flat = Array.isArray(message) ? message.join('; ') : String(message);
      return { status, message: flat, code: this.codeFor(status) };
    }

    // Prisma errors -> safe, generic messages.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          return {
            status: HttpStatus.CONFLICT,
            message: 'A resource with that unique value already exists.',
            code: 'UNIQUE_CONSTRAINT_VIOLATION',
          };
        }
        case 'P2025': {
          return {
            status: HttpStatus.NOT_FOUND,
            message: 'Resource not found.',
            code: 'NOT_FOUND',
          };
        }
        default: {
          return {
            status: HttpStatus.BAD_REQUEST,
            message: 'Database request failed.',
            code: exception.code,
          };
        }
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided.',
        code: 'VALIDATION_ERROR',
      };
    }

    // Unknown error — never leak.
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.',
      code: 'INTERNAL_ERROR',
    };
  }

  private codeFor(status: number): string {
    return (
      HttpStatus[status]?.toUpperCase().replace(/ /g, '_') ?? 'ERROR'
    );
  }
}
