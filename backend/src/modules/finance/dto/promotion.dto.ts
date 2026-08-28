import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PromotionType } from '../../../common/enums/promotion-type.enum.js';

export class CreatePromotionDto {
  @IsString({ message: 'Le code doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le code promo est requis.' })
  code: string;

  @IsString({ message: 'Le libellé doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le libellé de la promotion est requis.' })
  label: string;

  @IsEnum(PromotionType, { message: 'Type de réduction invalide.' })
  type: PromotionType;

  @IsInt({ message: 'La valeur doit être un entier.' })
  @Min(1, { message: 'La valeur doit être strictement positive.' })
  value: number;

  @IsOptional()
  @IsBoolean({ message: 'Active doit être un booléen.' })
  active?: boolean;

  @IsOptional()
  @IsString({ message: 'La date de début doit être au format YYYY-MM-DD.' })
  startDate?: string;

  @IsOptional()
  @IsString({ message: 'La date de fin doit être au format YYYY-MM-DD.' })
  endDate?: string;

  @IsOptional()
  @IsInt({ message: 'Le montant minimum doit être un entier.' })
  @Min(0, { message: 'Le montant minimum doit être positif (FCFA).' })
  minSubtotalFcfa?: number;

  @IsOptional()
  @IsUUID('4', { message: 'Identifiant client invalide.' })
  customerId?: string;
}

export class UpdatePromotionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Le code doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le code promo est requis.' })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Le libellé doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le libellé de la promotion est requis.' })
  label?: string;

  @ApiPropertyOptional({ enum: PromotionType })
  @IsOptional()
  @IsEnum(PromotionType, { message: 'Type de réduction invalide.' })
  type?: PromotionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'La valeur doit être un entier.' })
  @Min(1, { message: 'La valeur doit être strictement positive.' })
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Active doit être un booléen.' })
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'La date de début doit être au format YYYY-MM-DD.' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'La date de fin doit être au format YYYY-MM-DD.' })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: 'Le montant minimum doit être un entier.' })
  @Min(0, { message: 'Le montant minimum doit être positif (FCFA).' })
  minSubtotalFcfa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant client invalide.' })
  customerId?: string;
}