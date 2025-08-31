import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DataSession } from './data-session.entity';

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
}

export enum AggregationType {
  SUM = 'sum',
  AVG = 'avg',
  COUNT = 'count',
  NONE = 'none',
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'like';
  value: any;
}

@Entity('chart_configs')
export class ChartConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'chart_type',
    type: 'enum',
    enum: ChartType,
  })
  chartType: ChartType;

  @Column({ name: 'x_axis', type: 'varchar', length: 255 })
  xAxis: string;

  @Column({ name: 'y_axis', type: 'varchar', length: 255 })
  yAxis: string;

  @Column({
    type: 'enum',
    enum: AggregationType,
    default: AggregationType.NONE,
  })
  aggregation: AggregationType;

  @Column({ type: 'json', nullable: true })
  filters: FilterCondition[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => DataSession, (session) => session.chartConfigs)
  @JoinColumn({ name: 'session_id' })
  session: DataSession;
}