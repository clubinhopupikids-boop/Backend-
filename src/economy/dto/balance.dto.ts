import { ApiProperty } from '@nestjs/swagger';

export class ChildBalanceDto {
  @ApiProperty({ example: 0, minimum: 0 })
  stars!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  crystals!: number;
}
