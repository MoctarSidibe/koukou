import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SaleItemProductType } from '../../common/enums/sale-item-type.enum.js';
import { SaleStatus } from '../../common/enums/sale-status.enum.js';
import { SlaughterStatus } from '../../common/enums/slaughter-status.enum.js';
import { SaleItem } from '../finance/entities/sale-item.entity.js';
import { Sale } from '../finance/entities/sale.entity.js';
import { SlaughterOrder } from '../slaughter/entities/slaughter-order.entity.js';

/**
 * Reconcilie les sorties réelles d'un lot : ventes POULET (PIECE/KG, nettes des
 * annulations) et abattages PROCESSED. Le cheptel vivant doit rester en phase
 * avec ces flux pour que la garde de stock du POS et les métriques reflètent
 * la réalité (tout doit rester synchronisé).
 */
@Injectable()
export class FlockReconciliationService {
  constructor(
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SlaughterOrder)
    private readonly slaughterRepo: Repository<SlaughterOrder>,
  ) {}

  async netSoldBirds(batchId: string, em?: EntityManager): Promise<number> {
    const repo = em ? em.getRepository(SaleItem) : this.saleItemRepo;
    const row = await repo
      .createQueryBuilder('item')
      .innerJoin(
        Sale,
        'sale',
        'sale.id = item.sale_id AND sale.status <> :cancelled',
        { cancelled: SaleStatus.CANCELLED },
      )
      .where('item.batch_id = :batchId', { batchId })
      .andWhere('item.product_type IN (:...types)', {
        types: [
          SaleItemProductType.POULET_PIECE,
          SaleItemProductType.POULET_KG,
        ],
      })
      .select('COALESCE(SUM(COALESCE(item.piece_count, 0)), 0)', 'total')
      .getRawOne();
    return Math.max(0, Number(row?.total ?? 0));
  }

  async netSlaughteredBirds(batchId: string, em?: EntityManager): Promise<number> {
    const repo = em ? em.getRepository(SlaughterOrder) : this.slaughterRepo;
    const row = await repo
      .createQueryBuilder('order')
      .where('order.batch_id = :batchId', { batchId })
      .andWhere('order.status = :processed', {
        processed: SlaughterStatus.PROCESSED,
      })
      .select('COALESCE(SUM(order.bird_count), 0)', 'total')
      .getRawOne();
    return Math.max(0, Number(row?.total ?? 0));
  }
}
