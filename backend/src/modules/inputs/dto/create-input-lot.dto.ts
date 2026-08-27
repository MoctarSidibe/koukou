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
import { FeedUnit, FoodType } from '../../../common/enums/food-type.enum.js';
import { InputKind } from '../../../common/enums/input-kind.enum.js';

export class CreateInputLotDto {
  @ApiPropertyOptional({ description: 'Lot de production lié (optionnel)' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty({ enum: InputKind, description: "Type d'intrant" })
  @IsEnum(InputKind, { message: "Type d'intrant invalide." })
  kind: InputKind;

  @ApiPropertyOptional({
    enum: FoodType,
    description: 'Type d’aliment (si aliment)',
  })
  @IsOptional()
  @IsEnum(FoodType)
  foodType?: FoodType;

  @ApiProperty({ description: 'Nom du produit', example: 'Provende Démarrage' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire.' })
  productName: string;

  @ApiProperty({ description: 'Fournisseur', example: 'CEAG' })
  @IsString()
  @IsNotEmpty({ message: 'Le fournisseur est obligatoire.' })
  supplier: string;

  @ApiProperty({ description: 'Numéro de lot fournisseur (exigence HACCP)' })
  @IsString()
  @IsNotEmpty({
    message: 'Le numéro de lot fournisseur est obligatoire (HACCP).',
  })
  supplierLotNumber: string;

  @ApiPropertyOptional({ description: 'Date de péremption' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Date de réception' })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiProperty({ description: 'Quantité' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Prix d’achat unitaire en FCFA (permet le renseignement du coût de revient — enrichissement P&L)',
  })
  @IsOptional()
  @IsInt({ message: 'Le prix unitaire doit être un entier (FCFA).' })
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif.' })
  unitPriceFcfa?: number;

  @ApiPropertyOptional({ enum: FeedUnit, description: 'Unité (SAC ou KG)' })
  @IsOptional()
  @IsEnum(FeedUnit)
  unit?: FeedUnit;
}
