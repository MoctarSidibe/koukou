import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CareType } from '../../../common/enums/care-type.enum.js';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Vaccin ou médicament uniquement' })
  @IsOptional()
  @IsEnum(CareType, { message: 'Type de soin invalide.' })
  careType?: CareType;

  @ApiPropertyOptional({ description: 'Intitulé du soin' })
  @IsOptional()
  @IsString({ message: 'Intitulé du soin invalide.' })
  @MaxLength(160, { message: 'Intitulé limité à 160 caractères.' })
  name?: string;

  @ApiPropertyOptional({ description: 'Voie d’administration' })
  @IsOptional()
  @IsString({ message: 'Voie d’administration invalide.' })
  route?: string;

  @ApiPropertyOptional({ description: 'Dosage' })
  @IsOptional()
  @IsString({ message: 'Dosage invalide.' })
  dosage?: string;

  @ApiPropertyOptional({ description: 'Notes (optionnel)' })
  @IsOptional()
  @IsString({ message: 'Notes invalides.' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Délai d’attente HACCP en jours (0 par défaut)',
  })
  @IsOptional()
  @IsInt({ message: 'Délai d’attente en jours entiers.' })
  @Min(0, { message: 'Délai d’attente positif ou nul.' })
  withdrawalDays?: number;

  @ApiPropertyOptional({
    description:
      'Nouvelle date planifiée (YYYY-MM-DD, UTC) — replace le soin en PLANIFIE',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date invalide (format YYYY-MM-DD).' })
  scheduledDate?: string;
}