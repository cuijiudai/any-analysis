import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { FetchConfig } from './fetch-config.entity';
import { FieldAnnotation } from './field-annotation.entity';
import { ChartConfig } from './chart-config.entity';
import { DataTableSchema } from './data-table-schema.entity';

export enum SessionStatus {
  CONFIGURING = 'configuring',
  FETCHING = 'fetching',
  ANNOTATING = 'annotating',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
}

@Entity('data_sessions')
export class DataSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.CONFIGURING,
  })
  status: SessionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @OneToOne(() => FetchConfig, (fetchConfig) => fetchConfig.session, {
    cascade: true,
  })
  fetchConfig: FetchConfig;

  @OneToMany(() => FieldAnnotation, (annotation) => annotation.session, {
    cascade: true,
  })
  fieldAnnotations: FieldAnnotation[];

  @OneToMany(() => ChartConfig, (chart) => chart.session, {
    cascade: true,
  })
  chartConfigs: ChartConfig[];

  @OneToMany(() => DataTableSchema, (schema) => schema.session, {
    cascade: true,
  })
  dataTableSchemas: DataTableSchema[];
}