import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';
import { ParentAccessController } from './parent-access.controller';
import { ParentAccessService } from './parent-access.service';
import { ParentAccessTokenService } from './parent-access-token.service';

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [ParentAccessController],
  providers: [ParentAccessService, ParentAccessTokenService],
  exports: [ParentAccessTokenService],
})
export class ParentAccessModule {}
