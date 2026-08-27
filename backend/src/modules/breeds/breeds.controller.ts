import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BatchType } from '../../common/enums/batch-type.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { BreedsService } from './breeds.service.js';

class CreateBreedDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la souche est obligatoire.' })
  name: string;

  @IsEnum(BatchType, { message: 'Le type doit être CHAIR ou PONDEUSE.' })
  type: BatchType;
}

@ApiTags('Souches (Breed)')
@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les souches disponibles (Chair et Pondeuse)' })
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  findAll() {
    return this.breedsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter une souche personnalisée' })
  @Roles(UserRole.PROPRIETAIRE)
  create(@Body() dto: CreateBreedDto) {
    return this.breedsService.createCustom(dto.name, dto.type);
  }
}
