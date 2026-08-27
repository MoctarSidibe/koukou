import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Numéro de téléphone OU e-mail',
    example: '+24174123456',
  })
  @IsString()
  @IsNotEmpty({
    message: "L'identifiant (téléphone ou e-mail) est obligatoire.",
  })
  identifier: string;

  @ApiProperty({ description: 'Mot de passe' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password: string;
}
