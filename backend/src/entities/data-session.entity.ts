import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { FetchConfig } from "./fetch-config.entity";
import { FieldAnnotation } from "./field-annotation.entity";
import { ChartConfig } from "./chart-config.entity";
import { DataTableSchema } from "./data-table-schema.entity";
import { User } from "./user.entity";

export enum SessionStatus {
  UNFETCHED = "unfetched", // 未拉取 - 接口没有拉取数据
  FETCHED = "fetched", // 已拉取 - 有数据了
  ANALYZED = "analyzed", // 已分析 - 有新建图表了
}

@Entity("data_sessions")
export class DataSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "varchar", length: 36, nullable: true })
  userId?: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({
    type: "enum",
    enum: SessionStatus,
    default: SessionStatus.UNFETCHED,
  })
  status: SessionStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, user => user.dataSessions)
  @JoinColumn({ name: "user_id" })
  user?: User;

  @OneToOne(() => FetchConfig, fetchConfig => fetchConfig.session, {
    cascade: true,
  })
  fetchConfig: FetchConfig;

  @OneToMany(() => FieldAnnotation, annotation => annotation.session, {
    cascade: true,
  })
  fieldAnnotations: FieldAnnotation[];

  @OneToMany(() => ChartConfig, chart => chart.session, {
    cascade: true,
  })
  chartConfigs: ChartConfig[];

  @OneToMany(() => DataTableSchema, schema => schema.session, {
    cascade: true,
  })
  dataTableSchemas: DataTableSchema[];
}
