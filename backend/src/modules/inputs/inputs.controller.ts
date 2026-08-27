import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { InputsService } from './inputs.service.js';
import { CreateInputLotDto } from './dto/create-input-lot.dto.js';

@ApiTags('Traçabilité HACCP (Intrants)')
@Controller('farms/:farmId/inputs')
export class InputsController {
  constructor(private readonly inputsService: InputsService) {}

  @Post()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Enregistrer un intrant (aliment / poussins / médicament)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateInputLotDto,
  ) {
    return this.inputsService.create(user, {
      ...dto,
      farmId,
    });
  }

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Lister les intrants de la ferme (traçabilité)' })
  list(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.inputsService.listForFarm(user, farmId);
  }
}
