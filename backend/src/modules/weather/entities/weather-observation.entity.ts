import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Farm } from '../../farms/entities/farm.entity.js';

export const WEATHER_ZONES = {
  CONFORT: 'CONFORT',
  PRUDENCE: 'PRUDENCE',
  MODERE: 'MODERE',
  SEVERE: 'SEVERE',
  DANGER: 'DANGER',
} as const;

export type WeatherZone = (typeof WEATHER_ZONES)[keyof typeof WEATHER_ZONES];

@Entity('weather_observations')
@Unique(['farmId', 'forecastDate'])
export class WeatherObservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  @Column({ name: 'farm_id', type: 'uuid' })
  @Index()
  farmId: string;

  @Column({ name: 'forecast_date', type: 'date' })
  forecastDate: string;

  @Column({ name: 'temp_c', type: 'float' })
  tempC: number;

  @Column({ name: 'humidity_pct', type: 'float' })
  humidityPct: number;

  @Column({ type: 'float' })
  thi: number;

  @Column({ type: 'varchar' })
  zone: WeatherZone;

  /** Niveau d'alerte associé au jour (null si aucune contrainte thermique). */
  @Column({ type: 'varchar', nullable: true })
  level: string | null;

  @Column({ type: 'varchar', default: 'PREVISION' })
  source: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
