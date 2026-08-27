import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { AlertStatus } from '../../common/enums/alert-level.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { AlertsService } from './alerts.service.js';

@ApiTags('Alertes (Assistant)')
@Controller('farms/:farmId/alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly farmsService: FarmsService,
  ) {}

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Lister les alertes d’une ferme' })
  @ApiParam({ name: 'farmId' })
  @ApiQuery({ name: 'status', required: false, enum: AlertStatus })
  async list(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Query('status') status?: AlertStatus,
  ) {
    await this.farmsService.assertAccessible(user, farmId);
    return this.alertsService.listForFarm(farmId, status);
  }
}
