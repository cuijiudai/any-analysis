import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { FieldAnnotationService } from './field-annotation.service';

export class SaveAnnotationDto {
  sessionId: string;
  fieldName: string;
  label: string;
  description?: string;
}

export class BatchSaveAnnotationsDto {
  sessionId: string;
  annotations: Array<{
    fieldName: string;
    label: string;
    description?: string;
  }>;
}

@Controller('field-annotation')
export class FieldAnnotationController {
  constructor(
    private readonly fieldAnnotationService: FieldAnnotationService,
  ) {}

  /**
   * 获取会话的所有字段信息和标注
   */
  @Get('fields/:sessionId')
  async getFieldsWithAnnotations(@Param('sessionId') sessionId: string) {
    const fields = await this.fieldAnnotationService.getFieldsWithAnnotations(sessionId);
    return {
      success: true,
      fields,
    };
  }

  /**
   * 获取智能标注建议
   */
  @Get('suggestions/:sessionId')
  async getAnnotationSuggestions(@Param('sessionId') sessionId: string) {
    const suggestions = await this.fieldAnnotationService.generateAnnotationSuggestions(sessionId);
    return {
      success: true,
      suggestions,
    };
  }

  /**
   * 获取标注进度
   */
  @Get('progress/:sessionId')
  async getAnnotationProgress(@Param('sessionId') sessionId: string) {
    const progress = await this.fieldAnnotationService.getAnnotationProgress(sessionId);
    return {
      success: true,
      ...progress,
    };
  }

  /**
   * 验证标注完整性
   */
  @Get('validate/:sessionId')
  async validateAnnotations(@Param('sessionId') sessionId: string) {
    const validation = await this.fieldAnnotationService.validateAnnotations(sessionId);
    return {
      success: true,
      ...validation,
    };
  }

  /**
   * 保存单个字段标注
   */
  @Post('save')
  @HttpCode(HttpStatus.OK)
  async saveAnnotation(@Body() dto: SaveAnnotationDto) {
    const annotation = await this.fieldAnnotationService.saveAnnotation(
      dto.sessionId,
      dto.fieldName,
      dto.label,
      dto.description,
    );
    
    return {
      success: true,
      annotation,
    };
  }

  /**
   * 批量保存字段标注
   */
  @Post('batch-save')
  @HttpCode(HttpStatus.OK)
  async batchSaveAnnotations(@Body() dto: BatchSaveAnnotationsDto) {
    const annotations = await this.fieldAnnotationService.batchSaveAnnotations(
      dto.sessionId,
      dto.annotations,
    );
    
    return {
      success: true,
      annotations,
      count: annotations.length,
    };
  }

  /**
   * 删除字段标注
   */
  @Delete(':sessionId/:fieldName')
  @HttpCode(HttpStatus.OK)
  async deleteAnnotation(
    @Param('sessionId') sessionId: string,
    @Param('fieldName') fieldName: string,
  ) {
    await this.fieldAnnotationService.deleteAnnotation(sessionId, fieldName);
    
    return {
      success: true,
      message: '字段标注删除成功',
    };
  }
}