import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { CarcassTransferStatus } from '../../common/enums/carcass-transfer-status.enum.js';
import { PointOfSaleKind } from '../../common/enums/point-of-sale-kind.enum.js';
import { SlaughterStatus } from '../../common/enums/slaughter-status.enum.js';
import { SlaughterType } from '../../common/enums/slaughter-type.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { SlaughterOrder } from '../slaughter/entities/slaughter-order.entity.js';
import { CreateCarcassTransferDto } from './dto/carcass-transfer.dto.js';
import { CarcassTransfer } from './entities/carcass-transfer.entity.js';
import { PointOfSale } from './entities/point-of-sale.entity.js';

@Injectable()
export class CarcassTransfersService {
  constructor(
    @InjectRepository(CarcassTransfer)
    private readonly repo: Repository<CarcassTransfer>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly farmsService: FarmsService,
  ) {}

  /** Liste les transferts de carcasses de la ferme (filtrable par boutique). */
  async list(
    user: AuthUser,
    farmId: string,
    pointOfSaleId?: string,
  ): Promise<CarcassTransfer[]> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.repo.find({
      where: {
        farmId,
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Déplace des carcasses du pool d'abattoir de la ferme vers une boutique.
   * Invariants : source PROCESSED/ABATTU, stock suffisant, destination boutique
   * active. Le pool de l'ordre est décrémenté, bilan tracé dans le transfert.
   */
  async create(
    user: AuthUser,
    farmId: string,
    dto: CreateCarcassTransferDto,
  ): Promise<CarcassTransfer> {
    await this.farmsService.assertAccessible(user, farmId);
    const id = await this.dataSource.transaction(async (em) => {
      const order = await em
        .getRepository(SlaughterOrder)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id: dto.slaughterOrderId })
        .andWhere('o.farm_id = :farmId', { farmId })
        .getOne();
      if (!order) {
        throw new BadRequestException(
          'Ordre d’abattage introuvable dans cette ferme (source carcasse).',
        );
      }
      if (order.status !== SlaughterStatus.PROCESSED) {
        throw new BadRequestException(
          'Cet ordre d’abattage doit être traité (PROCESSED) avant tout transfert de carcasses.',
        );
      }
      if (order.slaughterType !== SlaughterType.ABATTU) {
        throw new BadRequestException(
          'Cet ordre d’abattage est « vivant » : aucune carcasse à transférer.',
        );
      }
      if (order.carcassesAvailable < dto.quantity) {
        throw new BadRequestException(
          `Carcasses insuffisantes : ${order.carcassesAvailable} carcasse(s) disponible(s) sur cet ordre, transfert demandé ${dto.quantity}.`,
        );
      }

      const pos = await em.getRepository(PointOfSale).findOne({
        where: { id: dto.pointOfSaleId, farmId },
      });
      if (!pos) {
        throw new BadRequestException(
          'Point de vente introuvable dans cette ferme.',
        );
      }
      if (pos.kind !== PointOfSaleKind.BOUTIQUE) {
        throw new BadRequestException(
          'Seule une boutique (point de vente externe) peut recevoir un transfert de carcasses : la ferme vend directement son pool d’abattoir.',
        );
      }
      if (pos.isActive === false) {
        throw new BadRequestException(
          'Point de vente inactif (boutique désactivée).',
        );
      }

      order.carcassesAvailable -= dto.quantity;
      await em.getRepository(SlaughterOrder).save(order);

      const transfer = await em.getRepository(CarcassTransfer).save(
        em.getRepository(CarcassTransfer).create({
          farmId,
          slaughterOrderId: order.id,
          pointOfSaleId: pos.id,
          batchId: order.batchId,
          quantity: dto.quantity,
          quantitySold: 0,
          status: CarcassTransferStatus.TRANSFERRED,
          createdById: user.id,
        }),
      );
      return transfer.id;
    });
    return this.mustGet(farmId, id);
  }

  /**
   * Annule un transfert : les carcasses non encore vendues reviennent au pool
   * de l'ordre d'abattage source, le transfert est marqué CANCELLED.
   */
  async cancel(
    user: AuthUser,
    farmId: string,
    transferId: string,
  ): Promise<CarcassTransfer> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.dataSource.transaction(async (em) => {
      const transfer = await em
        .getRepository(CarcassTransfer)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id: transferId })
        .andWhere('t.farm_id = :farmId', { farmId })
        .getOne();
      if (!transfer) {
        throw new NotFoundException(
          'Transfert de carcasses introuvable dans cette ferme.',
        );
      }
      if (transfer.status !== CarcassTransferStatus.TRANSFERRED) {
        throw new BadRequestException('Ce transfert est déjà annulé.');
      }

      const remaining = transfer.quantity - transfer.quantitySold;
      if (remaining > 0) {
        const order = await em
          .getRepository(SlaughterOrder)
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .where('o.id = :id', { id: transfer.slaughterOrderId })
          .andWhere('o.farm_id = :farmId', { farmId })
          .getOne();
        if (!order) {
          throw new BadRequestException(
            'Ordre d’abattage source introuvable (transfert orphelin).',
          );
        }
        order.carcassesAvailable += remaining;
        await em.getRepository(SlaughterOrder).save(order);
      }

      transfer.status = CarcassTransferStatus.CANCELLED;
      transfer.cancelledAt = new Date();
      await em.getRepository(CarcassTransfer).save(transfer);
    });
    return this.mustGet(farmId, transferId);
  }

  private async mustGet(
    farmId: string,
    transferId: string,
  ): Promise<CarcassTransfer> {
    const transfer = await this.repo.findOne({
      where: { id: transferId, farmId },
    });
    if (!transfer) {
      throw new NotFoundException(
        'Transfert de carcasses introuvable dans cette ferme.',
      );
    }
    return transfer;
  }
}