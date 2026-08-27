import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { BatchesService } from './batches.service.js';
import { ChangeTypeDto } from './dto/change-type.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';
import { UpdateBatchDto } from './dto/update-batch.dto.js';

@ApiTags('Lots (Module 1)')
@Controller('farms/:farmId/batches')
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly farmsService: FarmsService,
  ) {}

  @Post()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Créer un lot (Création de bande)' })
  @ApiParam({ name: 'farmId' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateBatchDto,
  ) {
    return this.batchesService.create(user, farmId, dto);
  }

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Lister les lots avec métriques' })
  @ApiParam({ name: 'farmId' })
  findAll(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.batchesService.findAll(user, farmId);
  }

  @Get(':batchId')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Détail d’un lot avec métriques' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.batchesService.findOne(user, farmId, batchId);
  }

  @Patch(':batchId')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Modifier un lot (traçabilité HACCP éditable)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
  ) {
    return this.batchesService.update(user, farmId, batchId, dto);
  }

  @Patch(':batchId/type')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Changer le type (ex: PONDEUSE -> CHAIR) avec historique' })
  changeType(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
    @Body() dto: ChangeTypeDto,
  ) {
    return this.batchesService.changeType(user, farmId, batchId, dto);
  }

  @Post(':batchId/vente')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Passer le lot en vente (traçabilité HACCP requise)' })
  enterSale(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.batchesService.enterSale(user, farmId, batchId);
  }

  @Post(':batchId/cloture')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Clôturer le lot (traçabilité HACCP requise)' })
  close(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.batchesService.close(user, farmId, batchId);
  }
}
