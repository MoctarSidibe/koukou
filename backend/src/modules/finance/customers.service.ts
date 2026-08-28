import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FarmsService } from '../farms/farms.service.js';
import { SaleStatus } from '../../common/enums/sale-status.enum.js';
import { PaymentStatus } from '../../common/enums/payment-method.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { Customer } from './entities/customer.entity.js';
import { Sale } from './entities/sale.entity.js';
import { SaleItem } from './entities/sale-item.entity.js';
import { Payment } from './entities/payment.entity.js';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto.js';

export interface CustomerBalance {
  totalInvoicedFcfa: number;
  paidFcfa: number;
  outstandingFcfa: number;
}

export type CustomerSegment = 'NOUVEAU' | 'REGULIER' | 'TOP';

export interface CustomerStats {
  visits: number;
  totalSpentFcfa: number;
  avgBasketFcfa: number;
  lastPurchaseDate: string | null;
  favorites: { productType: string; label: string; quantity: number }[];
  segment: CustomerSegment;
  balance: CustomerBalance;
}

/** Normalise un numéro de téléphone (espaces et tirets ignorés). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly farmsService: FarmsService,
    private readonly referenceConstants: ReferenceConstantsService,
  ) {}

  async create(
    user: AuthUser,
    farmId: string,
    dto: CreateCustomerDto,
  ): Promise<Customer> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.customerRepo.save(
      this.customerRepo.create({
        farmId,
        fullName: dto.fullName.trim(),
        phone: dto.phone ? normalizePhone(dto.phone) : null,
        email: dto.email ?? null,
        city: dto.city ?? null,
        notes: dto.notes ?? null,
        createdById: user.id,
      }),
    );
  }

  async update(
    user: AuthUser,
    farmId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    await this.farmsService.assertAccessible(user, farmId);
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, farmId },
    });
    if (!customer) throw new NotFoundException('Client introuvable.');
    if (dto.fullName != null) customer.fullName = dto.fullName.trim();
    if (dto.phone != null)
      customer.phone = dto.phone ? normalizePhone(dto.phone) : null;
    if (dto.email != null) customer.email = dto.email;
    if (dto.city != null) customer.city = dto.city;
    if (dto.notes != null) customer.notes = dto.notes;
    return this.customerRepo.save(customer);
  }

  async list(user: AuthUser, farmId: string): Promise<Customer[]> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.customerRepo.find({
      where: { farmId },
      order: { fullName: 'ASC' },
    });
  }

  async listWithBalances(
    user: AuthUser,
    farmId: string,
  ): Promise<
    (Customer & { balance: CustomerBalance; segment: CustomerSegment })[]
  > {
    await this.farmsService.assertAccessible(user, farmId);
    const [customers, constants] = await Promise.all([
      this.customerRepo.find({
        where: { farmId },
        order: { fullName: 'ASC' },
      }),
      this.loadSegmentConstants(),
    ]);
    const rows = await this.customerRepo.manager
      .createQueryBuilder()
      .select('sale.customer_id', 'customerId')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COALESCE(SUM(sale.total_amount_fcfa), 0)', 'spent')
      .from('sales', 'sale')
      .where('sale.farm_id = :farmId', { farmId })
      .andWhere('sale.customer_id IS NOT NULL')
      .andWhere('sale.status != :cancelled', {
        cancelled: SaleStatus.CANCELLED,
      })
      .groupBy('sale.customer_id')
      .getRawMany();
    const byId = new Map<string, { visits: number; spent: number }>();
    for (const row of rows) {
      byId.set(row.customerId, {
        visits: Number(row.visits),
        spent: Number(row.spent),
      });
    }
    return Promise.all(
      customers.map(async (c) => {
        const stats = byId.get(c.id) ?? { visits: 0, spent: 0 };
        return {
          ...c,
          balance: await this.getCustomerFinance(farmId, c.id),
          segment: this.computeSegment(stats.visits, stats.spent, constants),
        };
      }),
    );
  }

  /** Solde à recouvrer : ventes non annulées − paiements confirmés. */
  async getBalance(
    user: AuthUser,
    farmId: string,
    customerId: string,
  ): Promise<CustomerBalance> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertCustomerInFarm(farmId, customerId);
    return this.getCustomerFinance(farmId, customerId);
  }

  /** Profil d'un client : coordonnées + solde + segment. */
  async getOne(
    user: AuthUser,
    farmId: string,
    customerId: string,
  ): Promise<
    Customer & { balance: CustomerBalance; segment: CustomerSegment }
  > {
    await this.farmsService.assertAccessible(user, farmId);
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, farmId },
    });
    if (!customer) throw new NotFoundException('Client introuvable.');
    const [balance, segment] = await Promise.all([
      this.getCustomerFinance(farmId, customerId),
      this.getSegment(farmId, customerId),
    ]);
    return { ...customer, balance, segment };
  }

  /** Historique d'achats : ventes non annulées avec articles et paiements. */
  async history(
    user: AuthUser,
    farmId: string,
    customerId: string,
  ): Promise<(Sale & { items: SaleItem[]; payments: Payment[] })[]> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertCustomerInFarm(farmId, customerId);
    const manager = this.customerRepo.manager;
    const sales = await manager.getRepository(Sale).find({
      where: {
        farmId,
        customerId,
        status: In([SaleStatus.SETTLED, SaleStatus.OUTSTANDING]),
      },
      order: { saleDate: 'DESC', createdAt: 'DESC' },
      relations: { items: true },
    });
    const ids = sales.map((s) => s.id);
    const payments =
      ids.length > 0
        ? await manager.getRepository(Payment).find({
            where: { saleId: In(ids) },
            order: { paymentDate: 'ASC' },
          })
        : [];
    const bySaleId = new Map<string, Payment[]>();
    for (const p of payments) {
      const list = bySaleId.get(p.saleId) ?? [];
      list.push(p);
      bySaleId.set(p.saleId, list);
    }
    return sales.map((sale) => ({
      ...sale,
      payments: bySaleId.get(sale.id) ?? [],
    }));
  }

  /** Statistiques (visites, dépenses, panier moyen, favoris, segment). */
  async stats(
    user: AuthUser,
    farmId: string,
    customerId: string,
  ): Promise<CustomerStats> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertCustomerInFarm(farmId, customerId);
    const manager = this.customerRepo.manager;
    const [constants, rows, favorites] = await Promise.all([
      this.loadSegmentConstants(),
      manager
        .createQueryBuilder()
        .select(`to_char(sale.sale_date, 'YYYY-MM-DD')`, 'saleDate')
        .addSelect('sale.total_amount_fcfa', 'total')
        .from('sales', 'sale')
        .where('sale.farm_id = :farmId', { farmId })
        .andWhere('sale.customer_id = :customerId', { customerId })
        .andWhere('sale.status != :cancelled', {
          cancelled: SaleStatus.CANCELLED,
        })
        .orderBy('sale.sale_date', 'ASC')
        .getRawMany(),
      manager
        .createQueryBuilder()
        .select('item.product_type', 'type')
        .addSelect('MAX(item.label)', 'label')
        .addSelect('SUM(item.quantity)', 'quantity')
        .from('sale_items', 'item')
        .innerJoin('sales', 'sale', 'sale.id = item.sale_id')
        .where('sale.farm_id = :farmId', { farmId })
        .andWhere('sale.customer_id = :customerId', { customerId })
        .andWhere('sale.status != :cancelled', {
          cancelled: SaleStatus.CANCELLED,
        })
        .groupBy('item.product_type')
        .orderBy('quantity', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);
    const visits = rows.length;
    const totalSpentFcfa = rows.reduce(
      (s, r) => s + Number(r.total),
      0,
    );
    const lastPurchaseDate = visits > 0 ? String(rows[visits - 1].saleDate) : null;
    const balance = await this.getCustomerFinance(farmId, customerId);
    return {
      visits,
      totalSpentFcfa,
      avgBasketFcfa: visits > 0 ? Math.round(totalSpentFcfa / visits) : 0,
      lastPurchaseDate,
      favorites: favorites.map((f) => ({
        productType: String(f.type),
        label: String(f.label ?? f.type),
        quantity: Number(f.quantity),
      })),
      segment: this.computeSegment(visits, totalSpentFcfa, constants),
      balance,
    };
  }

  /** Agrégats financiers d'un client (utilisé par le portefeuille P&L). */
  async getCustomerFinance(
    farmId: string,
    customerId: string,
  ): Promise<CustomerBalance> {
    const manager = this.customerRepo.manager;

    const invoicedRow: { total: number } | undefined = await manager
      .createQueryBuilder()
      .select('COALESCE(SUM(sale.total_amount_fcfa), 0)', 'total')
      .from('sales', 'sale')
      .where('sale.customer_id = :customerId', { customerId })
      .andWhere('sale.farm_id = :farmId', { farmId })
      .andWhere('sale.status != :cancelled', {
        cancelled: SaleStatus.CANCELLED,
      })
      .getRawOne();

    const paidRow: { total: number } | undefined = await manager
      .createQueryBuilder()
      .select('COALESCE(SUM(payment.amount_fcfa), 0)', 'total')
      .from('payments', 'payment')
      .innerJoin('sales', 'sale', 'sale.id = payment.sale_id')
      .where('sale.customer_id = :customerId', { customerId })
      .andWhere('sale.farm_id = :farmId', { farmId })
      .andWhere('sale.status != :cancelled', {
        cancelled: SaleStatus.CANCELLED,
      })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.CONFIRMED,
      })
      .getRawOne();

    const invoiced = Number(invoicedRow?.total ?? 0);
    const paid = Number(paidRow?.total ?? 0);
    return {
      totalInvoicedFcfa: invoiced,
      paidFcfa: paid,
      outstandingFcfa: Math.max(0, invoiced - paid),
    };
  }

  private async getSegment(
    farmId: string,
    customerId: string,
  ): Promise<CustomerSegment> {
    const constants = await this.loadSegmentConstants();
    const row: { visits?: string; spent?: string } | undefined =
      await this.customerRepo.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'visits')
        .addSelect('COALESCE(SUM(sale.total_amount_fcfa), 0)', 'spent')
        .from('sales', 'sale')
        .where('sale.farm_id = :farmId', { farmId })
        .andWhere('sale.customer_id = :customerId', { customerId })
        .andWhere('sale.status != :cancelled', {
          cancelled: SaleStatus.CANCELLED,
        })
        .getRawOne();
    return this.computeSegment(
      Number(row?.visits ?? 0),
      Number(row?.spent ?? 0),
      constants,
    );
  }

  private async loadSegmentConstants(): Promise<{
    topMinVisits: number;
    topMinFcfa: number;
    regularMinVisits: number;
  }> {
    const [topMinVisits, topMinFcfa, regularMinVisits] = await Promise.all([
      this.referenceConstants.get(
        ReferenceKey.CUSTOMER_SEGMENT_TOP_MIN_VISITS,
        6,
      ),
      this.referenceConstants.get(
        ReferenceKey.CUSTOMER_SEGMENT_TOP_MIN_FCFA,
        100000,
      ),
      this.referenceConstants.get(
        ReferenceKey.CUSTOMER_SEGMENT_REGULAR_MIN_VISITS,
        2,
      ),
    ]);
    return { topMinVisits, topMinFcfa, regularMinVisits };
  }

  private computeSegment(
    visits: number,
    totalSpentFcfa: number,
    constants: {
      topMinVisits: number;
      topMinFcfa: number;
      regularMinVisits: number;
    },
  ): CustomerSegment {
    if (visits === 0) return 'NOUVEAU';
    if (
      visits >= constants.topMinVisits ||
      totalSpentFcfa >= constants.topMinFcfa
    ) {
      return 'TOP';
    }
    if (visits >= constants.regularMinVisits) return 'REGULIER';
    return 'NOUVEAU';
  }

  private async assertCustomerInFarm(
    farmId: string,
    customerId: string,
  ): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, farmId },
    });
    if (!customer) throw new NotFoundException('Client introuvable.');
    return customer;
  }
}