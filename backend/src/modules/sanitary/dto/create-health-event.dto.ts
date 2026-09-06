import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AlertLevel } from '../../../common/enums/alert-level.enum.js';
import { DiseaseSeverity } from '../../../common/enums/disease-severity.enum.js';
import { HealthEventKind } from '../../../common/enums/health-event-kind.enum.js';

const LEVELS = [AlertLevel.VERT, AlertLevel.JAUNE, AlertLevel.ROUGE] as const;

const KIND_MESSAGES: Record<HealthEventKind, string> = {
  MALADIE: 'Maladie',
  MORTALITE: 'Pic de mortalité',
  REFORME: 'Réforme / culling sanitaire',
  SYMPTOME: 'Symptôme',
  VISITE_VETO: 'Visite du vétérinaire',
  AUTRE: 'Autre',
};

export class CreateHealthEventDto {
  @IsEnum(HealthEventKind, {
    message: `Le type d'événement doit être l'un de : ${Object.values(
      HealthEventKind,
    ).join(', ')}`,
  })
  kind: HealthEventKind;

  @IsDateString({}, { message: 'La date doit être au format AAAA-MM-JJ (UTC).' })
  @IsNotEmpty({ message: "La date de l'événement est requise." })
  occurredAt: string;

  @IsOptional()
  @IsEnum(LEVELS, {
    message: 'La gravité doit être VERT, JAUNE ou ROUGE.',
  })
  severity?: AlertLevel;

  @IsOptional()
  @IsEnum(DiseaseSeverity, {
    message: `La sévérité de la maladie doit être l'un de : ${Object.values(
      DiseaseSeverity,
    ).join(', ')}`,
  })
  diseaseSeverity?: DiseaseSeverity;

  @IsOptional()
  @IsInt({ message: 'La quantité doit être un nombre entier.' })
  @Min(0, { message: 'La quantité ne peut pas être négative.' })
  @Max(1000000, { message: 'La quantité est trop élevée.' })
  quantity?: number;

  @IsString({ message: 'Le titre doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @MinLength(2, { message: 'Le titre doit contenir au moins 2 caractères.' })
  @MaxLength(160, { message: 'Le titre ne doit pas dépasser 160 caractères.' })
  title: string;

  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères.' })
  @MaxLength(2000, {
    message: 'La description ne doit pas dépasser 2000 caractères.',
  })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Les symptômes doivent être une chaîne de caractères.' })
  @MaxLength(2000, {
    message: 'Les symptômes ne doivent pas dépasser 2000 caractères.',
  })
  symptoms?: string;

  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères.' })
  @MaxLength(2000, { message: 'Les notes ne doivent pas dépasser 2000 caractères.' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'Le nom de la maladie doit être une chaîne de caractères.' })
  @MinLength(2, { message: 'Le nom de la maladie doit contenir au moins 2 caractères.' })
  @MaxLength(120, {
    message: 'Le nom de la maladie ne doit pas dépasser 120 caractères.',
  })
  disease?: string;

  @IsOptional()
  @IsString({
    message: 'Le traitement administré doit être une chaîne de caractères.',
  })
  @MaxLength(2000, {
    message: 'Le traitement administré ne doit pas dépasser 2000 caractères.',
  })
  treatmentGiven?: string;

  @IsOptional()
  @IsBoolean({ message: 'Le champ « vétérinaire consulté » doit être un booléen.' })
  vetConsulted?: boolean;

  @IsOptional()
  @IsString({ message: 'Le nom du vétérinaire doit être une chaîne de caractères.' })
  @MaxLength(120, {
    message: 'Le nom du vétérinaire ne doit pas dépasser 120 caractères.',
  })
  vetName?: string;

  @IsOptional()
  @IsBoolean({
    message: 'Le champ « événement résolu » doit être un booléen.',
  })
  resolved?: boolean;
}

export const HEALTH_KIND_MESSAGES = KIND_MESSAGES;
