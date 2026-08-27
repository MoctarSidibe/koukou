import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { BatchType } from '../../../common/enums/batch-type.enum.js';

export class ChangeTypeDto {
  @ApiProperty({ enum: BatchType, description: 'Nouveau type (ex: PONDEUSE -> CHAIR en fin de ponte)' })
  @IsEnum(BatchType, { message: 'Le type doit être CHAIR ou PONDEUSE.' })
  toType: BatchType;

  @ApiProperty({ description: 'Date effective du changement', example: '2026-12-01' })
  @IsDateString()
  changedOn: string;

  @ApiProperty({ description: 'Motif du changement (optionnel)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
