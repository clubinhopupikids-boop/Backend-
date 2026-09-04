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
import { EconomyModule } from './economy/economy.module';
import { MissionsModule } from './missions/missions.module';
import { GamesModule } from './games/games.module';
import { LibraryModule } from './library/library.module';
import { ParentAccessModule } from './parent-access/parent-access.module';
import { ParentAccessGuard } from './common/guards/parent-access.guard';
import { FamilyNotesModule } from './family-notes/family-notes.module';
import { ParentInsightsModule } from './parent-insights/parent-insights.module';

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
    EconomyModule,
    MissionsModule,
    GamesModule,
    LibraryModule,
    ParentAccessModule,
    FamilyNotesModule,
    ParentInsightsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ParentAccessGuard },
  ],
})
export class AppModule {}
