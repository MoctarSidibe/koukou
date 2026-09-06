import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @ApiPropertyOptional({
    description: 'Adresse e-mail (optionnelle)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "L'adresse e-mail n'est pas valide." })
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Nom complet de l’éleveur' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName: string;

  @ApiProperty({
    description: 'Code secret (PIN) temporaire, minimum 6 caractères',
  })
  @IsString()
  @MinLength(6, {
    message: 'Le code doit contenir au moins 6 caractères.',
  })
  code: string;

  @ApiPropertyOptional({ description: 'Bâtiment assigné' })
  @IsOptional()
  @IsString()
  buildingAssignment?: string;

  @ApiPropertyOptional({ description: 'Lier immédiatement à la ferme' })
  @IsOptional()
  @IsBoolean()
  linkImmediately?: boolean;
}
