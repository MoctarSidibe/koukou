import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateCarcassTransferDto {
  @IsUUID('4', {
    message: 'Identifiant d’ordre d’abattage invalide.',
  })
  slaughterOrderId: string;

  @IsUUID('4', {
    message: 'Identifiant de point de vente invalide.',
  })
  pointOfSaleId: string;

  @IsInt({ message: 'La quantité doit être un nombre entier de carcasses.' })
  @Min(1, { message: 'La quantité doit être d’au moins une carcasse.' })
  quantity: number;
}