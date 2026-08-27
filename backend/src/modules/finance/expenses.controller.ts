import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { ExpensesService } from './expenses.service.js';
import {
  CreateExpenseDto,
  ListExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto.js';

@ApiTags('Finance — Dépenses (catégorisées par CDCF)')
@Controller('farms/:farmId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({
    summary: 'Dépenses (filtre par période / catégorie / lot)',
  })
  @ApiParam({ name: 'farmId' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Query() query: ListExpensesQueryDto,
  ) {
    return this.expensesService.list(user, farmId, query);
  }

  @Post()
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({
    summary:
      'Nouvelle dépense catégorisée (CDCF). Option paidByCaisse : sortie de caisse automatique.',
  })
  @ApiParam({ name: 'farmId' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user, farmId, dto);
  }

  @Patch(':expenseId')
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({
    summary: 'Corriger une dépense (catégorie, libellé, fournisseur, lot)',
  })
  @ApiParam({ name: 'farmId' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('farmId') farmId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user, farmId, expenseId, dto);
  }
}
