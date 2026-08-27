import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferenceKey } from '../../common/enums/reference-key.enum.js';
import { ReferenceConstant } from './entities/reference-constant.entity.js';

@Injectable()
export class ReferenceConstantsService {
  constructor(
    @InjectRepository(ReferenceConstant)
    private readonly repo: Repository<ReferenceConstant>,
  ) {}

  async get(key: string, fallback: number): Promise<number> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? row.value : fallback;
  }

  async getMany(keys: ReferenceKey[]): Promise<Record<string, number>> {
    const rows = await this.repo.find({ where: keys.map((k) => ({ key: k })) });
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.key] = row.value;
    }
    return out;
  }

  async set(key: string, value: number): Promise<ReferenceConstant> {
    const row = await this.repo.findOne({ where: { key } });
    if (row) {
      row.value = value;
      return this.repo.save(row);
    }
    return this.repo.save(this.repo.create({ key, value }));
  }

  /** Mise à jour « réglages » : clé existante + constante éditable uniquement. */
  async update(key: string, value: number): Promise<ReferenceConstant> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row) {
      throw new NotFoundException(
        `Constante de référence inconnue : « ${key} ».`,
      );
    }
    if (row.isEditable !== true) {
      throw new BadRequestException(
        `La constante « ${key} » n'est pas modifiable en réglages.`,
      );
    }
    row.value = value;
    return this.repo.save(row);
  }

  async findAll(): Promise<ReferenceConstant[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }
}
