import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { DataSession } from './data-session.entity';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

@Entity('fetch_configs')
export class FetchConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'api_url', type: 'text' })
  apiUrl: string;

  @Column({
    type: 'enum',
    enum: HttpMethod,
    default: HttpMethod.GET,
  })
  method: HttpMethod;

  @Column({ type: 'json', nullable: true })
  headers: Record<string, string>;

  @Column({ name: 'query_params', type: 'json', nullable: true })
  queryParams: Record<string, string>;

  @Column({ type: 'json', nullable: true })
  data: any;

  @Column({ name: 'enable_pagination', type: 'boolean', default: false })
  enablePagination: boolean;

  @Column({ name: 'page_field', type: 'varchar', length: 50, nullable: true })
  pageField?: string;

  @Column({ name: 'total_field', type: 'varchar', length: 50, nullable: true })
  totalField?: string;

  @Column({ name: 'page_size', type: 'int', default: 20 })
  pageSize: number;

  @Column({ name: 'data_path', type: 'varchar', length: 500, nullable: true })
  dataPath?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @OneToOne(() => DataSession, (session) => session.fetchConfig)
  @JoinColumn({ name: 'session_id' })
  session: DataSession;
}