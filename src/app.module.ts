import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { ResponsiblesModule } from './responsibles/responsibles.module';
import { ChildrenModule } from './children/children.module';
import { ExperienceSettingsModule } from './settings/experience-settings.module';
import { CommunicationPreferencesModule } from './communication/communication-preferences.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ResponsiblesModule,
    ChildrenModule,
    ExperienceSettingsModule,
    CommunicationPreferencesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
