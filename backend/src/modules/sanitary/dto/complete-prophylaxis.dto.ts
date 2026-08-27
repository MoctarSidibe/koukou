import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CompleteProphylaxisDto {
  @ApiPropertyOptional({
    description: 'Date/heure d’exécution réelle (défaut : maintenant)',
  })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({
    description: 'Remarques terrain (lot du vaccin, réaction, etc.)',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Référence au lot d’intrant (médicament/vaccin)',
  })
  @IsOptional()
  @IsString()
  medicationLotId?: string;
}
