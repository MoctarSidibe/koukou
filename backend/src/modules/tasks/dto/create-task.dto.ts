import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ description: 'Titre de la tâche' })
  @IsNotEmpty({ message: 'Le titre est requis.' })
  @IsString({ message: 'Le titre doit être une chaîne.' })
  title: string;

  @ApiProperty({ description: 'Échéance (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'L’échéance doit être au format YYYY-MM-DD.' })
  dueDate: string;

  @ApiPropertyOptional({
    description: 'Éleveur assigné (doit être rattaché à la ferme)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant d’éleveur invalide.' })
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Lot de production concerné' })
  @IsOptional()
  @IsUUID('4', { message: 'Identifiant de lot invalide.' })
  batchId?: string;

  @ApiPropertyOptional({ description: 'Remarques' })
  @IsOptional()
  @IsString({ message: 'Les remarques doivent être une chaîne.' })
  notes?: string;
}