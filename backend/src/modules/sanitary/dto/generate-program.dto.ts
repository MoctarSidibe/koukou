import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class GenerateProgramDto {
  @ApiProperty({ description: 'Programme pré-chargé (protocole vaccinal Gabon)' })
  @IsString({ message: 'Identifiant du programme invalide.' })
  protocolId: string;

  @ApiProperty({
    description: 'Lots de production concernés (un ou plusieurs)',
    type: [String],
  })
  @IsUUID('all', { each: true, message: 'Identifiant de lot invalide.' })
  lotIds: string[];
}