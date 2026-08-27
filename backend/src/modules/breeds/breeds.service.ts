import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchType } from '../../common/enums/batch-type.enum.js';
import { Species } from '../../common/enums/species.enum.js';
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

  async createCustom(
    name: string,
    type: BatchType,
    species: Species = Species.POULET,
  ): Promise<Breed> {
    const breed = this.repo.create({ name, type, species, isCustom: true });
    return this.repo.save(breed);
  }
}
