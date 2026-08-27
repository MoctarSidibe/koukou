import { OmitType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsNotEmpty({ message: 'Le nom du client est obligatoire.' })
  @IsString({ message: 'Le nom du client doit être une chaîne de caractères.' })
  fullName: string;

  @IsOptional()
  @IsString({ message: 'Le numéro de téléphone doit être une chaîne.' })
  @Matches(/^\+?[0-9\s-]{6,20}$/, {
    message: 'Le numéro de téléphone n’est pas valide.',
  })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'L’e-mail doit être une chaîne de caractères.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'La ville doit être une chaîne de caractères.' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères.' })
  notes?: string;
}

export class UpdateCustomerDto extends OmitType(CreateCustomerDto, [
  'fullName',
] as const) {
  @IsOptional()
  @IsString({ message: 'Le nom du client doit être une chaîne de caractères.' })
  fullName?: string;
}
