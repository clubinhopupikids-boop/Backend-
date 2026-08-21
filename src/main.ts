import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { AppConfig } from './config/app.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const cfg = config.get<AppConfig>('app')!;
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(cfg.appPrefix);

  // Security headers.
  app.use(helmet());

  // CORS configured per environment via CORS_ORIGINS.
  app.enableCors({
    origin: cfg.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global validation: whitelist + forbidNonWhitelisted prevents mass assignment.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Strip @Exclude() fields from responses (e.g. passwordHash leftovers).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger only in non-production environments.
  if (cfg.nodeEnv !== 'production') {
    const docConfig = new DocumentBuilder()
      .setTitle('Pupi Kids / PupiMundo API')
      .setDescription('O Clubinho Inteligente — backend foundation.')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup(cfg.swaggerPath, app, document);
    logger.log(`Swagger UI available at /${cfg.swaggerPath}`);
  }

  await app.listen(cfg.port);
  logger.log(`Application running on http://localhost:${cfg.port}/${cfg.appPrefix}`);
  logger.log(`Health check at http://localhost:${cfg.port}/${cfg.appPrefix}/health`);
}

void bootstrap();
