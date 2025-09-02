import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DataSession, SessionStatus } from '../../entities/data-session.entity';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { ChartConfig } from '../../entities/chart-config.entity';
import { DataTableSchema } from '../../entities/data-table-schema.entity';
import { MarketSession } from '../../entities/market-session.entity';
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
    @InjectRepository(MarketSession)
    private readonly marketSessionRepository: Repository<MarketSession>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建新的数据会话
   */
  async createSession(createSessionDto: CreateSessionDto, userId: string): Promise<DataSession> {
    const session = this.sessionRepository.create({
      name: createSessionDto.name,
      userId: userId,
      status: SessionStatus.UNFETCHED,
    });

    return await this.sessionRepository.save(session);
  }

  /**
   * 获取会话详情
   */
  async getSessionById(id: string, userId?: string): Promise<DataSession> {
    const whereCondition: any = { id };
    if (userId) {
      whereCondition.userId = userId;
    }

    const session = await this.sessionRepository.findOne({
      where: whereCondition,
      relations: ['fetchConfig', 'fieldAnnotations', 'chartConfigs', 'dataTableSchemas'],
    });

    if (!session) {
      throw new NotFoundException(`会话 ${id} 不存在`);
    }

    // 自动计算并更新状态
    try {
      await this.calculateAndUpdateStatus(id);
      // 重新获取更新后的会话
      const updatedSession = await this.sessionRepository.findOne({
        where: whereCondition,
        relations: ['fetchConfig', 'fieldAnnotations', 'chartConfigs', 'dataTableSchemas'],
      });
      return updatedSession || session;
    } catch (error) {
      console.warn(`计算会话 ${id} 状态失败:`, error.message);
      return session;
    }
  }

  /**
   * 获取会话列表
   */
  async getSessionList(queryDto: SessionListQueryDto, userId: string): Promise<{
    sessions: (DataSession & { isShared?: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 10, status, search } = queryDto;
    
    const queryBuilder = this.sessionRepository.createQueryBuilder('session')
      .leftJoinAndSelect('session.fetchConfig', 'fetchConfig')
      .leftJoinAndSelect('session.chartConfigs', 'chartConfigs')
      .leftJoinAndSelect('session.dataTableSchemas', 'dataTableSchemas')
      .leftJoin('market_sessions', 'marketSession', 'marketSession.session_id = session.id AND marketSession.status = :marketStatus', { marketStatus: 'enabled' })
      .addSelect('marketSession.id', 'marketSession_id')
      .where('session.userId = :userId', { userId })
      .andWhere('session.userId IS NOT NULL');

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

    // 获取总数（不包含分享状态查询）
    const countQueryBuilder = this.sessionRepository.createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .andWhere('session.userId IS NOT NULL');
    
    if (status) {
      countQueryBuilder.andWhere('session.status = :status', { status });
    }
    if (search) {
      countQueryBuilder.andWhere('session.name LIKE :search', { search: `%${search}%` });
    }
    
    const total = await countQueryBuilder.getCount();
    
    // 获取带分享状态的数据
    const rawResults = await queryBuilder.getRawAndEntities();
    const sessionsWithShareStatus = rawResults.entities.map((session, index) => ({
      ...session,
      isShared: !!rawResults.raw[index]?.marketSession_id
    }));

    // 为每个会话计算并更新状态
    for (const session of sessionsWithShareStatus) {
      try {
        await this.calculateAndUpdateStatus(session.id);
      } catch (error) {
        console.warn(`计算会话 ${session.id} 状态失败:`, error.message);
      }
    }

    return {
      sessions: sessionsWithShareStatus,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 更新会话信息
   */
  async updateSession(id: string, updateSessionDto: UpdateSessionDto, userId: string): Promise<DataSession> {
    const session = await this.getSessionById(id, userId);

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
  async deleteSession(id: string, userId: string): Promise<void> {
    const session = await this.getSessionById(id, userId);

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
  async batchDeleteSessions(ids: string[], userId: string): Promise<void> {
    // 逐个删除，每个会话使用自己的事务
    for (const id of ids) {
      try {
        await this.deleteSession(id, userId);
      } catch (error) {
        console.error(`批量删除中，删除会话 ${id} 失败:`, error);
        // 继续删除其他会话，不中断整个批量操作
      }
    }
  }

  /**
   * 复制会话
   */
  async duplicateSession(id: string, newName?: string, userId?: string): Promise<DataSession> {
    const originalSession = await this.getSessionById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 创建新会话
      const newSession = this.sessionRepository.create({
        name: newName || `${originalSession.name} (副本)`,
        userId: userId || originalSession.userId,
        status: SessionStatus.UNFETCHED,
      });
      const savedSession = await queryRunner.manager.save(newSession);

      // 复制拉取配置
      if (originalSession.fetchConfig) {
        const newFetchConfig = this.fetchConfigRepository.create({
          sessionId: savedSession.id,
          apiUrl: originalSession.fetchConfig.apiUrl,
          method: originalSession.fetchConfig.method,
          headers: originalSession.fetchConfig.headers ? JSON.parse(JSON.stringify(originalSession.fetchConfig.headers)) : null,
          queryParams: originalSession.fetchConfig.queryParams ? JSON.parse(JSON.stringify(originalSession.fetchConfig.queryParams)) : null,
          data: originalSession.fetchConfig.data ? JSON.parse(JSON.stringify(originalSession.fetchConfig.data)) : null,
          enablePagination: originalSession.fetchConfig.enablePagination,
          paginationType: originalSession.fetchConfig.paginationType,
          pageField: originalSession.fetchConfig.pageField,
          pageFieldStartValue: originalSession.fetchConfig.pageFieldStartValue,
          totalField: originalSession.fetchConfig.totalField,
          pageSize: originalSession.fetchConfig.pageSize,
          stepSize: originalSession.fetchConfig.stepSize,
          dataPath: originalSession.fetchConfig.dataPath,
        });
        await queryRunner.manager.save(newFetchConfig);
      }

      // 复制字段标注
      if (originalSession.fieldAnnotations?.length > 0) {
        const newAnnotations = originalSession.fieldAnnotations.map(annotation => {
          const { id: _, sessionId: __, createdAt: ___, ...annotationData } = annotation;
          return this.fieldAnnotationRepository.create({
            ...annotationData,
            sessionId: savedSession.id,
          });
        });
        await queryRunner.manager.save(newAnnotations);
      }

      // 复制图表配置
      if (originalSession.chartConfigs?.length > 0) {
        const newChartConfigs = originalSession.chartConfigs.map(chart => {
          const { id: _, sessionId: __, createdAt: ___, updatedAt: ____, ...chartData } = chart;
          return this.chartConfigRepository.create({
            ...chartData,
            sessionId: savedSession.id,
          });
        });
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
  async updateStatus(id: string, status: SessionStatus, userId?: string): Promise<DataSession> {
    if (userId) {
      return await this.updateSession(id, { status }, userId);
    } else {
      // 内部服务调用，不验证用户所有权
      const session = await this.sessionRepository.findOne({ where: { id } });
      if (!session) {
        throw new NotFoundException(`会话 ${id} 不存在`);
      }
      
      this.validateStatusTransition(session.status, status);
      session.status = status;
      return await this.sessionRepository.save(session);
    }
  }

  /**
   * 验证状态转换的合法性
   */
  private validateStatusTransition(currentStatus: SessionStatus, newStatus: SessionStatus): void {
    const validTransitions: Record<SessionStatus, SessionStatus[]> = {
      [SessionStatus.UNFETCHED]: [SessionStatus.FETCHED],
      [SessionStatus.FETCHED]: [SessionStatus.ANALYZED, SessionStatus.UNFETCHED],
      [SessionStatus.ANALYZED]: [SessionStatus.FETCHED, SessionStatus.UNFETCHED],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `无法从状态 ${currentStatus} 转换到 ${newStatus}`
      );
    }
  }

  /**
   * 检查会话是否已分享
   */
  async isSessionShared(sessionId: string, userId: string): Promise<boolean> {
    const marketSession = await this.marketSessionRepository.findOne({
      where: { sessionId, userId, status: 'enabled' as any },
    });
    return !!marketSession;
  }

  /**
   * 自动计算并更新会话状态
   */
  async calculateAndUpdateStatus(sessionId: string): Promise<SessionStatus> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['fetchConfig', 'chartConfigs', 'dataTableSchemas'],
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    let newStatus: SessionStatus;

    // 1. 检查是否有图表配置 -> 已分析
    if (session.chartConfigs && session.chartConfigs.length > 0) {
      newStatus = SessionStatus.ANALYZED;
    }
    // 2. 检查是否有数据 -> 已拉取
    else if (session.dataTableSchemas && session.dataTableSchemas.length > 0) {
      // 检查数据表是否有数据
      let hasData = false;
      for (const schema of session.dataTableSchemas) {
        try {
          const result = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM \`${schema.tableName}\` LIMIT 1`
          );
          if (parseInt(result[0]?.count || 0) > 0) {
            hasData = true;
            break;
          }
        } catch (error) {
          // 表不存在或查询失败，继续检查其他表
        }
      }
      newStatus = hasData ? SessionStatus.FETCHED : SessionStatus.UNFETCHED;
    }
    // 3. 检查是否配置了API URL -> 未拉取
    else if (session.fetchConfig && session.fetchConfig.apiUrl) {
      newStatus = SessionStatus.UNFETCHED;
    }
    // 4. 否则为未拉取
    else {
      newStatus = SessionStatus.UNFETCHED;
    }

    // 如果状态发生变化，更新数据库
    if (session.status !== newStatus) {
      session.status = newStatus;
      await this.sessionRepository.save(session);
    }

    return newStatus;
  }
}