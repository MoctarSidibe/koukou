import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Numéro de téléphone (identifiant)',
    example: '+24174123456',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @ApiProperty({ description: 'Nom complet', example: 'Jean Ondo' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName: string;

  @ApiProperty({
    description: 'Code secret (PIN), minimum 6 caractères',
    example: '123456',
  })
  @IsString()
  @MinLength(6, {
    message: 'Le code doit contenir au moins 6 caractères.',
  })
  code: string;
}
