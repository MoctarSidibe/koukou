import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelProphylaxisDto {
  @ApiPropertyOptional({
    description: 'Raison de l’annulation (ex : lot non conforme, report)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
