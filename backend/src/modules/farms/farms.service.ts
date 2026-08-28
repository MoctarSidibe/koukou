import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum.js';
import { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { CreateElevageDto } from './dto/create-eleveur.dto.js';
import { User } from '../users/entities/user.entity.js';
import { FarmEmployee } from './entities/farm-employee.entity.js';
import { Farm } from './entities/farm.entity.js';

export interface CreateFarmInput {
  name: string;
  administrativeCity: string;
  buildingCount?: number | null;
  capacityPerBuilding?: number | null;
  buildingAreaM2?: number | null;
  defaultSacKg?: number;
  longitude?: number | null;
  latitude?: number | null;
  isVerified?: boolean;
}

@Injectable()
export class FarmsService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    @InjectRepository(FarmEmployee)
    private readonly employeeRepo: Repository<FarmEmployee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(
    owner: AuthUser,
    input: CreateFarmInput,
    ownerId?: string,
  ): Promise<Farm> {
    const farm = this.farmRepo.create({
      name: input.name,
      administrativeCity: input.administrativeCity,
      ownerId: ownerId ?? owner.id,
      buildingCount: input.buildingCount ?? null,
      capacityPerBuilding: input.capacityPerBuilding ?? null,
      buildingAreaM2: input.buildingAreaM2 ?? null,
      defaultSacKg: input.defaultSacKg ?? 50,
      longitude: input.longitude ?? null,
      latitude: input.latitude ?? null,
    });
    return this.farmRepo.save(farm);
  }

  /** Provisionnement plateforme : compte Propriétaire + sa ferme (admin). */
  async provision(
    farmInput: CreateFarmInput,
    ownerInput: {
      phone: string;
      email?: string;
      fullName: string;
      password: string;
    },
  ): Promise<{ farm: Farm; owner: PublicUser }> {
    const where: Array<Partial<{ phone: string; email: string }>> = [
      { phone: ownerInput.phone },
    ];
    if (ownerInput.email) where.push({ email: ownerInput.email });
    const existing = await this.userRepo.findOne({ where });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec ce numéro ou cet e-mail.',
      );
    }
    const owner = await this.userRepo.save(
      this.userRepo.create({
        phone: ownerInput.phone,
        email: ownerInput.email,
        fullName: ownerInput.fullName,
        passwordHash: await bcrypt.hash(ownerInput.password, 10),
        role: UserRole.PROPRIETAIRE,
      }),
    );
    const farm = await this.create(owner as AuthUser, farmInput, owner.id);
    return { farm, owner: this.publicUser(owner) };
  }

  async findMine(user: AuthUser): Promise<Farm[]> {
    if (user.role === UserRole.PLATFORM_ADMIN) {
      return this.farmRepo.find({ order: { name: 'ASC' } });
    }
    if (user.role === UserRole.PROPRIETAIRE) {
      return this.farmRepo.find({ where: { ownerId: user.id } });
    }
    const employments = await this.employeeRepo.find({
      where: { userId: user.id },
      relations: { farm: true },
    });
    return employments.map((e) => e.farm);
  }

  async assertAccessible(user: AuthUser, farmId: string): Promise<Farm> {
    const farm = await this.farmRepo.findOne({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Ferme introuvable.');
    if (user.role === UserRole.PLATFORM_ADMIN) {
      return farm;
    }
    if (user.role === UserRole.PROPRIETAIRE && farm.ownerId === user.id) {
      return farm;
    }
    if (user.role === UserRole.ELEVEUR) {
      const link = await this.employeeRepo.findOne({
        where: { farmId, userId: user.id },
      });
      if (link) return farm;
    }
    throw new ForbiddenException(
      'Accès refusé : cette ferme ne vous appartient pas ou vous n’y êtes pas rattaché.',
    );
  }

  /** Liste toutes les fermes (plateforme) avec un aperçu du propriétaire. */
  async listAll(): Promise<Farm[]> {
    return this.farmRepo
      .createQueryBuilder('farm')
      .leftJoinAndSelect('farm.owner', 'owner')
      .select([
        'farm.id',
        'farm.name',
        'farm.administrativeCity',
        'farm.buildingCount',
        'farm.capacityPerBuilding',
        'farm.buildingAreaM2',
        'farm.defaultSacKg',
        'farm.longitude',
        'farm.latitude',
        'farm.isVerified',
        'farm.active',
        'farm.createdAt',
        'owner.id',
        'owner.fullName',
        'owner.phone',
        'owner.email',
        'owner.role',
        'owner.active',
      ])
      .orderBy('farm.createdAt', 'DESC')
      .getMany();
  }

  /** Mise à jour d'une ferme (Propriétaire de la ferme ou Administrateur plateforme). */
  async updateFarm(
    user: AuthUser,
    farmId: string,
    input: Partial<CreateFarmInput>,
  ): Promise<Farm> {
    const farm = await this.assertAccessible(user, farmId);
    if (input.name != null) farm.name = input.name;
    if (input.administrativeCity != null)
      farm.administrativeCity = input.administrativeCity;
    if (input.buildingCount !== undefined)
      farm.buildingCount = input.buildingCount ?? null;
    if (input.capacityPerBuilding !== undefined)
      farm.capacityPerBuilding = input.capacityPerBuilding ?? null;
    if (input.buildingAreaM2 !== undefined)
      farm.buildingAreaM2 = input.buildingAreaM2 ?? null;
    if (input.defaultSacKg != null) farm.defaultSacKg = input.defaultSacKg;
    if (input.longitude !== undefined) farm.longitude = input.longitude ?? null;
    if (input.latitude !== undefined) farm.latitude = input.latitude ?? null;
    if (input.isVerified != null) farm.isVerified = input.isVerified;
    return this.farmRepo.save(farm);
  }

  /** Suspendre / réactiver une ferme (plateforme uniquement). */
  async setFarmActive(farmId: string, active: boolean): Promise<Farm> {
    const farm = await this.farmRepo.findOne({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Ferme introuvable.');
    farm.active = active;
    return this.farmRepo.save(farm);
  }

  async createEmployee(owner: AuthUser, farmId: string, dto: CreateElevageDto) {
    await this.assertAccessible(owner, farmId);
    const existing = await this.userRepo.findOne({
      where: [{ phone: dto.phone }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec ce numéro ou cet e-mail.',
      );
    }
    const employee = await this.userRepo.save(
      this.userRepo.create({
        phone: dto.phone,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: UserRole.ELEVEUR,
      }),
    );
    const link = await this.linkEmployee(owner, farmId, employee.id);
    return { user: this.publicUser(employee), employment: link };
  }

  async linkEmployee(
    owner: AuthUser,
    farmId: string,
    employeeUserId: string,
  ): Promise<FarmEmployee> {
    await this.assertAccessible(owner, farmId);
    const employee = await this.userRepo.findOne({
      where: { id: employeeUserId },
    });
    if (!employee)
      throw new NotFoundException('Employé (Éleveur) introuvable.');
    if (employee.role !== UserRole.ELEVEUR) {
      throw new BadRequestException(
        'Seul un compte « Éleveur » (role ELEVEUR) peut être rattaché à une ferme.',
      );
    }
    const existing = await this.employeeRepo.findOne({
      where: { farmId, userId: employeeUserId },
    });
    if (existing) return existing;
    const link = this.employeeRepo.create({ farmId, userId: employeeUserId });
    return this.employeeRepo.save(link);
  }

  async listEmployees(
    farmId: string,
  ): Promise<Array<Omit<FarmEmployee, 'user'> & { user: PublicUser }>> {
    const employments = await this.employeeRepo.find({
      where: { farmId },
      relations: { user: true },
    });
    return employments.map((e) => {
      const { user, ...rest } = e;
      return { ...rest, user: this.publicUser(user) };
    });
  }

  private publicUser(user: User): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}

export interface PublicUser {
  id: string;
  phone: string;
  email: string;
  fullName: string;
  role: UserRole;
}
