import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { CarcassTransfersService } from './carcass-transfers.service.js';
import { CreateCarcassTransferDto } from './dto/carcass-transfer.dto.js';

@ApiTags('Carcasses')
@Controller('farms/:farmId/carcass-transfers')
@Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
export class CarcassTransfersController {
  constructor(private readonly transfersService: CarcassTransfersService) {}

  @Get()
  @ApiOperation({
    summary:
      'Liste des transferts de carcasses ferme → boutique (filtrable par point de vente).',
  })
  @ApiParam({ name: 'farmId' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    return this.transfersService.list(user, farmId, pointOfSaleId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Déplacer des carcasses du pool d’abattoir vers une boutique (Propriétaire ou Éleveur).',
  })
  @ApiParam({ name: 'farmId' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateCarcassTransferDto,
  ) {
    return this.transfersService.create(user, farmId, dto);
  }

  @Post(':transferId/cancel')
  @ApiOperation({
    summary:
      'Annuler un transfert de carcasses (les carcasses non vendues reviennent au pool ferme).',
  })
  @ApiParam({ name: 'farmId' })
  @ApiParam({ name: 'transferId' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('transferId') transferId: string,
  ) {
    return this.transfersService.cancel(user, farmId, transferId);
  }
}