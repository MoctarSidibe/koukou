import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Tableau de bord (agrégats)')
@Controller('farms/:farmId')
export class FarmDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary:
      'Tableau de bord ferme : cheptel vivant, mortalité/viabilité, autonomie provende, encaissé du jour, équipe et alertes par niveau.',
  })
  @ApiParam({ name: 'farmId' })
  dashboard(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.dashboardService.getDashboard(user, farmId);
  }
}

@ApiTags('Tableau de bord (agrégats)')
@Controller('farms/:farmId/batches')
export class BatchCurveController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':batchId/curve')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary:
      'Courbe de croissance du lot : série hebdo du poids moyen, aliments consommés et IC cumulé (chart-ready).',
  })
  @ApiParam({ name: 'farmId' })
  @ApiParam({ name: 'batchId' })
  curve(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.dashboardService.getCurve(user, farmId, batchId);
  }
}
