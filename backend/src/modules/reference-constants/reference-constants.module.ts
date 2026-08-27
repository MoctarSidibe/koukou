import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceConstant } from './entities/reference-constant.entity.js';
import { ReferenceConstantsService } from './reference-constants.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceConstant])],
  providers: [ReferenceConstantsService],
  exports: [ReferenceConstantsService],
})
export class ReferenceConstantsModule {}
