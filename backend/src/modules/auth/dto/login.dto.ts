import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Numéro de téléphone',
    example: '+24174123456',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @ApiProperty({
    description: 'Code secret (PIN) du compte',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le code est obligatoire.' })
  code: string;
}
