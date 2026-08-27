import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceConstant } from './entities/reference-constant.entity.js';
import { ReferenceConstantsService } from './reference-constants.service.js';
import { ReferenceConstantsController } from './reference-constants.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceConstant])],
  controllers: [ReferenceConstantsController],
  providers: [ReferenceConstantsService],
  exports: [ReferenceConstantsService],
})
export class ReferenceConstantsModule {}
