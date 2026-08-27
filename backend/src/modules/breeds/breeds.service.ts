import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchType } from '../../common/enums/batch-type.enum.js';
import { Breed } from './entities/breed.entity.js';

@Injectable()
export class BreedsService {
  constructor(
    @InjectRepository(Breed)
    private readonly repo: Repository<Breed>,
  ) {}

  findAll(): Promise<Breed[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Breed | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createCustom(name: string, type: BatchType): Promise<Breed> {
    const breed = this.repo.create({ name, type, isCustom: true });
    return this.repo.save(breed);
  }
}
