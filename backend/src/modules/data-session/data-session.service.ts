import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DataSession, SessionStatus } from '../../entities/data-session.entity';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { ChartConfig } from '../../entities/chart-config.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { DynamicTableUtil } from '../../common/database-utils';
import { CreateSessionDto, UpdateSessionDto, SessionListQueryDto } from './dto';

@Injectable()
export class DataSessionService {
  constructor(
    @InjectRepository(DataSession)
    private readonly sessionRepository: Repository<DataSession>,
    @InjectRepository(FetchConfig)
    private readonly fetchConfigRepository: Repository<FetchConfig>,
    @InjectRepository(FieldAnnotation)
    private readonly fieldAnnotationRepository: Repository<FieldAnnotation>,
    @InjectRepository(ChartConfig)
    private readonly chartConfigRepository: Repository<ChartConfig>,
    @InjectRepository(DataTableSchema)
    private readonly dataTableSchemaRepository: Repository<DataTableSchema>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建新的数据会话
   */
  async createSession(createSessionDto: CreateSessionDto): Promise<DataSession> {
    const session = this.sessionRepository.create({
      name: createSessionDto.name,
      status: SessionStatus.CONFIGURING,
    });

    return await this.sessionRepository.save(session);
  }

  /**
   * 获取会话详情
   */
  async getSessionById(id: string): Promise<DataSession> {
    const session = await this.sessionRepository.findOne({
      where: { id },
      relations: ['fetchConfig', 'fieldAnnotations', 'chartConfigs', 'dataTableSchemas'],
    });

    if (!session) {
      throw new NotFoundException(`会话 ${id} 不存在`);
    }

    return session;
  }

  /**
   * 获取会话列表
   */
  async getSessionList(queryDto: SessionListQueryDto): Promise<{
    sessions: DataSession[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 10, status, search } = queryDto;
    
    const queryBuilder = this.sessionRepository.createQueryBuilder('session')
      .leftJoinAndSelect('session.fetchConfig', 'fetchConfig');

    // 状态筛选
    if (status) {
      queryBuilder.andWhere('session.status = :status', { status });
    }

    // 搜索筛选
    if (search) {
      queryBuilder.andWhere('session.name LIKE :search', { search: `%${search}%` });
    }

    // 分页
    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    // 排序
    queryBuilder.orderBy('session.updatedAt', 'DESC');

    const [sessions, total] = await queryBuilder.getManyAndCount();

    return {
      sessions,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 更新会话信息
   */
  async updateSession(id: string, updateSessionDto: UpdateSessionDto): Promise<DataSession> {
    const session = await this.getSessionById(id);

    // 验证状态转换的合法性
    if (updateSessionDto.status) {
      this.validateStatusTransition(session.status, updateSessionDto.status);
    }

    Object.assign(session, updateSessionDto);
    return await this.sessionRepository.save(session);
  }

  /**
   * 删除会话及其相关数据
   */
  async deleteSession(id: string): Promise<void> {
    const session = await this.getSessionById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 删除动态数据表
      const dataTableSchemas = await queryRunner.manager.find(DataTableSchema, {
        where: { sessionId: id },
      });

      for (const schema of dataTableSchemas) {
        try {
          await DynamicTableUtil.dropDynamicTable(this.dataSource, schema.tableName);
        } catch (error) {
          console.warn(`删除动态表 ${schema.tableName} 失败:`, error.message);
        }
      }

      // 2. 删除数据表模式记录
      await queryRunner.manager.delete(DataTableSchema, { sessionId: id });

      // 3. 删除图表配置
      await queryRunner.manager.delete(ChartConfig, { sessionId: id });

      // 4. 删除字段标注
      await queryRunner.manager.delete(FieldAnnotation, { sessionId: id });

      // 5. 删除拉取配置
      await queryRunner.manager.delete(FetchConfig, { sessionId: id });

      // 6. 最后删除会话记录
      await queryRunner.manager.delete(DataSession, { id });

      await queryRunner.commitTransaction();
      console.log(`会话 ${id} 及其相关数据删除成功`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`删除会话 ${id} 失败:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(id: string): Promise<{
    totalRecords: number;
    fieldsCount: number;
    chartsCount: number;
    lastUpdated: Date;
  }> {
    const session = await this.getSessionById(id);

    // 获取数据记录数
    let totalRecords = 0;
    const dataTableSchemas = await this.dataTableSchemaRepository.find({
      where: { sessionId: id },
    });

    for (const schema of dataTableSchemas) {
      try {
        const result = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM \`${schema.tableName}\``
        );
        totalRecords += parseInt(result[0]?.count || 0);
      } catch (error) {
        console.warn(`查询表 ${schema.tableName} 记录数失败:`, error.message);
      }
    }

    // 获取字段标注数
    const fieldsCount = await this.fieldAnnotationRepository.count({
      where: { sessionId: id },
    });

    // 获取图表配置数
    const chartsCount = await this.chartConfigRepository.count({
      where: { sessionId: id },
    });

    return {
      totalRecords,
      fieldsCount,
      chartsCount,
      lastUpdated: session.updatedAt,
    };
  }

  /**
   * 批量删除会话
   */
  async batchDeleteSessions(ids: string[]): Promise<void> {
    // 逐个删除，每个会话使用自己的事务
    for (const id of ids) {
      try {
        await this.deleteSession(id);
      } catch (error) {
        console.error(`批量删除中，删除会话 ${id} 失败:`, error);
        // 继续删除其他会话，不中断整个批量操作
      }
    }
  }

  /**
   * 复制会话
   */
  async duplicateSession(id: string, newName?: string): Promise<DataSession> {
    const originalSession = await this.getSessionById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 创建新会话
      const newSession = this.sessionRepository.create({
        name: newName || `${originalSession.name} (副本)`,
        status: SessionStatus.CONFIGURING,
      });
      const savedSession = await queryRunner.manager.save(newSession);

      // 复制拉取配置
      if (originalSession.fetchConfig) {
        const newFetchConfig = this.fetchConfigRepository.create({
          ...originalSession.fetchConfig,
          id: undefined,
          sessionId: savedSession.id,
        });
        await queryRunner.manager.save(newFetchConfig);
      }

      // 复制字段标注
      if (originalSession.fieldAnnotations?.length > 0) {
        const newAnnotations = originalSession.fieldAnnotations.map(annotation =>
          this.fieldAnnotationRepository.create({
            ...annotation,
            id: undefined,
            sessionId: savedSession.id,
          })
        );
        await queryRunner.manager.save(newAnnotations);
      }

      // 复制图表配置
      if (originalSession.chartConfigs?.length > 0) {
        const newChartConfigs = originalSession.chartConfigs.map(chart =>
          this.chartConfigRepository.create({
            ...chart,
            id: undefined,
            sessionId: savedSession.id,
          })
        );
        await queryRunner.manager.save(newChartConfigs);
      }

      await queryRunner.commitTransaction();
      return savedSession;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 根据ID查找会话 (别名方法，用于兼容)
   */
  async findById(id: string): Promise<DataSession | null> {
    try {
      return await this.getSessionById(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 更新会话状态
   */
  async updateStatus(id: string, status: SessionStatus): Promise<DataSession> {
    return await this.updateSession(id, { status });
  }

  /**
   * 验证状态转换的合法性
   */
  private validateStatusTransition(currentStatus: SessionStatus, newStatus: SessionStatus): void {
    const validTransitions: Record<SessionStatus, SessionStatus[]> = {
      [SessionStatus.CONFIGURING]: [SessionStatus.FETCHING, SessionStatus.COMPLETED],
      [SessionStatus.FETCHING]: [SessionStatus.ANNOTATING, SessionStatus.CONFIGURING],
      [SessionStatus.ANNOTATING]: [SessionStatus.ANALYZING, SessionStatus.FETCHING],
      [SessionStatus.ANALYZING]: [SessionStatus.COMPLETED, SessionStatus.ANNOTATING],
      [SessionStatus.COMPLETED]: [SessionStatus.ANALYZING, SessionStatus.CONFIGURING],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `无法从状态 ${currentStatus} 转换到 ${newStatus}`
      );
    }
  }
}