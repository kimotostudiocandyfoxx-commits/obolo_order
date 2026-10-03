import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { LedgerError } from '@obolo/ledger';
import type { Response } from 'express';

/** Normalises every error to `{ error: { code, message } }` (ApiErrorBody in @obolo/shared). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      if (typeof body === 'object' && body && 'error' in body) return res.status(status).json(body);
      const message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? err.message);
      return res.status(status).json({ error: { code: HttpStatus[status] ?? 'ERROR', message: String(message) } });
    }
    if (err instanceof LedgerError) {
      return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({ error: { code: err.code, message: err.message } });
    }
    this.log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  }
}

export function apiError(status: HttpStatus, code: string, message: string): HttpException {
  return new HttpException({ error: { code, message } }, status);
}
