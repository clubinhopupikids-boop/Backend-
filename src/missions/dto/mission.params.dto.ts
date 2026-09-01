import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ChildIdParamDto } from 'src/children/dto/child.dto';

export class MissionIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  missionId!: string;
}

export class MissionCompletionIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  completionId!: string;
}

export class ChildMissionParamDto extends ChildIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  missionId!: string;
}

export class ChildMissionCompletionParamDto extends ChildIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  completionId!: string;
}
