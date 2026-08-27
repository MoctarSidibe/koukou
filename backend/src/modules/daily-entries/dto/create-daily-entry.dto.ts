import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { FeedUnit, FoodType } from '../../../common/enums/food-type.enum.js';
import { ConsumptionSource } from '../../../common/enums/consumption-source.enum.js';

export class CreateDailyEntryDto {
  @ApiProperty({ description: 'Date de la saisie', example: '2026-09-01' })
  @IsDateString()
  entryDate: string;

  @ApiPropertyOptional({ description: 'Nombre de morts du jour' })
  @IsOptional()
  @IsInt()
  @Min(0)
  deaths?: number;

  @ApiPropertyOptional({
    description: 'Aliments en SAC (ou équivalent)',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feedBags?: number;

  @ApiPropertyOptional({
    description: 'Aliments en quantité (unité choisie)',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feedQuantity?: number;

  @ApiPropertyOptional({
    enum: FeedUnit,
    description: "Unité d'aliment (SAC ou KG)",
  })
  @IsOptional()
  @IsEnum(FeedUnit, { message: "L'unité d'aliment doit être SAC ou KG." })
  feedUnit?: FeedUnit;

  @ApiPropertyOptional({ enum: FoodType, description: "Type d'aliment" })
  @IsOptional()
  @IsEnum(FoodType)
  feedType?: FoodType;

  @ApiPropertyOptional({ description: 'Lot d\u2019intrant tracé (HACCP) lié' })
  @IsOptional()
  @IsString()
  inputLotId?: string;

  @ApiPropertyOptional({ description: 'Eau bue en litres (indicateur n°1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterL?: number;

  @ApiPropertyOptional({ description: 'Poids moyen du lot (kg) — pesée hebdo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgWeightKg?: number;

  @ApiPropertyOptional({ description: "Nombre d'œufs collectés" })
  @IsOptional()
  @IsInt()
  @Min(0)
  eggsCollected?: number;

  @ApiPropertyOptional({ description: 'Œufs commercialisables' })
  @IsOptional()
  @IsInt()
  @Min(0)
  eggsSellable?: number;

  @ApiPropertyOptional({ description: 'Œufs fêlés' })
  @IsOptional()
  @IsInt()
  @Min(0)
  eggsCracked?: number;

  @ApiPropertyOptional({ description: 'Petits œufs' })
  @IsOptional()
  @IsInt()
  @Min(0)
  eggsSmall?: number;

  @ApiPropertyOptional({
    enum: ConsumptionSource,
    description: 'Source de la saisie',
  })
  @IsOptional()
  @IsEnum(ConsumptionSource)
  source?: ConsumptionSource;
}
