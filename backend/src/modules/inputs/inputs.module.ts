import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsModule } from '../farms/farms.module.js';
import { InputsController } from './inputs.controller.js';
import { InputsService } from './inputs.service.js';
import { InputLot } from './entities/input-lot.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([InputLot]), FarmsModule],
  controllers: [InputsController],
  providers: [InputsService],
  exports: [InputsService],
})
export class InputsModule {}
