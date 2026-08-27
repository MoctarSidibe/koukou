import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Breed } from '../modules/breeds/entities/breed.entity.js';
import { ReferenceConstant } from '../modules/reference-constants/entities/reference-constant.entity.js';
import { RuleRegistry } from '../modules/alerts/entities/rule-registry.entity.js';
import { DatabaseSeedService } from './database-seed.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceConstant, Breed, RuleRegistry])],
  providers: [DatabaseSeedService],
})
export class DatabaseModule {}
