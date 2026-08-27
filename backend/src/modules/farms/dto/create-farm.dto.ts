import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFarmDto {
  @ApiProperty({ description: "Nom de l'exploitation", example: 'Ferme d’Essassa' })
  @IsString()
  @IsNotEmpty({ message: "Le nom de la ferme est obligatoire." })
  name: string;

  @ApiProperty({ description: 'Ville administrative', example: 'Libreville' })
  @IsString()
  @IsNotEmpty({ message: 'La ville administrative est obligatoire.' })
  administrativeCity: string;

  @ApiPropertyOptional({ description: 'Nombre de bâtiments' })
  @IsOptional()
  @IsInt({ message: 'Le nombre de bâtiments doit être un entier.' })
  @Min(0)
  buildingCount?: number;

  @ApiPropertyOptional({ description: 'Capacité par bâtiment (oiseaux)', example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityPerBuilding?: number;

  @ApiPropertyOptional({ description: 'Surface bâtiment (m²)', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  buildingAreaM2?: number;

  @ApiPropertyOptional({ description: "Poids d'un sac d'aliment (kg)", example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  defaultSacKg?: number;

  @ApiPropertyOptional({ description: 'Longitude (PostGIS)', example: 9.452 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Latitude (PostGIS)', example: 0.39 })
  @IsOptional()
  @IsNumber()
  latitude?: number;
}
