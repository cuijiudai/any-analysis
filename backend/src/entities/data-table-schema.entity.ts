import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { DataSession } from './data-session.entity';

export interface FieldDefinition {
  type: string;
  nullable: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  default?: any;
}

export interface FieldDefinitions {
  [fieldName: string]: FieldDefinition;
}

@Entity('data_table_schemas')
@Unique('unique_session_table', ['sessionId', 'tableName'])
export class DataTableSchema {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'table_name', type: 'varchar', length: 255 })
  tableName: string;

  @Column({ name: 'field_definitions', type: 'json' })
  fieldDefinitions: FieldDefinitions;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => DataSession, (session) => session.dataTableSchemas)
  @JoinColumn({ name: 'session_id' })
  session: DataSession;
}