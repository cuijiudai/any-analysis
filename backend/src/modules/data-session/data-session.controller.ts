import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DataSessionService } from './data-session.service';
import { CreateSessionDto, UpdateSessionDto, SessionListQueryDto } from './dto';

@Controller('data-session')
export class DataSessionController {
  constructor(private readonly dataSessionService: DataSessionService) {}

  /**
   * 创建新的数据会话
   */
  @Post()
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    const session = await this.dataSessionService.createSession(createSessionDto);
    return {
      success: true,
      data: session,
      message: '会话创建成功',
    };
  }

  /**
   * 获取会话列表
   */
  @Get()
  async getSessionList(@Query() queryDto: SessionListQueryDto) {
    const result = await this.dataSessionService.getSessionList(queryDto);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取会话详情
   */
  @Get(':id')
  async getSessionById(@Param('id') id: string) {
    const session = await this.dataSessionService.getSessionById(id);
    return {
      success: true,
      data: session,
    };
  }

  /**
   * 更新会话信息
   */
  @Put(':id')
  async updateSession(
    @Param('id') id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    const session = await this.dataSessionService.updateSession(id, updateSessionDto);
    return {
      success: true,
      data: session,
      message: '会话更新成功',
    };
  }

  /**
   * 删除会话
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@Param('id') id: string) {
    await this.dataSessionService.deleteSession(id);
    return {
      success: true,
      message: '会话删除成功',
    };
  }

  /**
   * 获取会话统计信息
   */
  @Get(':id/stats')
  async getSessionStats(@Param('id') id: string) {
    const stats = await this.dataSessionService.getSessionStats(id);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 复制会话
   */
  @Post(':id/duplicate')
  async duplicateSession(
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    const newSession = await this.dataSessionService.duplicateSession(id, body.name);
    return {
      success: true,
      data: newSession,
      message: '会话复制成功',
    };
  }

  /**
   * 批量删除会话
   */
  @Delete('batch')
  @HttpCode(HttpStatus.OK)
  async batchDeleteSessions(@Body() body: { ids: string[] }) {
    await this.dataSessionService.batchDeleteSessions(body.ids);
    return {
      success: true,
      message: '批量删除成功',
    };
  }
}