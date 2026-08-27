import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RescheduleProphylaxisDto {
  @ApiProperty({ description: 'Nouvelle date planifiée (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'La date doit être au format YYYY-MM-DD.' })
  scheduledDate: string;
}
