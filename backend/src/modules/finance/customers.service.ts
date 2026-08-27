import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { FarmsService } from '../farms/farms.service.js';
import { SaleStatus } from '../../common/enums/sale-status.enum.js';
import { PaymentStatus } from '../../common/enums/payment-method.enum.js';
import { Customer } from './entities/customer.entity.js';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto.js';

export interface CustomerBalance {
  totalInvoicedFcfa: number;
  paidFcfa: number;
  outstandingFcfa: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly farmsService: FarmsService,
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
        phone: dto.phone ?? null,
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
    if (dto.phone != null) customer.phone = dto.phone;
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
  ): Promise<(Customer & { balance: CustomerBalance })[]> {
    await this.farmsService.assertAccessible(user, farmId);
    const customers = await this.customerRepo.find({
      where: { farmId },
      order: { fullName: 'ASC' },
    });
    return Promise.all(
      customers.map(async (c) => ({
        ...c,
        balance: await this.getCustomerFinance(farmId, c.id),
      })),
    );
  }

  /** Solde à recouvrer : ventes non annulées − paiements confirmés. */
  async getBalance(
    user: AuthUser,
    farmId: string,
    customerId: string,
  ): Promise<CustomerBalance> {
    await this.farmsService.assertAccessible(user, farmId);
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, farmId },
    });
    if (!customer) throw new NotFoundException('Client introuvable.');
    return this.getCustomerFinance(farmId, customerId);
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
}
