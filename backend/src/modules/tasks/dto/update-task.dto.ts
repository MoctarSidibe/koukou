import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Titre de la tâche' })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne.' })
  title?: string;

  @ApiPropertyOptional({ description: 'Échéance (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'L’échéance doit être au format YYYY-MM-DD.' })
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Éleveur assigné' })
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

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Statut de tâche invalide.' })
  status?: TaskStatus;
}