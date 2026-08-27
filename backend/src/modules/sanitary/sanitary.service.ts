import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AlertKind, AlertLevel } from '../../common/enums/alert-level.enum.js';
import { CareType } from '../../common/enums/care-type.enum.js';
import { ProphylaxisStatus } from '../../common/enums/prophylaxis-status.enum.js';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { Species } from '../../common/enums/species.enum.js';
import { FarmsService } from '../farms/farms.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { ReferenceConstantsService } from '../reference-constants/reference-constants.service.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { InputLot } from '../inputs/entities/input-lot.entity.js';
import { SanitaryProtocol } from './entities/sanitary-protocol.entity.js';
import { ProtocolStep } from './entities/protocol-step.entity.js';
import { ProphylaxisEvent } from './entities/prophylaxis-event.entity.js';
import {
  TreatmentRecord,
  computeWithdrawalEndDate,
} from './entities/treatment-record.entity.js';
import {
  CreateSanitaryProtocolDto,
  ProtocolStepInput,
} from './dto/create-protocol.dto.js';
import { CreateTreatmentDto } from './dto/create-treatment.dto.js';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class SanitaryService {
  constructor(
    @InjectRepository(SanitaryProtocol)
    private readonly protocolRepo: Repository<SanitaryProtocol>,
    @InjectRepository(ProtocolStep)
    private readonly stepRepo: Repository<ProtocolStep>,
    @InjectRepository(ProphylaxisEvent)
    private readonly eventRepo: Repository<ProphylaxisEvent>,
    @InjectRepository(TreatmentRecord)
    private readonly treatmentRepo: Repository<TreatmentRecord>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(InputLot)
    private readonly inputRepo: Repository<InputLot>,
    private readonly farmsService: FarmsService,
    private readonly alertsService: AlertsService,
    private readonly constants: ReferenceConstantsService,
  ) {}

  // ---------- Protocoles sanitaire (données de référence) ----------

  async listProtocols(
    species?: string,
    type?: string,
  ): Promise<SanitaryProtocol[]> {
    const where: Record<string, string> = {};
    if (species) where.species = species;
    if (type) where.type = type;
    return this.protocolRepo.find({ where, order: { name: 'ASC' } });
  }

  async findProtocol(
    id: string,
  ): Promise<SanitaryProtocol & { steps: ProtocolStep[] }> {
    const protocol = await this.protocolRepo.findOne({ where: { id } });
    if (!protocol)
      throw new NotFoundException('Protocole sanitaire introuvable.');
    const steps = await this.stepRepo.find({
      where: { protocolId: id },
      order: { stepOrder: 'ASC' },
    });
    return { ...protocol, steps };
  }

  async createProtocol(
    dto: CreateSanitaryProtocolDto,
  ): Promise<SanitaryProtocol & { steps: ProtocolStep[] }> {
    const code = dto.code ?? this.slugify(dto.name);
    const existing = await this.protocolRepo.findOne({ where: { code } });
    if (existing)
      throw new BadRequestException('Un protocole existe déjà avec ce code.');
    const protocol = await this.protocolRepo.save(
      this.protocolRepo.create({
        code,
        name: dto.name,
        species: dto.species ?? Species.POULET,
        type: dto.type,
        isDefault: false,
        isEditable: true,
      }),
    );
    await this.saveSteps(protocol.id, dto.steps);
    return this.findProtocol(protocol.id);
  }

  // ---------- Calendrier prophylactique ----------

  async generateCalendar(
    user: AuthUser,
    farmId: string,
    batchId: string,
    protocolId?: string,
  ): Promise<ProphylaxisEvent[]> {
    await this.farmsService.assertAccessible(user, farmId);
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');

    const protocol = protocolId
      ? await this.protocolRepo.findOne({ where: { id: protocolId } })
      : await this.protocolRepo.findOne({
          where: { species: batch.species, type: batch.type, isDefault: true },
          order: { createdAt: 'ASC' },
        });
    if (!protocol) {
      throw new BadRequestException(
        'Aucun protocole sanitaire défini pour ce type de lot (espèce/type). Créez-en un d’abord.',
      );
    }
    const steps = await this.stepRepo.find({
      where: { protocolId: protocol.id, active: true },
      order: { stepOrder: 'ASC' },
    });
    if (steps.length === 0) {
      throw new BadRequestException(
        'Le protocole sélectionné ne contient aucune étape active.',
      );
    }

    const existing = await this.eventRepo.find({
      where: { batchId },
    });
    const existingStepIds = new Set(
      existing.filter((e) => e.protocolStepId).map((e) => e.protocolStepId),
    );

    const calendar: ProphylaxisEvent[] = [];
    for (const step of steps) {
      if (existingStepIds.has(step.id)) continue;
      const event = await this.eventRepo.save(
        this.eventRepo.create({
          farmId,
          batchId,
          buildingId: batch.buildingId,
          protocolStepId: step.id,
          careType: step.careType,
          name: step.name,
          dosage: step.dosage,
          route: step.route,
          withdrawalDays: step.withdrawalDays,
          scheduledDate: addDays(batch.integrationDate, step.dayFrom),
          status: ProphylaxisStatus.PLANIFIE,
        }),
      );
      calendar.push(event);
    }

    await this.refreshProphylaxis(batchId);
    return this.listProphylaxis(user, farmId, batchId);
  }

  async listProphylaxis(
    user: AuthUser,
    farmId: string,
    batchId: string,
  ): Promise<ProphylaxisEvent[]> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertBatchInFarm(farmId, batchId);
    await this.refreshProphylaxisStatuses(batchId);
    return this.eventRepo.find({
      where: { batchId },
      order: { scheduledDate: 'ASC' },
    });
  }

  async completeEvent(
    user: AuthUser,
    farmId: string,
    batchId: string,
    eventId: string,
    dto: {
      completedAt?: string;
      notes?: string;
      medicationLotId?: string;
    },
  ): Promise<ProphylaxisEvent> {
    await this.farmsService.assertAccessible(user, farmId);
    const event = await this.assertEvent(farmId, batchId, eventId);
    if (event.status === ProphylaxisStatus.FAIT) {
      throw new BadRequestException('Ce soin a déjà été réalisé.');
    }

    event.status = ProphylaxisStatus.FAIT;
    event.completedAt = dto.completedAt
      ? new Date(dto.completedAt)
      : new Date();
    event.performedById = user.id;
    event.performedNotes = dto.notes ?? null;
    if (dto.medicationLotId) {
      await this.assertMedicationLot(farmId, dto.medicationLotId);
      event.medicationLotId = dto.medicationLotId;
    }
    await this.eventRepo.save(event);

    // Un soin antibiotique avec délai d'attente ouvre un suivi HACCP.
    if (event.careType === CareType.ANTIBIOTIQUE && event.withdrawalDays > 0) {
      await this.treatmentRepo.save(
        this.treatmentRepo.create({
          farmId,
          batchId,
          careType: event.careType,
          productName: event.name,
          dosage: event.dosage,
          route: event.route,
          administeredAt: event.completedAt,
          withdrawalDays: event.withdrawalDays,
          withdrawalEndDate: computeWithdrawalEndDate(
            event.completedAt,
            event.withdrawalDays,
          ),
          performedById: user.id,
          medicationLotId: event.medicationLotId,
          notes: event.performedNotes,
        }),
      );
    }

    await this.refreshProphylaxis(batchId);
    return event;
  }

  async cancelEvent(
    user: AuthUser,
    farmId: string,
    batchId: string,
    eventId: string,
    reason?: string,
  ): Promise<ProphylaxisEvent> {
    await this.farmsService.assertAccessible(user, farmId);
    const event = await this.assertEvent(farmId, batchId, eventId);
    if (event.status === ProphylaxisStatus.FAIT) {
      throw new BadRequestException(
        'Impossible d’annuler un soin déjà réalisé.',
      );
    }
    event.status = ProphylaxisStatus.ANNULE;
    event.cancelledReason = reason ?? 'Non précisé';
    event.performedById = user.id;
    await this.eventRepo.save(event);
    await this.refreshProphylaxis(batchId);
    return event;
  }

  async rescheduleEvent(
    user: AuthUser,
    farmId: string,
    batchId: string,
    eventId: string,
    scheduledDate: string,
  ): Promise<ProphylaxisEvent> {
    await this.farmsService.assertAccessible(user, farmId);
    const event = await this.assertEvent(farmId, batchId, eventId);
    if (event.status === ProphylaxisStatus.FAIT) {
      throw new BadRequestException(
        'Impossible de reporter un soin déjà réalisé.',
      );
    }
    event.scheduledDate = scheduledDate;
    event.status = ProphylaxisStatus.PLANIFIE;
    await this.eventRepo.save(event);
    await this.refreshProphylaxis(batchId);
    return event;
  }

  // ---------- Traitements (registre HACCP) ----------

  async createTreatment(
    user: AuthUser,
    farmId: string,
    batchId: string,
    dto: CreateTreatmentDto,
  ): Promise<TreatmentRecord> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertBatchInFarm(farmId, batchId);
    if (dto.medicationLotId) {
      await this.assertMedicationLot(farmId, dto.medicationLotId);
    }
    const administeredAt = dto.administeredAt
      ? new Date(dto.administeredAt)
      : new Date();
    const treatment = await this.treatmentRepo.save(
      this.treatmentRepo.create({
        farmId,
        batchId,
        careType: dto.careType,
        productName: dto.productName,
        dosage: dto.dosage ?? null,
        route: dto.route ?? null,
        administeredAt,
        withdrawalDays: dto.withdrawalDays ?? 0,
        withdrawalEndDate: computeWithdrawalEndDate(
          administeredAt,
          dto.withdrawalDays ?? 0,
        ),
        performedById: user.id,
        medicationLotId: dto.medicationLotId ?? null,
        notes: dto.notes ?? null,
      }),
    );
    await this.refreshProphylaxis(batchId);
    return treatment;
  }

  async listTreatments(
    user: AuthUser,
    farmId: string,
    batchId: string,
  ): Promise<TreatmentRecord[]> {
    await this.farmsService.assertAccessible(user, farmId);
    await this.assertBatchInFarm(farmId, batchId);
    return this.treatmentRepo.find({
      where: { batchId },
      order: { administeredAt: 'DESC' },
    });
  }

  // ---------- Évaluation des alertes (advisory) ----------

  /**
   * Reçoit la lotion des alertes PROPHYLAXIE et DELAI_ATTENTE après chaque
   * mutation sanitaire : soins en retard (ROUGE) / à venir bientôt (JAUNE),
   * et délais d'attente en cours (ROUGE, sécurité alimentaire).
   */
  async refreshProphylaxis(batchId: string): Promise<void> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) return;
    const farmId = batch.farmId;

    await this.refreshProphylaxisStatuses(batchId);

    const [events, treatments] = await Promise.all([
      this.eventRepo.find({ where: { batchId } }),
      this.treatmentRepo.find({ where: { batchId } }),
    ]);

    // --- PROPHYLAXIE : soins en retard ou imminents ---
    const leadDays = await this.constants.get(
      ReferenceKey.CALENDAR_LEAD_DAYS,
      1,
    );
    const today = todayStr();

    const overdue = events.filter(
      (e) => e.status === ProphylaxisStatus.EN_RETARD,
    );
    const upcoming = events
      .filter((e) => e.status === ProphylaxisStatus.PLANIFIE)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    if (overdue.length > 0) {
      const names = overdue
        .slice(0, 3)
        .map((e) => e.name)
        .join(', ');
      await this.alertsService.raise(
        {
          kind: AlertKind.PROPHYLAXIE,
          level: AlertLevel.ROUGE,
          message: `Soin(s) prophylactique(s) en retard sur le lot : ${names}. Un retard de vaccination expose la bande aux maladies.`,
          recommendation:
            'Réaliser le soin dès que possible ou reporter explicitement la date. En cas de doute, contacter le vétérinaire.',
          context: { overdueCount: overdue.length },
        },
        { farmId, batchId },
      );
    } else if (
      upcoming.length > 0 &&
      upcoming[0].scheduledDate <= addDays(today, leadDays)
    ) {
      const next = upcoming[0];
      await this.alertsService.raise(
        {
          kind: AlertKind.PROPHYLAXIE,
          level: AlertLevel.JAUNE,
          message: `Soin à venir : « ${next.name} » planifié le ${next.scheduledDate}.`,
          recommendation:
            'Préparer le produit et l’abreuvement avant la date prévue pour ne pas dépasser la fenêtre recommandée.',
          context: { nextDate: next.scheduledDate },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(
        farmId,
        batchId,
        AlertKind.PROPHYLAXIE,
      );
    }

    // --- DELAI_ATTENTE : sécurité alimentaire (commercialisation suspendue) ---
    const activeWithdrawal = treatments
      .filter(
        (t) => t.withdrawalEndDate != null && t.withdrawalEndDate >= today,
      )
      .sort((a, b) => a.withdrawalEndDate!.localeCompare(b.withdrawalEndDate!));

    if (activeWithdrawal.length > 0) {
      const endDate = activeWithdrawal[0].withdrawalEndDate!;
      await this.alertsService.raise(
        {
          kind: AlertKind.DELAI_ATTENTE,
          level: AlertLevel.ROUGE,
          message: `Délai d'attente actif sur le lot : commercialisation et vente suspendues jusqu'au ${endDate} (sécurité alimentaire).`,
          recommendation: `Attendre le ${endDate} avant toute vente ou publication sur le marché. Respecter scrupuleusement le délai d'élimination de la molécule.`,
          context: {
            withdrawalEndDate: endDate,
            activeTreatments: activeWithdrawal.length,
          },
        },
        { farmId, batchId },
      );
    } else {
      await this.alertsService.clearKind(
        farmId,
        batchId,
        AlertKind.DELAI_ATTENTE,
      );
    }
  }

  private async refreshProphylaxisStatuses(batchId: string): Promise<void> {
    const warnDays = await this.constants.get(
      ReferenceKey.PROPHYLAXIE_RETARD_WARN_DAYS,
      1,
    );
    const limit = addDays(todayStr(), -warnDays);
    const events = await this.eventRepo.find({
      where: { batchId, status: ProphylaxisStatus.PLANIFIE },
    });
    const toFlag = events.filter((e) => e.scheduledDate < limit);
    if (toFlag.length > 0) {
      for (const e of toFlag) e.status = ProphylaxisStatus.EN_RETARD;
      await this.eventRepo.save(toFlag);
    }
  }

  // ---------- Helpers ----------

  private async assertEvent(
    farmId: string,
    batchId: string,
    eventId: string,
  ): Promise<ProphylaxisEvent> {
    await this.assertBatchInFarm(farmId, batchId);
    const event = await this.eventRepo.findOne({
      where: { id: eventId, farmId, batchId },
    });
    if (!event)
      throw new NotFoundException(
        'Soin prophylactique introuvable sur ce lot.',
      );
    return event;
  }

  private async assertBatchInFarm(
    farmId: string,
    batchId: string,
  ): Promise<ProductionBatch> {
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, farmId },
    });
    if (!batch)
      throw new NotFoundException('Lot introuvable dans cette ferme.');
    return batch;
  }

  private async assertMedicationLot(
    farmId: string,
    inputLotId: string,
  ): Promise<void> {
    const lot = await this.inputRepo.findOne({
      where: { id: inputLotId, farmId },
    });
    if (!lot)
      throw new BadRequestException(
        'Lot d’intrant (médicament) introuvable dans cette ferme.',
      );
  }

  private async saveSteps(
    protocolId: string,
    steps: ProtocolStepInput[],
  ): Promise<void> {
    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    for (const s of sorted) {
      await this.stepRepo.save(
        this.stepRepo.create({
          protocolId,
          stepOrder: s.stepOrder,
          dayFrom: s.dayFrom,
          dayTo: s.dayTo,
          careType: s.careType,
          name: s.name,
          dosage: s.dosage ?? null,
          route: s.route ?? null,
          withdrawalDays: s.withdrawalDays ?? 0,
          active: true,
        }),
      );
    }
  }

  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `custom-${slug || 'protocol'}-${Date.now().toString(36)}`;
  }
}
