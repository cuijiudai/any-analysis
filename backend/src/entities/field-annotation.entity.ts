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
import { FieldType } from '../common/enums/field-type.enum';

@Entity('field_annotations')
@Unique('unique_session_field', ['sessionId', 'fieldName'])
export class FieldAnnotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'field_name', type: 'varchar', length: 255 })
  fieldName: string;

  @Column({ 
    name: 'field_type', 
    type: 'enum',
    enum: FieldType,
    default: FieldType.STRING
  })
  fieldType: FieldType;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => DataSession, (session) => session.fieldAnnotations)
  @JoinColumn({ name: 'session_id' })
  session: DataSession;
}