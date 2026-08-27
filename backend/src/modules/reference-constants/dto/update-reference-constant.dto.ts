import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateReferenceConstantDto {
  @ApiProperty({
    description: 'Nouvelle valeur (constante numérique)',
    example: 15,
  })
  @IsNumber({}, { message: 'La valeur doit être un nombre.' })
  value: number;
}
