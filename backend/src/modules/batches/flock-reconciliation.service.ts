import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SaleItemProductType } from '../../common/enums/sale-item-type.enum.js';
import { SaleStatus } from '../../common/enums/sale-status.enum.js';
import { SlaughterStatus } from '../../common/enums/slaughter-status.enum.js';
import { OrderStatus } from '../../common/enums/order-status.enum.js';
import { SaleItem } from '../finance/entities/sale-item.entity.js';
import { Sale } from '../finance/entities/sale.entity.js';
import { SlaughterOrder } from '../slaughter/entities/slaughter-order.entity.js';
import { HealthEvent } from '../sanitary/entities/health-event.entity.js';
import { HealthEventKind } from '../../common/enums/health-event-kind.enum.js';

/**
 * Reconcilie les sorties réelles d'un lot : ventes POULET (PIECE/KG, nettes des
 * annulations), ventes ABATTU directes (sans ordre d'abattage source, elles
 * décrémentent le lot au POS) et abattages PROCESSED. Le cheptel vivant doit
 * rester en phase avec ces flux pour que la garde de stock du POS et les
 * métriques reflètent la réalité (tout doit rester synchronisé).
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
    @InjectRepository(HealthEvent)
    private readonly healthEventRepo: Repository<HealthEvent>,
  ) {}

  async netSoldBirds(
    batchId: string,
    em?: EntityManager,
    asOf?: string,
  ): Promise<number> {
    const repo = em ? em.getRepository(SaleItem) : this.saleItemRepo;
    let qb = repo
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
          SaleItemProductType.ABATTU_PIECE,
          SaleItemProductType.ABATTU_KG,
        ],
      });
    if (asOf) {
      qb = qb.andWhere('sale.sale_date <= :asOf', { asOf });
    }
    const row = await qb
      .andWhere('item.source_slaughter_order_id IS NULL')
      // Une vente enveloppe d'un bon de commande NON livré/annulé ne sort pas
      // du cheptel : les oiseaux sont réservés (assertBirdsAvailable), jamais
      // décrémentés avant la livraison. Les compter ici et les resoustraire à
      // la réservation les décrirait deux fois.
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM orders o WHERE o.sale_id = sale.id AND o.status IN (:...openStatuses))',
        { openStatuses: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
      )
      .select('COALESCE(SUM(COALESCE(item.piece_count, 0)), 0)', 'total')
      .getRawOne();
    return Math.max(0, Number(row?.total ?? 0));
  }

  async netSlaughteredBirds(
    batchId: string,
    em?: EntityManager,
    asOf?: string,
  ): Promise<number> {
    const repo = em ? em.getRepository(SlaughterOrder) : this.slaughterRepo;
    let qb = repo
      .createQueryBuilder('order')
      .where('order.batch_id = :batchId', { batchId })
      .andWhere('order.status = :processed', {
        processed: SlaughterStatus.PROCESSED,
      });
    if (asOf) {
      qb = qb.andWhere('order.planned_date <= :asOf', { asOf });
    }
    const row = await qb
      .select('COALESCE(SUM(order.bird_count), 0)', 'total')
      .getRawOne();
    return Math.max(0, Number(row?.total ?? 0));
  }

  /**
   * Réforme/culling sanitaire (DISTINCT de l'abattage de production) ET pic de
   * mortalité déclaré en événement sanitaire : somme des quantités des
   * événements santé `REFORME` et `MORTALITE` enregistrés sur le lot. Ces deux
   * événements décrémentent `quantityAlive` à la création (et le réintègrent à
   * la suppression) ; leur agrégat fait partie des sorties de cheptel de la
   * réconciliation pour rester en phase à chaque saisie journalière.
   */
  async netSanitaryRemovedBirds(
    batchId: string,
    em?: EntityManager,
    asOf?: string,
  ): Promise<number> {
    const repo = em ? em.getRepository(HealthEvent) : this.healthEventRepo;
    let qb = repo
      .createQueryBuilder('event')
      .where('event.batch_id = :batchId', { batchId })
      .andWhere('event.kind IN (:...kinds)', {
        kinds: [HealthEventKind.REFORME, HealthEventKind.MORTALITE],
      });
    if (asOf) {
      qb = qb.andWhere('event.occurred_at <= :asOf', { asOf });
    }
    const row = await qb
      .select('COALESCE(SUM(event.quantity), 0)', 'total')
      .getRawOne();
    return Math.max(0, Number(row?.total ?? 0));
  }
}
