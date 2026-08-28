import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import {
  CashMovementSource,
  CashMovementType,
  CashSessionStatus,
} from '../../common/enums/cash-session-status.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { CashSession } from './entities/cash-session.entity.js';
import { CashMovement } from './entities/cash-movement.entity.js';
import {
  OpenCashSessionDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
} from './dto/caisse.dto.js';

export interface CaisseSummary {
  session: CashSession;
  movements: CashMovement[];
  expectedBalanceFcfa: number;
  inFcfa: number;
  outFcfa: number;
}

@Injectable()
export class CaisseService {
  constructor(
    @InjectRepository(CashSession)
    private readonly sessionRepo: Repository<CashSession>,
    @InjectRepository(CashMovement)
    private readonly movementRepo: Repository<CashMovement>,
    private readonly farmsService: FarmsService,
  ) {}

  async open(
    user: AuthUser,
    farmId: string,
    dto: OpenCashSessionDto,
  ): Promise<CashSession> {
    await this.farmsService.assertAccessible(user, farmId);
    const open = await this.findOpen(farmId);
    if (open) {
      throw new BadRequestException(
        `Une session de caisse est déjà ouverte depuis le ${open.openedAt}. La clôturer avant d'en ouvrir une nouvelle.`,
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    return this.sessionRepo.save(
      this.sessionRepo.create({
        farmId,
        status: CashSessionStatus.OPEN,
        openedAt: dto.openedAt ?? today,
        openingBalanceFcfa: dto.openingBalanceFcfa,
        openedById: user.id,
      }),
    );
  }

  async close(
    user: AuthUser,
    farmId: string,
    dto: CloseCashSessionDto,
  ): Promise<CashSession & { summary: CaisseSummary }> {
    await this.farmsService.assertAccessible(user, farmId);
    const session = await this.findOpen(farmId);
    if (!session) {
      throw new BadRequestException(
        'Aucune session de caisse ouverte à clôturer.',
      );
    }
    const summary = await this.summary(farmId, session);
    const difference = dto.declaredBalanceFcfa - summary.expectedBalanceFcfa;
    session.status = CashSessionStatus.CLOSED;
    session.closedAt = new Date();
    session.closedById = user.id;
    session.closingBalanceFcfa = dto.declaredBalanceFcfa;
    session.closingExpectedFcfa = summary.expectedBalanceFcfa;
    session.closingDifferenceFcfa = difference;
    const saved = await this.sessionRepo.save(session);
    return { ...saved, summary };
  }

  async createMovement(
    user: AuthUser,
    farmId: string,
    dto: CreateCashMovementDto,
  ): Promise<CashMovement> {
    await this.farmsService.assertAccessible(user, farmId);
    const session = await this.findOpen(farmId);
    if (!session) {
      throw new BadRequestException(
        'Aucune session de caisse ouverte. Ouvrir la caisse avant d’enregistrer un mouvement.',
      );
    }
    if (dto.type === CashMovementType.OUT) {
      const summary = await this.summary(farmId, session);
      if (dto.amountFcfa > summary.expectedBalanceFcfa) {
        throw new BadRequestException(
          `Sortie de ${dto.amountFcfa} FCFA refusée : solde de caisse disponible ${summary.expectedBalanceFcfa} FCFA. Une caisse ne peut pas être négative.`,
        );
      }
    }
    return this.movementRepo.save(
      this.movementRepo.create({
        farmId,
        cashSessionId: session.id,
        type: dto.type,
        source: CashMovementSource.MANUAL,
        amountFcfa: dto.amountFcfa,
        reason: dto.reason ?? null,
        movementDate: dto.movementDate ?? new Date().toISOString().slice(0, 10),
        createdById: user.id,
      }),
    );
  }

  async getCurrent(
    user: AuthUser,
    farmId: string,
  ): Promise<CaisseSummary | null> {
    await this.farmsService.assertAccessible(user, farmId);
    const session = await this.findOpen(farmId);
    if (!session) return null;
    return this.summary(farmId, session);
  }

  async listSessions(user: AuthUser, farmId: string): Promise<CashSession[]> {
    await this.farmsService.assertAccessible(user, farmId);
    return this.sessionRepo.find({
      where: { farmId },
      order: { openedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  private async findOpen(farmId: string): Promise<CashSession | null> {
    return this.sessionRepo.findOne({
      where: { farmId, status: CashSessionStatus.OPEN },
    });
  }

  private async summary(
    farmId: string,
    session: CashSession,
  ): Promise<CaisseSummary> {
    const movements = await this.movementRepo.find({
      where: { cashSessionId: session.id },
      order: { createdAt: 'ASC' },
    });
    let inFcfa = 0;
    let outFcfa = 0;
    for (const m of movements) {
      if (m.type === CashMovementType.IN) inFcfa += m.amountFcfa;
      else outFcfa += m.amountFcfa;
    }
    return {
      session,
      movements,
      inFcfa,
      outFcfa,
      expectedBalanceFcfa: session.openingBalanceFcfa + inFcfa - outFcfa,
    };
  }

  /** Pour le POS : session ouverte obligatoire pour un encaissement espèces. */
  async requireOpenSession(farmId: string): Promise<{ session: CashSession }> {
    const session = await this.findOpen(farmId);
    if (!session) {
      throw new NotFoundException(
        'Aucune session de caisse ouverte : ouvrir la caisse journalière avant d’encaisser.',
      );
    }
    return { session };
  }
}
