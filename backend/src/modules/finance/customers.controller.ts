import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto.js';

@ApiTags('Finance — Clients (POS)')
@Controller('farms/:farmId/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Liste des clients avec solde à recouvrer',
  })
  @ApiParam({ name: 'farmId' })
  list(@CurrentUser() user: AuthUser, @Param('farmId') farmId: string) {
    return this.customersService.listWithBalances(user, farmId);
  }

  @Post()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Créer un client (comptoir ou crédit)' })
  @ApiParam({ name: 'farmId' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(user, farmId, dto);
  }

  @Patch(':customerId')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Modifier un client' })
  @ApiParam({ name: 'farmId' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user, farmId, customerId, dto);
  }

  @Get(':customerId')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Profil d’un client (coordonnées + solde + segment)',
  })
  @ApiParam({ name: 'farmId' })
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getOne(user, farmId, customerId);
  }

  @Get(':customerId/history')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Historique d’achats d’un client (articles + paiements)',
  })
  @ApiParam({ name: 'farmId' })
  history(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.history(user, farmId, customerId);
  }

  @Get(':customerId/stats')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Statistiques d’un client (visites, dépenses, favoris, segment)',
  })
  @ApiParam({ name: 'farmId' })
  stats(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.stats(user, farmId, customerId);
  }

  @Get(':customerId/balance')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Solde à recouvrer d’un client (crédit octroyé)',
  })
  @ApiParam({ name: 'farmId' })
  balance(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getBalance(user, farmId, customerId);
  }
}
