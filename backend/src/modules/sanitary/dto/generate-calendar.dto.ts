import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateCalendarDto {
  @ApiPropertyOptional({
    description:
      'Protocole spécifique — sinon le protocole par défaut du type/species du lot',
  })
  @IsOptional()
  @IsString()
  protocolId?: string;
}
