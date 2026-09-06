import { PartialType } from '@nestjs/swagger';
import { CreateFeedProductDto } from './create-feed-product.dto.js';

export class UpdateFeedProductDto extends PartialType(CreateFeedProductDto) {}