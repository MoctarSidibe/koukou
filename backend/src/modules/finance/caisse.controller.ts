import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { CaisseService } from './caisse.service.js';
import {
  CloseCashSessionDto,
  CreateCashMovementDto,
  OpenCashSessionDto,
} from './dto/caisse.dto.js';

@ApiTags('Finance — Caisse journalière')
@Controller('farms/:farmId/caisse')
export class CaisseController {
  constructor(private readonly caisseService: CaisseService) {}

  @Get('current')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Session de caisse ouverte (mouvements + solde attendu) ou null',
  })
  @ApiParam({ name: 'farmId' })
  current(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.caisseService.getCurrent(user, farmId);
  }

  @Get('sessions')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Historique des sessions de caisse' })
  @ApiParam({ name: 'farmId' })
  sessions(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.caisseService.listSessions(user, farmId);
  }

  @Post('open')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Ouvrir la caisse journalière (fonds de caisse initial)',
  })
  @ApiParam({ name: 'farmId' })
  open(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.caisseService.open(user, farmId, dto);
  }

  @Post('close')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({
    summary:
      'Clôturer la caisse (PROPRIÉTAIRE) : solde déclaré vs attendu, écart tracé.',
  })
  @ApiParam({ name: 'farmId' })
  close(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.caisseService.close(user, farmId, dto);
  }

  @Post('movements')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({
    summary:
      'Mouvement manuel de caisse (dépense/retrait IN ou OUT) — PROPRIÉTAIRE.',
  })
  @ApiParam({ name: 'farmId' })
  movement(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.caisseService.createMovement(user, farmId, dto);
  }
}
