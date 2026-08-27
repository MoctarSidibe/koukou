import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/role.enum.js';
import { SanitaryService } from './sanitary.service.js';
import { CreateSanitaryProtocolDto } from './dto/create-protocol.dto.js';

@ApiTags('Protocoles sanitaires')
@Controller('sanitary/protocols')
export class SanitaryProtocolsController {
  constructor(private readonly sanitaryService: SanitaryService) {}

  @Get()
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Lister les protocoles sanitaires' })
  @ApiQuery({ name: 'species', required: false })
  @ApiQuery({ name: 'type', required: false })
  list(@Query('species') species?: string, @Query('type') type?: string) {
    return this.sanitaryService.listProtocols(species, type);
  }

  @Get(':id')
  @Roles(UserRole.PROPRIETAIRE, UserRole.ELEVEUR)
  @ApiOperation({ summary: 'Détail d’un protocole avec ses étapes' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.sanitaryService.findProtocol(id);
  }

  @Post()
  @Roles(UserRole.PROPRIETAIRE)
  @ApiOperation({ summary: 'Créer un protocole sanitaire personnalisé' })
  create(@Body() dto: CreateSanitaryProtocolDto) {
    return this.sanitaryService.createProtocol(dto);
  }
}
