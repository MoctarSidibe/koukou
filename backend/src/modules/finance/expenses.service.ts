import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import {
  CashMovementSource,
  CashMovementType,
} from '../../common/enums/cash-session-status.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { CashSession } from './entities/cash-session.entity.js';
import { CashSessionStatus } from '../../common/enums/cash-session-status.enum.js';
import { CashMovement } from './entities/cash-movement.entity.js';
import { Expense } from './entities/expense.entity.js';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ListExpensesQueryDto,
} from './dto/expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(CashMovement)
    private readonly movementRepo: Repository<CashMovement>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly farmsService: FarmsService,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    user: AuthUser,
    farmId: string,
    query: ListExpensesQueryDto,
  ): Promise<Expense[]> {
    await this.farmsService.assertAccessible(user, farmId);
    const qb = this.expenseRepo
      .createQueryBuilder('expense')
      .where('expense.farm_id = :farmId', { farmId })
      .orderBy('expense.expense_date', 'DESC')
      .addOrderBy('expense.created_at', 'DESC');
    if (query.from)
      qb.andWhere('expense.expense_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('expense.expense_date <= :to', { to: query.to });
    if (query.category)
      qb.andWhere('expense.category = :category', { category: query.category });
    if (query.batchId)
      qb.andWhere('expense.batch_id = :batchId', { batchId: query.batchId });
    return qb.getMany();
  }

  async create(
    user: AuthUser,
    farmId: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.resolveBatch(farmId, dto.batchId);

    return this.dataSource.transaction(async (em) => {
      let cashMovement: CashMovement | null = null;
      if (dto.paidByCaisse) {
        const session = await em.getRepository(CashSession).findOne({
          where: { farmId, status: CashSessionStatus.OPEN },
        });
        if (!session) {
          throw new BadRequestException(
            'Aucune session de caisse ouverte : impossible de payer depuis la caisse.',
          );
        }
        const movements = await em.getRepository(CashMovement).find({
          where: { cashSessionId: session.id },
        });
        let inFcfa = 0;
        let outFcfa = 0;
        for (const m of movements) {
          if (m.type === CashMovementType.IN) inFcfa += m.amountFcfa;
          else outFcfa += m.amountFcfa;
        }
        const available = session.openingBalanceFcfa + inFcfa - outFcfa;
        if (dto.amountFcfa > available) {
          throw new BadRequestException(
            `Solde de caisse insuffisant (${available} FCFA) pour cette dépense de ${dto.amountFcfa} FCFA. Une caisse ne peut pas être négative.`,
          );
        }
        cashMovement = await em.getRepository(CashMovement).save(
          em.getRepository(CashMovement).create({
            farmId,
            cashSessionId: session.id,
            type: CashMovementType.OUT,
            source: CashMovementSource.EXPENSE,
            amountFcfa: dto.amountFcfa,
            reason: dto.label ?? dto.category,
            movementDate:
              dto.expenseDate ?? new Date().toISOString().slice(0, 10),
            createdById: user.id,
          }),
        );
      }

      return em.getRepository(Expense).save(
        em.getRepository(Expense).create({
          farmId,
          expenseDate: dto.expenseDate ?? new Date().toISOString().slice(0, 10),
          category: dto.category,
          amountFcfa: dto.amountFcfa,
          label: dto.label ?? null,
          supplier: dto.supplier ?? null,
          notes: dto.notes ?? null,
          paidByCaisse: dto.paidByCaisse ?? false,
          batchId: batch?.id ?? null,
          cashMovementId: cashMovement?.id ?? null,
          createdById: user.id,
        }),
      );
    });
  }

  async update(
    user: AuthUser,
    farmId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    await this.farmsService.assertAccessible(user, farmId);
    const expense = await this.expenseRepo.findOne({
      where: { id: expenseId, farmId },
    });
    if (!expense) throw new NotFoundException('Dépense introuvable.');
    if (dto.category != null) expense.category = dto.category;
    if (dto.label != null) expense.label = dto.label;
    if (dto.supplier != null) expense.supplier = dto.supplier;
    if (dto.notes != null) expense.notes = dto.notes;
    if (dto.batchId != null || dto.batchId === null) {
      const batch = await this.resolveBatch(farmId, dto.batchId);
      expense.batchId = batch?.id ?? null;
    }
    if (dto.label != null && expense.cashMovementId != null) {
      await this.movementRepo.update(
        { id: expense.cashMovementId },
        { reason: dto.label ?? expense.category },
      );
    }
    return this.expenseRepo.save(expense);
  }

  private async resolveBatch(
    farmId: string,
    batchId?: string,
  ): Promise<ProductionBatch | null> {
    if (!batchId) return null;
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch) throw new NotFoundException('Lot de production introuvable.');
    return batch;
  }
}
