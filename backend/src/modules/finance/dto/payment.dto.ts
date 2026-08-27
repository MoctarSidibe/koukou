import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../../common/enums/payment-method.enum.js';

export class CreatePaymentDto {
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Méthode de paiement invalide.' })
  method?: PaymentMethod;

  @IsInt({ message: 'Le montant doit être un entier.' })
  @Min(1, { message: 'Le montant doit être positif (FCFA).' })
  amountFcfa: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de paiement doit être au format YYYY-MM-DD.' },
  )
  paymentDate?: string;

  @IsOptional()
  @IsString({ message: 'La clé d’idempotence doit être une chaîne.' })
  idempotencyKey?: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de début doit être au format YYYY-MM-DD.' },
  )
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de fin doit être au format YYYY-MM-DD.' },
  )
  to?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Identifiant de vente invalide.' })
  saleId?: string;
}
