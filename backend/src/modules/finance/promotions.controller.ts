import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { PromotionsService } from './promotions.service.js';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from './dto/promotion.dto.js';

@ApiTags('Finance — Promotions (coupons réduction)')
@Roles(UserRole.PROPRIETAIRE)
@Controller('farms/:farmId/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une promotion (coupon réduction)' })
  @ApiParam({ name: 'farmId' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotionsService.create(user, farmId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des promotions de la ferme' })
  @ApiParam({ name: 'farmId' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
  ) {
    return this.promotionsService.findAll(user, farmId);
  }

  @Patch(':promotionId')
  @ApiOperation({ summary: 'Modifier une promotion' })
  @ApiParam({ name: 'farmId' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('promotionId') promotionId: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(user, farmId, promotionId, dto);
  }

  @Delete(':promotionId')
  @ApiOperation({ summary: 'Supprimer une promotion' })
  @ApiParam({ name: 'farmId' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.remove(user, farmId, promotionId);
  }
}