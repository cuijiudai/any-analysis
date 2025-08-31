import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  getHello(): string {
    return 'Data Fetch Analysis Backend is running!';
  }

  @Get('health')
  async getHealth() {
    try {
      // 测试数据库连接
      await this.dataSource.query('SELECT 1');
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        message: 'All systems operational'
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message
      };
    }
  }
}