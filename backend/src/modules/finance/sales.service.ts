import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { SaleStatus } from '../../common/enums/sale-status.enum.js';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../common/enums/payment-method.enum.js';
import {
  SaleItemProductType,
  SaleItemUnit,
} from '../../common/enums/sale-item-type.enum.js';
import {
  CashMovementType,
  CashMovementSource,
} from '../../common/enums/cash-session-status.enum.js';
import { AlertKind } from '../../common/enums/alert-level.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { BatchesService } from '../batches/batches.service.js';
import { FeedStockService } from '../feed-stock/feed-stock.service.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { InputKind } from '../../common/enums/input-kind.enum.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { Customer } from './entities/customer.entity.js';
import { CashSession } from './entities/cash-session.entity.js';
import { CashSessionStatus } from '../../common/enums/cash-session-status.enum.js';
import { CashMovement } from './entities/cash-movement.entity.js';
import { Payment } from './entities/payment.entity.js';
import { Sale } from './entities/sale.entity.js';
import { SaleItem } from './entities/sale-item.entity.js';
import { PaymentsService } from './payments.service.js';
import { RentabiliteService } from './rentabilite.service.js';
import { PdfService } from '../../common/services/pdf.service.js';
import { CreatePaymentDto } from './dto/payment.dto.js';
import { CreateSaleDto } from './dto/sale.dto.js';
import { FeedUnit } from '../../common/enums/food-type.enum.js';

const SALE_PREFIX = 'VTE';
const ITEM_LABELS: Record<SaleItemProductType, string> = {
  POULET_PIECE: 'Poulet à la pièce',
  POULET_KG: 'Poulet au kilo',
  OEUFS: 'Œufs (alvéoles)',
  PROVENDE: 'Provende',
  AUTRE: 'Article divers',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeReferenceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${SALE_PREFIX}-${date}-${suffix}`;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly itemRepo: Repository<SaleItem>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly farmsService: FarmsService,
    private readonly paymentsService: PaymentsService,
    private readonly rentabiliteService: RentabiliteService,
    private readonly feedStockService: FeedStockService,
    private readonly batchesService: BatchesService,
    private readonly alertsService: AlertsService,
    private readonly pdfService: PdfService,
  ) {}

  // ---------- Création (transaction POS) ----------

  async create(user: AuthUser, farmId: string, dto: CreateSaleDto) {
    const farm = await this.farmsService.assertAccessible(user, farmId);
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Au moins un article est requis.');
    }

    const involvedBatches = new Set<string>();

    const result = await this.dataSource.transaction(async (em) => {
      const saleRepo = em.getRepository(Sale);

      if (dto.customerId) {
        const customer = await em.getRepository(Customer).findOne({
          where: { id: dto.customerId, farmId },
        });
        if (!customer)
          throw new BadRequestException('Client introuvable dans cette ferme.');
      }

      if (dto.batchId) {
        await this.assertBatchInFarm(em, farmId, dto.batchId);
      }

      const sale = await saleRepo.save(
        saleRepo.create({
          farmId,
          referenceNumber: await this.nextReference(em),
          saleDate: dto.saleDate ?? todayStr(),
          totalAmountFcfa: 0,
          status: SaleStatus.SETTLED,
          customerId: dto.customerId ?? null,
          batchId: dto.batchId ?? null,
          createdById: user.id,
        }),
      );

      const items: SaleItem[] = [];
      let total = 0;
      for (const itemDto of dto.items) {
        const item = await this.createItemWithinTransaction(
          em,
          farmId,
          sale.id,
          user,
          itemDto as any,
        );
        total += item.amountFcfa;
        items.push(item);
        if (item.batchId) involvedBatches.add(item.batchId);
      }

      sale.totalAmountFcfa = total;
      const saleWithTotal = await saleRepo.save(sale);

      const payments: Payment[] = [];
      const seenKeys = new Set<string>();
      for (const p of dto.payments ?? []) {
        if (p.idempotencyKey) {
          if (seenKeys.has(p.idempotencyKey)) continue;
          seenKeys.add(p.idempotencyKey);
        }
        payments.push(
          await this.paymentsService.recordPayment(em, {
            farm: farm,
            sale: saleWithTotal,
            method: p.method ?? PaymentMethod.CASH,
            amountFcfa: p.amountFcfa,
            paymentDate: p.paymentDate,
            idempotencyKey: p.idempotencyKey,
            operatorId: user.id,
          }),
        );
      }

      sale.status =
        payments.reduce((s, p) => s + p.amountFcfa, 0) >= sale.totalAmountFcfa
          ? SaleStatus.SETTLED
          : SaleStatus.OUTSTANDING;
      const savedSale = await saleRepo.save(sale);

      return { savedSale, items, payments };
    });

    await this.afterSaleChange(farmId, [...involvedBatches]);

    return this.assembleResult(result.savedSale, result.items, result.payments);
  }

  private async nextReference(em: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = makeReferenceNumber();
      const existing = await em.getRepository(Sale).findOne({
        where: { referenceNumber: candidate },
      });
      if (!existing) return candidate;
    }
    throw new BadRequestException(
      'Impossible de générer une référence de vente unique. Réessayer.',
    );
  }

  private async createItemWithinTransaction(
    em: EntityManager,
    farmId: string,
    saleId: string,
    user: AuthUser,
    dto: {
      productType: SaleItemProductType;
      label?: string;
      quantity: number;
      unit?: SaleItemUnit;
      pieceCount?: number;
      unitPriceFcfa: number;
      batchId?: string;
      inputLotId?: string;
    },
  ): Promise<SaleItem> {
    const itemRepo = em.getRepository(SaleItem);
    const batchRepo = em.getRepository(ProductionBatch);
    const productType = dto.productType;
    const quantity = dto.quantity;
    const unit = dto.unit ?? this.defaultUnit(productType);
    const price = dto.unitPriceFcfa;

    let batchId: string | null = null;
    let pieceCount: number | null = null;
    let inputLotId: string | null = null;
    let batchValidated = false;

    if (productType === SaleItemProductType.POULET_PIECE) {
      batchId = this.requireBatch(dto.batchId, 'poulet à la pièce');
      if (unit !== SaleItemUnit.PIECE) {
        throw new BadRequestException(
          'Pour un poulet à la pièce, l’unité doit être PIECE.',
        );
      }
      const birds = Math.ceil(quantity);
      const batch = await this.loadBatch(batchRepo, farmId, batchId);
      if (batch.quantityAlive < birds) {
        throw new BadRequestException(
          `Stock insuffisant : il reste ${batch.quantityAlive} poulet(s) vivant(s) sur le lot, vente demandée ${birds}.`,
        );
      }
      batch.quantityAlive -= birds;
      await batchRepo.save(batch);
      pieceCount = birds;
      batchValidated = true;
    } else if (productType === SaleItemProductType.POULET_KG) {
      batchId = this.requireBatch(dto.batchId, 'poulet au kilo');
      if (unit !== SaleItemUnit.KG) {
        throw new BadRequestException(
          'Pour un poulet au kilo, l’unité doit être KG.',
        );
      }
      if (!dto.pieceCount || dto.pieceCount <= 0) {
        throw new BadRequestException(
          'Vente au kilo : indiquer le nombre de pièces (nb de poulets) pour décrémenter le cheptel vivant.',
        );
      }
      const batch = await this.loadBatch(batchRepo, farmId, batchId);
      if (batch.quantityAlive < dto.pieceCount) {
        throw new BadRequestException(
          `Stock insuffisant : il reste ${batch.quantityAlive} poulet(s) vivant(s) sur le lot, vente demandée ${dto.pieceCount}.`,
        );
      }
      batch.quantityAlive -= dto.pieceCount;
      await batchRepo.save(batch);
      pieceCount = dto.pieceCount;
      batchValidated = true;
    } else if (productType === SaleItemProductType.OEUFS) {
      if (unit !== SaleItemUnit.ALVEOLES) {
        throw new BadRequestException(
          'Pour une vente d’œufs, l’unité doit être ALVEOLES.',
        );
      }
      batchId = dto.batchId ?? null;
    } else if (productType === SaleItemProductType.PROVENDE) {
      if (unit !== SaleItemUnit.SAC && unit !== SaleItemUnit.KG) {
        throw new BadRequestException(
          'Pour la provende, l’unité doit être SAC ou KG.',
        );
      }
      inputLotId = dto.inputLotId ?? null;
      if (inputLotId != null) {
        const lot = await em.getRepository(InputLot).findOne({
          where: { id: inputLotId, farmId },
        });
        if (!lot || lot.kind !== InputKind.ALIMENT) {
          throw new BadRequestException(
            'Lot d’intrant alimentaire introuvable dans cette ferme (catégorie ALIMENT uniquement).',
          );
        }
        batchId = dto.batchId ?? lot.batchId ?? null;
      } else {
        batchId = dto.batchId ?? null;
      }
    } else {
      // AUTRE : aucune contrainte d'inventaire.
      batchId = dto.batchId ?? null;
    }

    // Les autres catégories (OEUFS, PROVENDE, AUTRE) n'ont pas passé loadBatch :
    // on vérifie que le lot rattaché appartient bien à cette ferme.
    if (batchId != null && !batchValidated) {
      await this.assertBatchInFarm(em, farmId, batchId);
    }

    const amountFcfa = Math.round(quantity * price);
    const item = await itemRepo.save(
      itemRepo.create({
        saleId,
        productType,
        label: dto.label ?? ITEM_LABELS[productType],
        quantity,
        unit,
        pieceCount,
        unitPriceFcfa: price,
        amountFcfa,
        batchId,
        inputLotId,
      }),
    );

    if (productType === SaleItemProductType.PROVENDE) {
      await this.feedStockService.recordFeedSale({
        farmId,
        inputLotId,
        batchId,
        saleItemId: item.id,
        quantity,
        unit: unit === SaleItemUnit.SAC ? FeedUnit.SAC : FeedUnit.KG,
        soldAt: todayStr(),
        createdById: user.id,
        em,
      });
    }

    return item;
  }

  private defaultUnit(productType: SaleItemProductType): SaleItemUnit {
    switch (productType) {
      case SaleItemProductType.POULET_PIECE:
        return SaleItemUnit.PIECE;
      case SaleItemProductType.POULET_KG:
        return SaleItemUnit.KG;
      case SaleItemProductType.OEUFS:
        return SaleItemUnit.ALVEOLES;
      case SaleItemProductType.PROVENDE:
        return SaleItemUnit.SAC;
      default:
        return SaleItemUnit.UNITE;
    }
  }

  private requireBatch(batchId: string | undefined, label: string): string {
    if (!batchId) {
      throw new BadRequestException(
        `Une vente de ${label} doit être rattachée à un lot de production (batchId).`,
      );
    }
    return batchId;
  }

  private async loadBatch(
    repo: Repository<ProductionBatch>,
    farmId: string,
    batchId: string,
  ): Promise<ProductionBatch> {
    const batch = await repo
      .createQueryBuilder('batch')
      .setLock('pessimistic_write')
      .where('batch.id = :id', { id: batchId })
      .andWhere('batch.farm_id = :farmId', { farmId })
      .getOne();
    if (!batch)
      throw new BadRequestException(
        'Lot de production introuvable dans cette ferme.',
      );
    return batch;
  }

  private async assertBatchInFarm(
    em: EntityManager,
    farmId: string,
    batchId: string,
  ): Promise<void> {
    const batch = await em.getRepository(ProductionBatch).findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new BadRequestException(
        'Lot de production introuvable dans cette ferme.',
      );
  }

  /** Vérifie que l'id feed sale existe bien dans la transaction (validate). */
  private async afterSaleChange(farmId: string, batchIds: string[]) {
    await Promise.all([
      this.feedStockService.evaluateStockAlerts(farmId),
      this.rentabiliteService.evaluateInvendus(farmId),
      Promise.all(
        batchIds.map((batchId) =>
          this.rentabiliteService.evaluateForBatch(farmId, batchId),
        ),
      ),
      Promise.all(
        batchIds.map((batchId) =>
          this.batchesService.runAdvisoryForBatch(batchId),
        ),
      ),
    ]);
  }

  // ---------- Lecture ----------

  async list(
    user: AuthUser,
    farmId: string,
    from?: string,
    to?: string,
    status?: SaleStatus,
  ): Promise<Sale[]> {
    await this.farmsService.assertAccessible(user, farmId);
    const qb = this.saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .where('sale.farm_id = :farmId', { farmId })
      .orderBy('sale.sale_date', 'DESC')
      .addOrderBy('sale.created_at', 'DESC');
    if (from) qb.andWhere('sale.sale_date >= :from', { from });
    if (to) qb.andWhere('sale.sale_date <= :to', { to });
    if (status) qb.andWhere('sale.status = :status', { status });
    return qb.getMany();
  }

  async getOne(
    user: AuthUser,
    farmId: string,
    saleId: string,
  ): Promise<Sale & { items: SaleItem[]; payments: Payment[] }> {
    await this.farmsService.assertAccessible(user, farmId);
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, farmId },
      relations: { customer: true },
    });
    if (!sale) throw new NotFoundException('Vente introuvable.');
    const [items, payments] = await Promise.all([
      this.itemRepo.find({
        where: { saleId },
        relations: { batch: true, inputLot: true },
      }),
      this.paymentRepo.find({
        where: { saleId },
        order: { paymentDate: 'ASC' },
      }),
    ]);
    return { ...sale, items, payments };
  }

  // ---------- Encaissement complémentaire ----------

  async addPayment(
    user: AuthUser,
    farmId: string,
    saleId: string,
    dto: CreatePaymentDto,
  ) {
    const farm = await this.farmsService.assertAccessible(user, farmId);
    const result = await this.dataSource.transaction(async (em) => {
      const sale = await em.getRepository(Sale).findOne({
        where: { id: saleId, farmId },
      });
      if (!sale) throw new NotFoundException('Vente introuvable.');
      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException(
          'Impossible d’encaisser sur une vente annulée.',
        );
      }
      const payment = await this.paymentsService.recordPayment(em, {
        farm,
        sale,
        method: dto.method ?? PaymentMethod.CASH,
        amountFcfa: dto.amountFcfa,
        paymentDate: dto.paymentDate,
        idempotencyKey: dto.idempotencyKey,
        operatorId: user.id,
      });
      const paid = await this.paidSum(em, saleId);
      if (paid >= sale.totalAmountFcfa && sale.status !== SaleStatus.SETTLED) {
        sale.status = SaleStatus.SETTLED;
        await em.getRepository(Sale).save(sale);
      }
      return payment;
    });

    await this.afterSaleChange(farmId, []);
    return result;
  }

  private async paidSum(em: EntityManager, saleId: string): Promise<number> {
    const payments = await em.getRepository(Payment).find({
      where: { saleId, status: PaymentStatus.CONFIRMED },
    });
    return payments.reduce((s, p) => s + p.amountFcfa, 0);
  }

  // ---------- Annulation (PROPRIÉTAIRE) avec réintégration du stock ----------

  async cancel(
    user: AuthUser,
    farmId: string,
    saleId: string,
    reason?: string,
  ) {
    await this.farmsService.assertAccessible(user, farmId);
    const involvedBatches = new Set<string>();
    await this.dataSource.transaction(async (em) => {
      const sale = await em.getRepository(Sale).findOne({
        where: { id: saleId, farmId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sale) throw new NotFoundException('Vente introuvable.');
      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException('Cette vente est déjà annulée.');
      }

      const items = await em.getRepository(SaleItem).find({
        where: { saleId },
      });
      const batchRepo = em.getRepository(ProductionBatch);
      const feedItems: SaleItem[] = [];

      for (const item of items) {
        if (
          (item.productType === SaleItemProductType.POULET_PIECE ||
            item.productType === SaleItemProductType.POULET_KG) &&
          item.batchId
        ) {
          const batch = await batchRepo.findOne({
            where: { id: item.batchId },
          });
          if (batch) {
            const birds = item.pieceCount ?? Math.ceil(item.quantity);
            batch.quantityAlive += birds;
            await batchRepo.save(batch);
          }
          involvedBatches.add(item.batchId);
        }
        if (item.productType === SaleItemProductType.PROVENDE) {
          feedItems.push(item);
          if (item.batchId) involvedBatches.add(item.batchId);
        }
      }

      for (const item of feedItems) {
        await this.feedStockService.revertFeedSale(item.id, em);
      }

      const cashSession = await em.getRepository(CashSession).findOne({
        where: { farmId, status: CashSessionStatus.OPEN },
      });
      const confirmed = await em.getRepository(Payment).find({
        where: { saleId, status: PaymentStatus.CONFIRMED },
      });
      for (const payment of confirmed) {
        payment.status = PaymentStatus.REFUNDED;
        await em.getRepository(Payment).save(payment);
        if (cashSession) {
          await em.getRepository(CashMovement).save(
            em.getRepository(CashMovement).create({
              farmId,
              cashSessionId: cashSession.id,
              type: CashMovementType.OUT,
              source: CashMovementSource.REFUND,
              amountFcfa: payment.amountFcfa,
              reason: `Remboursement vente annulée ${sale.referenceNumber}`,
              saleId: sale.id,
              movementDate: todayStr(),
              createdById: user.id,
            }),
          );
        }
      }

      sale.status = SaleStatus.CANCELLED;
      sale.cancelledAt = new Date();
      sale.cancelledReason = reason ?? null;
      await em.getRepository(Sale).save(sale);
    });

    await this.afterSaleChange(farmId, [...involvedBatches]);
    return this.getOne(user, farmId, saleId);
  }

  // ---------- Reçu PDF ----------

  async generateReceipt(user: AuthUser, farmId: string, saleId: string) {
    const farm = await this.farmsService.assertAccessible(user, farmId);
    const info = await this.getOne(user, farmId, saleId);
    if (info.status === SaleStatus.CANCELLED) {
      throw new BadRequestException(
        'Impossible de générer un reçu pour une vente annulée.',
      );
    }
    const confirmed = await this.paymentRepo.find({
      where: { saleId, status: PaymentStatus.CONFIRMED },
    });
    const paid = confirmed.reduce((s, p) => s + p.amountFcfa, 0);
    return this.pdfService.createReceiptPdf({
      referenceNumber: info.referenceNumber,
      saleDate: info.saleDate,
      farmName: farm.name,
      customerName: info.customer?.fullName ?? null,
      items: info.items.map((item) => ({
        label: item.label ?? item.productType,
        quantity: `${item.quantity} ${item.unit}`,
        unitPriceFcfa: item.unitPriceFcfa,
        amountFcfa: item.amountFcfa,
      })),
      totalAmountFcfa: info.totalAmountFcfa,
      paidAmountFcfa: paid,
      remainingFcfa: Math.max(0, info.totalAmountFcfa - paid),
      method: confirmed[0]?.method ?? 'ESPECES',
    });
  }

  /** Warnings advisory non bloquants renvoyés avec la réponse de création. */
  private async assembleResult(
    sale: Sale,
    items: SaleItem[],
    payments: Payment[],
  ) {
    const warnings = await this.collectWarnings(sale.farmId, [
      sale.batchId,
      ...items.map((i) => i.batchId).filter(Boolean),
    ]);
    return { sale, items, payments, warnings };
  }

  private async collectWarnings(
    farmId: string,
    batchIds: (string | null)[],
  ): Promise<unknown[]> {
    const unique = [...new Set(batchIds.filter(Boolean))];
    if (unique.length === 0) return [];
    const alerts = await this.alertsService.listForFarm(farmId);
    return alerts
      .filter(
        (a) =>
          a.batchId != null &&
          unique.includes(a.batchId) &&
          (a.kind === AlertKind.DELAI_ATTENTE ||
            a.kind === AlertKind.VENTE ||
            a.kind === AlertKind.TRACABILITE),
      )
      .map((a) => ({
        kind: a.kind,
        level: a.level,
        message: a.message,
        recommendation: a.recommendation,
      }));
  }
}
