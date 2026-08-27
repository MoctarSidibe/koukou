import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Numéro de téléphone (identifiant)',
    example: '+24174123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @ApiProperty({ description: 'Adresse e-mail', example: 'fermier@exemple.ga' })
  @IsEmail({}, { message: "L'adresse e-mail n'est pas valide." })
  email: string;

  @ApiProperty({ description: 'Nom complet', example: 'Jean Ondo' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName: string;

  @ApiProperty({ description: 'Mot de passe (min 6 caractères)' })
  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères.',
  })
  password: string;
}
