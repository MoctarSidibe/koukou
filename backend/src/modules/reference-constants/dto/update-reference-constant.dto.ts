import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class UpdateReferenceConstantDto {
  @ApiProperty({
    description: 'Nouvelle valeur (constante numérique positive)',
    example: 15,
  })
  @IsNumber({}, { message: 'La valeur doit être un nombre.' })
  @IsPositive({ message: 'La valeur doit être strictement positive.' })
  value: number;
}
