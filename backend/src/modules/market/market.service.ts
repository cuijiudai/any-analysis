import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketSession } from '../../entities/market-session.entity';
import { DataSession } from '../../entities/data-session.entity';
import { FetchConfig } from '../../entities/fetch-config.entity';
import { ShareSessionDto } from './dto';
import { DataFetchService } from '../data-fetch/data-fetch.service';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketSession)
    private readonly marketSessionRepository: Repository<MarketSession>,
    @InjectRepository(DataSession)
    private readonly dataSessionRepository: Repository<DataSession>,
    @InjectRepository(FetchConfig)
    private readonly fetchConfigRepository: Repository<FetchConfig>,
    @Inject(forwardRef(() => DataFetchService))
    private readonly dataFetchService: DataFetchService,
  ) {}

  async shareSession(userId: string, shareSessionDto: ShareSessionDto) {
    const { sessionId, title, description, tags } = shareSessionDto;

    // 验证会话是否存在
    const dataSession = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!dataSession) {
      throw new NotFoundException('会话不存在');
    }

    // 如果会话没有用户ID，则更新为当前用户
    if (!dataSession.userId) {
      dataSession.userId = userId;
      await this.dataSessionRepository.save(dataSession);
    } else if (dataSession.userId !== userId) {
      throw new NotFoundException('无权限分享此会话');
    }

    // 检查是否已经有启用的分享
    const existingShare = await this.marketSessionRepository.findOne({
      where: { sessionId, userId, status: 'enabled' as any },
    });

    if (existingShare) {
      throw new ForbiddenException('该会话已经分享过了');
    }

    // 创建市场分享
    const marketSession = this.marketSessionRepository.create({
      userId,
      sessionId,
      title,
      description,
      tags,
    });

    return await this.marketSessionRepository.save(marketSession);
  }

  async cancelShare(userId: string, sessionId: string) {
    const marketSession = await this.marketSessionRepository.findOne({
      where: { sessionId, userId, status: 'enabled' as any },
    });

    if (!marketSession) {
      throw new NotFoundException('分享不存在或已被取消');
    }

    marketSession.status = 'disabled' as any;
    return await this.marketSessionRepository.save(marketSession);
  }

  async getMarketSessions(page: number = 1, pageSize: number = 20, tags?: string[], search?: string) {
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    
    const queryBuilder = this.marketSessionRepository.createQueryBuilder('marketSession')
      .leftJoinAndSelect('marketSession.user', 'user')
      .leftJoinAndSelect('marketSession.dataSession', 'dataSession')
      .where('marketSession.status = :status', { status: 'enabled' });

    // 搜索功能
    if (search) {
      queryBuilder.andWhere(
        '(marketSession.title LIKE :search OR marketSession.description LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // 标签筛选
    if (tags && tags.length > 0) {
      queryBuilder.andWhere('JSON_CONTAINS(marketSession.tags, :tags)', {
        tags: JSON.stringify(tags)
      });
    }

    const [items, total] = await queryBuilder
      .orderBy('marketSession.createdAt', 'DESC')
      .skip((pageNum - 1) * pageSizeNum)
      .take(pageSizeNum)
      .getManyAndCount();

    return {
      items,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
    };
  }

  async getMarketSession(id: string) {
    const marketSession = await this.marketSessionRepository.findOne({
      where: { id },
      relations: ['user', 'dataSession'],
    });

    if (!marketSession) {
      throw new NotFoundException('分享会话不存在');
    }

    // 增加浏览次数
    await this.marketSessionRepository.increment({ id }, 'viewCount', 1);

    return marketSession;
  }

  async downloadSession(id: string) {
    const marketSession = await this.marketSessionRepository.findOne({
      where: { id },
      relations: ['dataSession', 'dataSession.fetchConfig'],
    });

    if (!marketSession) {
      throw new NotFoundException('分享会话不存在');
    }

    // 增加下载次数
    await this.marketSessionRepository.increment({ id }, 'downloadCount', 1);

    return {
      session: marketSession.dataSession,
      config: marketSession.dataSession.fetchConfig,
    };
  }

  async copySession(id: string, userId?: string) {
    const marketSession = await this.marketSessionRepository.findOne({
      where: { id },
      relations: ['dataSession', 'dataSession.fetchConfig'],
    });

    if (!marketSession) {
      throw new NotFoundException('分享会话不存在');
    }

    // 增加下载次数
    await this.marketSessionRepository.increment({ id }, 'downloadCount', 1);

    // 创建新的数据会话
    const newSession = this.dataSessionRepository.create({
      name: `复制${marketSession.title}`,
      userId: userId,
      status: 'unfetched' as any,
    });

    const savedSession = await this.dataSessionRepository.save(newSession);

    // 如果原会话有拉取配置，复制配置
    if (marketSession.dataSession.fetchConfig) {
      const originalConfig = marketSession.dataSession.fetchConfig;
      
      // 复制配置数据
      const newConfig = this.fetchConfigRepository.create({
        sessionId: savedSession.id,
        apiUrl: originalConfig.apiUrl,
        method: originalConfig.method,
        headers: originalConfig.headers,
        queryParams: originalConfig.queryParams,
        data: originalConfig.data,
        dataPath: originalConfig.dataPath,
        enablePagination: originalConfig.enablePagination,
        paginationType: originalConfig.paginationType,
        pageField: originalConfig.pageField,
        pageFieldStartValue: originalConfig.pageFieldStartValue,
        totalField: originalConfig.totalField,
        pageSize: originalConfig.pageSize,
        stepSize: originalConfig.stepSize,
      });
      
      await this.fetchConfigRepository.save(newConfig);
    }

    return {
      sessionId: savedSession.id,
      originalTitle: marketSession.title,
    };
  }
}