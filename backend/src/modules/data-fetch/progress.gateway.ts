import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { ProgressMonitorService, ProgressUpdate } from './progress-monitor.service';

interface ClientSubscription {
  sessionIds: Set<string>;
  socket: Socket;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/progress',
})
export class ProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProgressGateway.name);
  private readonly clientSubscriptions = new Map<string, ClientSubscription>();

  constructor(private readonly progressMonitorService: ProgressMonitorService) {}

  /**
   * 客户端连接
   */
  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
    
    this.clientSubscriptions.set(client.id, {
      sessionIds: new Set(),
      socket: client,
    });

    // 发送连接确认
    client.emit('connected', {
      message: '已连接到进度监控服务',
      clientId: client.id,
    });
  }

  /**
   * 客户端断开连接
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开连接: ${client.id}`);
    this.clientSubscriptions.delete(client.id);
  }

  /**
   * 订阅会话进度
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    const subscription = this.clientSubscriptions.get(client.id);
    
    if (subscription) {
      subscription.sessionIds.add(sessionId);
      
      // 发送当前进度（如果存在）
      const currentProgress = this.progressMonitorService.getProgress(sessionId);
      if (currentProgress) {
        client.emit('progress', currentProgress);
      }
      
      this.logger.log(`客户端 ${client.id} 订阅会话 ${sessionId}`);
      
      client.emit('subscribed', {
        sessionId,
        message: `已订阅会话 ${sessionId} 的进度更新`,
      });
    }
  }

  /**
   * 取消订阅会话进度
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    const subscription = this.clientSubscriptions.get(client.id);
    
    if (subscription) {
      subscription.sessionIds.delete(sessionId);
      
      this.logger.log(`客户端 ${client.id} 取消订阅会话 ${sessionId}`);
      
      client.emit('unsubscribed', {
        sessionId,
        message: `已取消订阅会话 ${sessionId} 的进度更新`,
      });
    }
  }

  /**
   * 获取当前进度
   */
  @SubscribeMessage('getProgress')
  handleGetProgress(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    const progress = this.progressMonitorService.getProgress(sessionId);
    
    client.emit('progress', progress || {
      sessionId,
      status: 'not_found',
      message: '未找到该会话的进度信息',
    });
  }

  /**
   * 获取所有活跃进度
   */
  @SubscribeMessage('getAllActiveProgress')
  handleGetAllActiveProgress(@ConnectedSocket() client: Socket) {
    const activeProgress = this.progressMonitorService.getAllActiveProgress();
    
    client.emit('allActiveProgress', activeProgress);
  }

  /**
   * 获取进度统计
   */
  @SubscribeMessage('getStats')
  handleGetStats(@ConnectedSocket() client: Socket) {
    const stats = this.progressMonitorService.getProgressStats();
    
    client.emit('stats', stats);
  }

  /**
   * 监听进度更新事件
   */
  @OnEvent('progress.updated')
  handleProgressUpdated(payload: { sessionId: string; progress: ProgressUpdate }) {
    const { sessionId, progress } = payload;
    
    // 向订阅了该会话的所有客户端发送更新
    this.clientSubscriptions.forEach((subscription, clientId) => {
      if (subscription.sessionIds.has(sessionId)) {
        subscription.socket.emit('progress', progress);
      }
    });

    // 向所有客户端广播活跃进度统计更新
    const stats = this.progressMonitorService.getProgressStats();
    this.server.emit('statsUpdate', stats);
  }

  /**
   * 监听进度清理事件
   */
  @OnEvent('progress.cleared')
  handleProgressCleared(payload: { sessionId: string }) {
    const { sessionId } = payload;
    
    // 通知订阅了该会话的客户端
    this.clientSubscriptions.forEach((subscription) => {
      if (subscription.sessionIds.has(sessionId)) {
        subscription.socket.emit('progressCleared', { sessionId });
        subscription.sessionIds.delete(sessionId);
      }
    });
  }

  /**
   * 广播系统消息
   */
  broadcastSystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info') {
    this.server.emit('systemMessage', {
      message,
      type,
      timestamp: new Date(),
    });
    
    this.logger.log(`广播系统消息: ${message}`);
  }

  /**
   * 向特定会话的订阅者发送消息
   */
  sendToSessionSubscribers(sessionId: string, event: string, data: any) {
    this.clientSubscriptions.forEach((subscription) => {
      if (subscription.sessionIds.has(sessionId)) {
        subscription.socket.emit(event, data);
      }
    });
  }

  /**
   * 获取连接统计
   */
  getConnectionStats() {
    const totalConnections = this.clientSubscriptions.size;
    const totalSubscriptions = Array.from(this.clientSubscriptions.values())
      .reduce((sum, sub) => sum + sub.sessionIds.size, 0);
    
    return {
      totalConnections,
      totalSubscriptions,
      averageSubscriptionsPerClient: totalConnections > 0 ? totalSubscriptions / totalConnections : 0,
    };
  }

  /**
   * 强制断开所有连接（用于维护）
   */
  disconnectAllClients(reason: string = '服务维护') {
    this.server.emit('forceDisconnect', {
      reason,
      timestamp: new Date(),
    });
    
    this.server.disconnectSockets(true);
    this.clientSubscriptions.clear();
    
    this.logger.warn(`强制断开所有客户端连接: ${reason}`);
  }
}