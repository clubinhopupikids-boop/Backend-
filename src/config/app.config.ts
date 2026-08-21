import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appPrefix: string;
  corsOrigins: string[];
  jwtSecret: string;
  jwtAccessTtl: string;
  jwtIssuer: string;
  databaseUrl: string;
  swaggerPath: string;
}

export default registerAs('app', (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  const port = Number(process.env.PORT ?? 3000);
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';

  const errors: string[] = [];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be development|test|production (got "${nodeEnv}")`);
  }
  if (!Number.isInteger(port) || port <= 0) {
    errors.push(`PORT must be a positive integer (got "${process.env.PORT}")`);
  }
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a postgresql:// URL');
  }
  if (errors.length > 0) {
    console.error('Invalid environment configuration:\n - ' + errors.join('\n - '));
    throw new Error('Invalid environment configuration');
  }

  const corsRaw = (process.env.CORS_ORIGINS ?? '*').trim();
  const corsOrigins = corsRaw === '*' ? ['*'] : corsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  return {
    nodeEnv,
    port,
    appPrefix: (process.env.APP_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''),
    corsOrigins,
    jwtSecret,
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '1h',
    jwtIssuer: process.env.JWT_ISSUER ?? 'pupikids',
    databaseUrl,
    swaggerPath: (process.env.SWAGGER_PATH ?? 'docs').replace(/^\/+|\/+$/g, ''),
  };
});
