import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateBatchDto {
  @ApiPropertyOptional({ description: "Nom du bâtiment / lot" })
  @IsOptional()
  @IsString()
  batchName?: string;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — fournisseur du couvoir (poussins)' })
  @IsOptional()
  @IsString()
  couvoirSupplier?: string | null;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — numéro de lot des poussins' })
  @IsOptional()
  @IsString()
  chickLotNumber?: string | null;

  @ApiPropertyOptional({ description: 'Traçabilité HACCP — date d’éclosion' })
  @IsOptional()
  @IsDateString()
  hatchDate?: string | null;

  @ApiPropertyOptional({ description: 'Surface du bâtiment (m²) — densité' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  buildingAreaM2?: number | null;

  @ApiPropertyOptional({ description: "Poids d'un sac d'aliment (kg)" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  feedUnitSacKg?: number | null;

  @ApiPropertyOptional({ description: 'Bâtiment (id Building) — rattacher le lot à un bâtiment' })
  @IsOptional()
  @IsString()
  buildingId?: string | null;
}
