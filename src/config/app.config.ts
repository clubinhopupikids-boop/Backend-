import { registerAs } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  appPrefix: string;
  corsOrigins: string[];
  jwtSecret: string;
  jwtAccessTtl: string;
  jwtIssuer: string;
  parentAccessJwtSecret: string;
  parentAccessTtlSeconds: number;
  parentPin: {
    maxAttempts: number;
    delayAfterAttempts: number;
    delayMs: number;
    lockSeconds: number;
  };
  databaseUrl: string;
  swaggerPath: string;
  missionTimeZone: string;
  r2: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucketName?: string;
    endpoint?: string;
    publicBaseUrl?: string;
    signedUrlTtlSeconds: number;
  };
}

export function resolveAppHost(
  nodeEnv: AppConfig['nodeEnv'],
  configuredHost: string | undefined,
): string {
  const host = configuredHost?.trim();
  if (host) {
    return host;
  }

  return nodeEnv === 'production' ? '127.0.0.1' : '0.0.0.0';
}

export default registerAs('app', (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const host = resolveAppHost(nodeEnv, process.env.HOST);
  const port = Number(process.env.PORT ?? 3000);
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const missionTimeZone = process.env.MISSION_TIME_ZONE ?? 'America/Sao_Paulo';
  const signedUrlTtlSeconds = Number(process.env.R2_SIGNED_URL_TTL_SECONDS ?? 1800);
  const configuredParentAccessSecret = process.env.PARENT_ACCESS_JWT_SECRET?.trim();
  const parentAccessTtlSeconds = Number(process.env.PARENT_ACCESS_TTL_SECONDS ?? 900);
  const parentPinMaxAttempts = Number(process.env.PARENT_PIN_MAX_ATTEMPTS ?? 5);
  const parentPinDelayAfterAttempts = Number(process.env.PARENT_PIN_DELAY_AFTER_ATTEMPTS ?? 3);
  const parentPinDelayMs = Number(process.env.PARENT_PIN_DELAY_MS ?? 750);
  const parentPinLockSeconds = Number(process.env.PARENT_PIN_LOCK_SECONDS ?? 300);

  const errors: string[] = [];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be development|test|production (got "${nodeEnv}")`);
  }
  if (!Number.isInteger(port) || port <= 0) {
    errors.push(`PORT must be a positive integer (got "${process.env.PORT}")`);
  }
  if (
    !Number.isInteger(signedUrlTtlSeconds) ||
    signedUrlTtlSeconds < 60 ||
    signedUrlTtlSeconds > 86400
  ) {
    errors.push('R2_SIGNED_URL_TTL_SECONDS must be an integer between 60 and 86400');
  }
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (configuredParentAccessSecret && configuredParentAccessSecret.length < 32) {
    errors.push('PARENT_ACCESS_JWT_SECRET must be at least 32 characters when provided');
  }
  if (
    !Number.isInteger(parentAccessTtlSeconds) ||
    parentAccessTtlSeconds < 60 ||
    parentAccessTtlSeconds > 3600
  ) {
    errors.push('PARENT_ACCESS_TTL_SECONDS must be an integer between 60 and 3600');
  }
  if (
    !Number.isInteger(parentPinMaxAttempts) ||
    parentPinMaxAttempts < 3 ||
    parentPinMaxAttempts > 20
  ) {
    errors.push('PARENT_PIN_MAX_ATTEMPTS must be an integer between 3 and 20');
  }
  if (
    !Number.isInteger(parentPinDelayAfterAttempts) ||
    parentPinDelayAfterAttempts < 1 ||
    parentPinDelayAfterAttempts >= parentPinMaxAttempts
  ) {
    errors.push('PARENT_PIN_DELAY_AFTER_ATTEMPTS must be lower than PARENT_PIN_MAX_ATTEMPTS');
  }
  if (!Number.isInteger(parentPinDelayMs) || parentPinDelayMs < 0 || parentPinDelayMs > 5000) {
    errors.push('PARENT_PIN_DELAY_MS must be an integer between 0 and 5000');
  }
  if (
    !Number.isInteger(parentPinLockSeconds) ||
    parentPinLockSeconds < 30 ||
    parentPinLockSeconds > 3600
  ) {
    errors.push('PARENT_PIN_LOCK_SECONDS must be an integer between 30 and 3600');
  }
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a postgresql:// URL');
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: missionTimeZone }).format();
  } catch {
    errors.push(`MISSION_TIME_ZONE must be a valid IANA timezone (got "${missionTimeZone}")`);
  }
  if (errors.length > 0) {
    console.error('Invalid environment configuration:\n - ' + errors.join('\n - '));
    throw new Error('Invalid environment configuration');
  }

  const corsRaw = (process.env.CORS_ORIGINS ?? '*').trim();
  const corsOrigins =
    corsRaw === '*'
      ? ['*']
      : corsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    nodeEnv,
    host,
    port,
    appPrefix: (process.env.APP_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''),
    corsOrigins,
    jwtSecret,
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '1h',
    jwtIssuer: process.env.JWT_ISSUER ?? 'pupikids',
    // A derived key keeps parent tickets cryptographically distinct even when an
    // installation has not provisioned the optional dedicated secret yet.
    parentAccessJwtSecret:
      configuredParentAccessSecret ??
      createHmac('sha256', jwtSecret).update('pupikids:parent-access:v1').digest('hex'),
    parentAccessTtlSeconds,
    parentPin: {
      maxAttempts: parentPinMaxAttempts,
      delayAfterAttempts: parentPinDelayAfterAttempts,
      delayMs: parentPinDelayMs,
      lockSeconds: parentPinLockSeconds,
    },
    databaseUrl,
    swaggerPath: (process.env.SWAGGER_PATH ?? 'docs').replace(/^\/+|\/+$/g, ''),
    // Mission recurrence is a product calendar, not the server's local clock.
    missionTimeZone,
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      endpoint: process.env.R2_ENDPOINT,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
      signedUrlTtlSeconds,
    },
  };
});
