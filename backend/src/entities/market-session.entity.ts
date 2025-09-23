import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DataSession } from './data-session.entity';

export enum MarketSessionStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}

@Entity('market_sessions')
export class MarketSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ 
    type: 'enum', 
    enum: MarketSessionStatus, 
    default: MarketSessionStatus.ENABLED 
  })
  status: MarketSessionStatus;

  @Column({ name: 'download_count', type: 'int', default: 0 })
  downloadCount: number;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, (user) => user.marketSessions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => DataSession)
  @JoinColumn({ name: 'session_id' })
  dataSession: DataSession;
}