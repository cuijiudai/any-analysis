import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { MarketService } from './market.service';
import { ShareSessionDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @UseGuards(JwtAuthGuard)
  @Post('share')
  async shareSession(@Request() req, @Body() shareSessionDto: ShareSessionDto) {
    const result = await this.marketService.shareSession(req.user.id, shareSessionDto);
    return {
      success: true,
      data: result,
      message: '分享成功，等待审核',
    };
  }

  @Get('sessions')
  async getMarketSessions(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
  ) {
    const tagArray = tags ? tags.split(',') : undefined;
    const result = await this.marketService.getMarketSessions(page, pageSize, tagArray, search);
    return {
      success: true,
      data: result,
    };
  }

  @Get('sessions/:id')
  async getMarketSession(@Param('id') id: string) {
    const result = await this.marketService.getMarketSession(id);
    return {
      success: true,
      data: result,
    };
  }

  @Post('sessions/:id/download')
  async downloadSession(@Param('id') id: string) {
    const result = await this.marketService.downloadSession(id);
    return {
      success: true,
      data: result,
      message: '获取配置成功',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/copy')
  async copySession(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const result = await this.marketService.copySession(id, userId);
    return {
      success: true,
      data: result,
      message: '复制成功',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel/:sessionId')
  async cancelShare(@Request() req, @Param('sessionId') sessionId: string) {
    const result = await this.marketService.cancelShare(req.user.id, sessionId);
    return {
      success: true,
      data: result,
      message: '取消分享成功',
    };
  }
}