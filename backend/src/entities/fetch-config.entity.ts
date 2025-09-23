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

export enum PaginationType {
  PAGE = 'page',     // 页码方式：传递页码和每页数量
  OFFSET = 'offset', // 索引方式：传递开始索引和每页数量
}

@Entity('fetch_configs')
export class FetchConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
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

  @Column({
    name: 'pagination_type',
    type: 'enum',
    enum: PaginationType,
    default: PaginationType.PAGE,
    nullable: true,
  })
  paginationType?: PaginationType;

  @Column({ name: 'page_field', type: 'varchar', length: 50, nullable: true })
  pageField?: string;

  @Column({ name: 'page_field_start_value', type: 'int', nullable: true })
  pageFieldStartValue?: number;

  @Column({ name: 'total_field', type: 'varchar', length: 50, nullable: true })
  totalField?: string;

  @Column({ name: 'page_size', type: 'int', default: 20 })
  pageSize: number;

  @Column({ name: 'step_size', type: 'int', nullable: true })
  stepSize?: number;

  @Column({ name: 'data_path', type: 'varchar', length: 500, nullable: true })
  dataPath?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @OneToOne(() => DataSession, (session) => session.fetchConfig)
  @JoinColumn({ name: 'session_id' })
  session: DataSession;
}