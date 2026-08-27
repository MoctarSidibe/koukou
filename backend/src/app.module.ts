import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BreedsModule } from './modules/breeds/breeds.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { FarmsModule } from './modules/farms/farms.module.js';
import { BuildingsModule } from './modules/buildings/buildings.module.js';
import { BatchesModule } from './modules/batches/batches.module.js';
import { DailyEntriesModule } from './modules/daily-entries/daily-entries.module.js';
import { InputsModule } from './modules/inputs/inputs.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { ReferenceConstantsModule } from './modules/reference-constants/reference-constants.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_DATABASE', 'koukou_ferme'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
    FarmsModule,
    BuildingsModule,
    BreedsModule,
    BatchesModule,
    DailyEntriesModule,
    InputsModule,
    AlertsModule,
    ReferenceConstantsModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
