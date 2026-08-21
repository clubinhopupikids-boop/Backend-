import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  app: string;
  timestamp: string;
  database: { status: 'up' | 'down'; latencyMs?: number; error?: string };
  // Never expose connection strings, version banners or internal identifiers.
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    let db: HealthResponse['database'];
    try {
      const started = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      db = { status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      this.logger.warn(`Health DB check failed: ${(err as Error).message}`);
      db = {
        status: 'down',
        error: err instanceof Prisma.PrismaClientInitializationError ? 'unavailable' : 'error',
      };
    }

    const status: HealthResponse['status'] =
      db.status === 'up' ? 'ok' : 'down';
    return {
      status,
      app: 'pupikids-backend',
      timestamp: new Date().toISOString(),
      database: db,
    };
  }
}
