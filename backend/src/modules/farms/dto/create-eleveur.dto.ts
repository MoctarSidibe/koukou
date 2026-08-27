import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateElevageDto {
  @ApiProperty({ description: 'Numéro de téléphone', example: '+24174123457' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @ApiProperty({ description: 'Adresse e-mail' })
  @IsEmail({}, { message: "L'adresse e-mail n'est pas valide." })
  email: string;

  @ApiProperty({ description: 'Nom complet de l’éleveur' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName: string;

  @ApiProperty({ description: 'Mot de passe temporaire (min 6 caractères)' })
  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères.',
  })
  password: string;

  @ApiPropertyOptional({ description: 'Bâtiment assigné' })
  @IsOptional()
  @IsString()
  buildingAssignment?: string;

  @ApiPropertyOptional({ description: 'Lier immédiatement à la ferme' })
  @IsOptional()
  @IsBoolean()
  linkImmediately?: boolean;
}
