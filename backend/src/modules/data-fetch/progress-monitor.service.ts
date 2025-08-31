import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ProgressUpdate {
  sessionId: string;
  status: 'starting' | 'analyzing' | 'creating_table' | 'fetching' | 'completed' | 'error' | 'cancelled';
  currentPage?: number;
  totalPages?: number;
  fetchedRecords: number;
  totalRecords?: number;
  message: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
  percentage?: number;
  estimatedTimeRemaining?: number;
  averagePageTime?: number;
}

@Injectable()
export class ProgressMonitorService {
  private readonly logger = new Logger(ProgressMonitorService.name);
  private readonly progressMap = new Map<string, ProgressUpdate>();
  private readonly pageTimings = new Map<string, number[]>(); // 存储每页的处理时间

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 初始化进度跟踪
   */
  initializeProgress(sessionId: string): void {
    const progress: ProgressUpdate = {
      sessionId,
      status: 'starting',
      fetchedRecords: 0,
      message: '准备开始拉取...',
      startTime: new Date(),
      percentage: 0,
    };

    this.progressMap.set(sessionId, progress);
    this.pageTimings.set(sessionId, []);
    this.emitProgress(sessionId, progress);
    
    this.logger.log(`初始化进度跟踪: ${sessionId}`);
  }

  /**
   * 更新进度
   */
  updateProgress(sessionId: string, updates: Partial<ProgressUpdate>): void {
    const current = this.progressMap.get(sessionId);
    if (!current) {
      this.logger.warn(`尝试更新不存在的进度: ${sessionId}`);
      return;
    }

    const updated: ProgressUpdate = { ...current, ...updates };

    // 计算百分比
    if (updated.totalPages && updated.currentPage) {
      updated.percentage = Math.round((updated.currentPage / updated.totalPages) * 100);
    } else if (updated.status === 'completed') {
      updated.percentage = 100;
    }

    // 计算预估剩余时间
    if (updated.currentPage && updated.totalPages && updated.currentPage > 1) {
      const timings = this.pageTimings.get(sessionId) || [];
      if (timings.length > 0) {
        const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
        const remainingPages = updated.totalPages - updated.currentPage;
        updated.estimatedTimeRemaining = Math.round(remainingPages * averageTime / 1000); // 转换为秒
        updated.averagePageTime = Math.round(averageTime);
      }
    }

    this.progressMap.set(sessionId, updated);
    this.emitProgress(sessionId, updated);

    this.logger.debug(`更新进度 ${sessionId}: ${updated.status} - ${updated.message}`);
  }

  /**
   * 记录页面处理时间
   */
  recordPageTiming(sessionId: string, pageNumber: number, processingTime: number): void {
    const timings = this.pageTimings.get(sessionId) || [];
    timings.push(processingTime);
    
    // 只保留最近10页的时间记录，用于计算平均值
    if (timings.length > 10) {
      timings.shift();
    }
    
    this.pageTimings.set(sessionId, timings);
    
    this.logger.debug(`记录页面 ${pageNumber} 处理时间: ${processingTime}ms`);
  }

  /**
   * 标记拉取完成
   */
  markCompleted(sessionId: string, totalRecords: number, totalPages: number): void {
    this.updateProgress(sessionId, {
      status: 'completed',
      totalRecords,
      totalPages,
      percentage: 100,
      endTime: new Date(),
      message: `拉取完成，共获取 ${totalRecords} 条记录`,
    });

    this.logger.log(`拉取完成: ${sessionId}, 总记录数: ${totalRecords}`);
  }

  /**
   * 标记拉取失败
   */
  markError(sessionId: string, error: string): void {
    this.updateProgress(sessionId, {
      status: 'error',
      error,
      endTime: new Date(),
      message: '拉取失败',
    });

    this.logger.error(`拉取失败: ${sessionId}, 错误: ${error}`);
  }

  /**
   * 标记拉取取消
   */
  markCancelled(sessionId: string): void {
    this.updateProgress(sessionId, {
      status: 'cancelled',
      endTime: new Date(),
      message: '拉取已取消',
    });

    this.logger.log(`拉取已取消: ${sessionId}`);
  }

  /**
   * 获取进度信息
   */
  getProgress(sessionId: string): ProgressUpdate | null {
    return this.progressMap.get(sessionId) || null;
  }

  /**
   * 获取所有活跃的进度
   */
  getAllActiveProgress(): ProgressUpdate[] {
    return Array.from(this.progressMap.values()).filter(
      progress => !['completed', 'error', 'cancelled'].includes(progress.status)
    );
  }

  /**
   * 清理进度记录
   */
  clearProgress(sessionId: string): void {
    this.progressMap.delete(sessionId);
    this.pageTimings.delete(sessionId);
    
    // 发送清理事件
    this.eventEmitter.emit('progress.cleared', { sessionId });
    
    this.logger.log(`清理进度记录: ${sessionId}`);
  }

  /**
   * 清理过期的进度记录（超过1小时的已完成/失败记录）
   */
  cleanupExpiredProgress(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const toDelete: string[] = [];

    this.progressMap.forEach((progress, sessionId) => {
      if (
        ['completed', 'error', 'cancelled'].includes(progress.status) &&
        progress.endTime &&
        progress.endTime < oneHourAgo
      ) {
        toDelete.push(sessionId);
      }
    });

    toDelete.forEach(sessionId => {
      this.clearProgress(sessionId);
    });

    if (toDelete.length > 0) {
      this.logger.log(`清理了 ${toDelete.length} 个过期的进度记录`);
    }
  }

  /**
   * 发送进度事件
   */
  private emitProgress(sessionId: string, progress: ProgressUpdate): void {
    this.eventEmitter.emit('progress.updated', {
      sessionId,
      progress,
    });
  }

  /**
   * 获取进度统计信息
   */
  getProgressStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const all = Array.from(this.progressMap.values());
    
    return {
      total: all.length,
      active: all.filter(p => !['completed', 'error', 'cancelled'].includes(p.status)).length,
      completed: all.filter(p => p.status === 'completed').length,
      failed: all.filter(p => p.status === 'error').length,
      cancelled: all.filter(p => p.status === 'cancelled').length,
    };
  }

  /**
   * 检查会话是否正在进行中
   */
  isSessionActive(sessionId: string): boolean {
    const progress = this.progressMap.get(sessionId);
    return progress ? !['completed', 'error', 'cancelled'].includes(progress.status) : false;
  }

  /**
   * 获取会话的执行时间
   */
  getExecutionTime(sessionId: string): number | null {
    const progress = this.progressMap.get(sessionId);
    if (!progress) return null;

    const endTime = progress.endTime || new Date();
    return endTime.getTime() - progress.startTime.getTime();
  }

  /**
   * 批量更新多个会话的进度
   */
  batchUpdateProgress(updates: Array<{ sessionId: string; updates: Partial<ProgressUpdate> }>): void {
    updates.forEach(({ sessionId, updates: progressUpdates }) => {
      this.updateProgress(sessionId, progressUpdates);
    });
  }
}