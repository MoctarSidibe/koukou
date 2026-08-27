import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { FarmsController } from './farms.controller.js';
import { FarmsService } from './farms.service.js';
import { FarmEmployee } from './entities/farm-employee.entity.js';
import { Farm } from './entities/farm.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Farm, FarmEmployee, User])],
  controllers: [FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
