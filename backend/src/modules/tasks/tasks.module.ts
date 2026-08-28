import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsModule } from '../alerts/alerts.module.js';
import { ProductionBatch } from '../batches/entities/production-batch.entity.js';
import { FarmEmployee } from '../farms/entities/farm-employee.entity.js';
import { FarmsModule } from '../farms/farms.module.js';
import { FarmTask } from './entities/farm-task.entity.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([FarmTask, FarmEmployee, ProductionBatch]),
    FarmsModule,
    AlertsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
