import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BatchType } from '../../../common/enums/batch-type.enum.js';

export class CreateBatchDto {
  @ApiProperty({ description: "Nom du bâtiment / lot", example: 'Bâtiment A' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du lot est obligatoire.' })
  batchName: string;

  @ApiProperty({ description: 'Date d’arrivée des poussins', example: '2026-08-30' })
  @IsDateString()
  integrationDate: string;

  @ApiProperty({ description: 'Quantité de poussins au départ' })
  @IsInt()
  @Min(1, { message: 'La quantité de poussins doit être au moins 1.' })
  quantityAtStart: number;

  @ApiPropertyOptional({ description: 'Souche (id Breed)', example: 'uuid' })
  @IsOptional()
  @IsString()
  breedId?: string;

  @ApiProperty({ enum: BatchType, description: "Type d'élevage (CHAIR ou PONDEUSE)" })
  @IsEnum(BatchType, { message: 'Le type doit être CHAIR ou PONDEUSE.' })
  type: BatchType;

  @ApiPropertyOptional({ description: 'Surface du bâtiment (m²) — pour le calcul de densité' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  buildingAreaM2?: number;

  @ApiPropertyOptional({ description: "Poids d'un sac d'aliment (kg), défaut = celui de la ferme" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  feedUnitSacKg?: number;

  @ApiPropertyOptional({ description: 'Bâtiment (id Building) dans lequel le lot est installé' })
  @IsOptional()
  @IsString()
  buildingId?: string;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — fournisseur du couvoir (poussins)' })
  @IsOptional()
  @IsString()
  couvoirSupplier?: string;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — numéro de lot des poussins' })
  @IsOptional()
  @IsString()
  chickLotNumber?: string;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — date d’éclosion' })
  @IsOptional()
  @IsDateString()
  hatchDate?: string;
}
