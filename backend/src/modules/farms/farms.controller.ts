import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { FarmsService } from './farms.service.js';
import { CreateElevageDto } from './dto/create-eleveur.dto.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';

@ApiTags('Fermes')
@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Créer une ferme (Propriétaire)' })
  createFarm(@CurrentUser() user: AuthUser, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(user, dto);
  }

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Lister mes fermes (selon rôle)' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.farmsService.findMine(user);
  }

  @Post(':farmId/eleveurs')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Créer un compte Éleveur et le lier à la ferme' })
  createEleveur(
    @CurrentUser() owner: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateElevageDto,
  ) {
    return this.farmsService.createEmployee(owner, farmId, dto);
  }

  @Get(':farmId/eleveurs')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Lister les éleveurs de la ferme' })
  async listEleveurs(
    @CurrentUser() owner: AuthUser,
    @Param('farmId') farmId: string,
  ) {
    await this.farmsService.assertAccessible(owner, farmId);
    return this.farmsService.listEmployees(farmId);
  }
}
