import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { DataSession } from '../../entities/data-session.entity';
import { SchemaAnalysisService } from '../../common/utils/schema-analysis.service';

export interface FieldInfo {
  name: string;
  type: string;
  suggestedLabel: string;
  sampleValues: any[];
  annotation?: FieldAnnotation;
}

export interface AnnotationSuggestion {
  fieldName: string;
  suggestedLabel: string;
  confidence: number;
  reason: string;
}

@Injectable()
export class FieldAnnotationService {
  private readonly logger = new Logger(FieldAnnotationService.name);

  constructor(
    @InjectRepository(FieldAnnotation)
    private readonly fieldAnnotationRepository: Repository<FieldAnnotation>,
    @InjectRepository(DataSession)
    private readonly dataSessionRepository: Repository<DataSession>,
    private readonly schemaAnalysisService: SchemaAnalysisService,
  ) {}

  /**
   * 获取会话的所有字段信息和标注
   */
  async getFieldsWithAnnotations(sessionId: string): Promise<FieldInfo[]> {
    // 验证会话存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 获取现有标注
    const annotations = await this.fieldAnnotationRepository.find({
      where: { sessionId },
    });

    const annotationMap = new Map<string, FieldAnnotation>();
    annotations.forEach(annotation => {
      annotationMap.set(annotation.fieldName, annotation);
    });

    // 从数据表获取字段信息
    const fields = await this.getFieldsFromDataTable(sessionId);
    
    // 合并字段信息和标注
    const fieldsWithAnnotations: FieldInfo[] = fields.map(field => ({
      ...field,
      annotation: annotationMap.get(field.name),
    }));

    return fieldsWithAnnotations;
  }

  /**
   * 智能推断字段标注
   */
  async generateAnnotationSuggestions(sessionId: string): Promise<AnnotationSuggestion[]> {
    const fields = await this.getFieldsFromDataTable(sessionId);
    const suggestions: AnnotationSuggestion[] = [];

    for (const field of fields) {
      const suggestion = this.inferFieldLabel(field.name, field.type, field.sampleValues);
      suggestions.push({
        fieldName: field.name,
        suggestedLabel: suggestion.label,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
      });
    }

    return suggestions;
  }

  /**
   * 保存字段标注
   */
  async saveAnnotation(
    sessionId: string,
    fieldName: string,
    label: string,
    description?: string
  ): Promise<FieldAnnotation> {
    // 验证会话存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 检查是否已存在标注
    let annotation = await this.fieldAnnotationRepository.findOne({
      where: { sessionId, fieldName },
    });

    if (annotation) {
      // 更新现有标注
      annotation.label = label;
      annotation.description = description;
    } else {
      // 创建新标注
      annotation = this.fieldAnnotationRepository.create({
        sessionId,
        fieldName,
        label,
        description,
      });
    }

    const savedAnnotation = await this.fieldAnnotationRepository.save(annotation);
    
    this.logger.log(`保存字段标注: ${sessionId}.${fieldName} -> ${label}`);
    
    return savedAnnotation;
  }

  /**
   * 批量保存字段标注
   */
  async batchSaveAnnotations(
    sessionId: string,
    annotations: Array<{
      fieldName: string;
      label: string;
      description?: string;
    }>
  ): Promise<FieldAnnotation[]> {
    // 验证会话存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    const savedAnnotations: FieldAnnotation[] = [];

    for (const annotationData of annotations) {
      const annotation = await this.saveAnnotation(
        sessionId,
        annotationData.fieldName,
        annotationData.label,
        annotationData.description
      );
      savedAnnotations.push(annotation);
    }

    this.logger.log(`批量保存 ${savedAnnotations.length} 个字段标注`);

    return savedAnnotations;
  }

  /**
   * 删除字段标注
   */
  async deleteAnnotation(sessionId: string, fieldName: string): Promise<void> {
    const result = await this.fieldAnnotationRepository.delete({
      sessionId,
      fieldName,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`字段标注不存在: ${sessionId}.${fieldName}`);
    }

    this.logger.log(`删除字段标注: ${sessionId}.${fieldName}`);
  }

  /**
   * 获取标注进度
   */
  async getAnnotationProgress(sessionId: string): Promise<{
    totalFields: number;
    annotatedFields: number;
    progress: number;
    missingAnnotations: string[];
  }> {
    const fields = await this.getFieldsFromDataTable(sessionId);
    const annotations = await this.fieldAnnotationRepository.find({
      where: { sessionId },
    });

    const annotatedFieldNames = new Set(annotations.map(a => a.fieldName));
    const missingAnnotations = fields
      .map(f => f.name)
      .filter(name => !annotatedFieldNames.has(name));

    const totalFields = fields.length;
    const annotatedFields = annotations.length;
    const progress = totalFields > 0 ? Math.round((annotatedFields / totalFields) * 100) : 0;

    return {
      totalFields,
      annotatedFields,
      progress,
      missingAnnotations,
    };
  }

  /**
   * 从数据表获取字段信息
   */
  private async getFieldsFromDataTable(sessionId: string): Promise<Array<{
    name: string;
    type: string;
    suggestedLabel: string;
    sampleValues: any[];
  }>> {
    // 这里应该从动态表中获取实际的字段信息
    // 为了简化，我们返回一个模拟的字段列表
    // 在实际实现中，应该查询 DataTableSchema 或直接查询动态表结构

    const mockFields = [
      {
        name: 'id',
        type: 'integer',
        suggestedLabel: 'ID',
        sampleValues: [1, 2, 3],
      },
      {
        name: 'name',
        type: 'string',
        suggestedLabel: '姓名',
        sampleValues: ['张三', '李四', '王五'],
      },
      {
        name: 'email',
        type: 'email',
        suggestedLabel: '邮箱地址',
        sampleValues: ['zhang@example.com', 'li@example.com'],
      },
      {
        name: 'created_at',
        type: 'date',
        suggestedLabel: '创建时间',
        sampleValues: ['2023-01-01', '2023-01-02'],
      },
    ];

    return mockFields.map(field => ({
      ...field,
      suggestedLabel: this.inferFieldLabel(field.name, field.type, field.sampleValues).label,
    }));
  }

  /**
   * 智能推断字段标签
   */
  private inferFieldLabel(
    fieldName: string, 
    fieldType: string, 
    sampleValues: any[]
  ): {
    label: string;
    confidence: number;
    reason: string;
  } {
    const name = fieldName.toLowerCase();
    
    // 基于字段名称的推断规则
    const nameRules: Array<{ pattern: RegExp; label: string; confidence: number }> = [
      { pattern: /^id$/i, label: 'ID', confidence: 0.95 },
      { pattern: /^.*_id$/i, label: '关联ID', confidence: 0.9 },
      { pattern: /^(name|title|subject)$/i, label: '名称', confidence: 0.9 },
      { pattern: /^(first_?name|given_?name)$/i, label: '名字', confidence: 0.9 },
      { pattern: /^(last_?name|family_?name|surname)$/i, label: '姓氏', confidence: 0.9 },
      { pattern: /^(email|mail|email_?address)$/i, label: '邮箱地址', confidence: 0.95 },
      { pattern: /^(phone|telephone|mobile|cell)$/i, label: '电话号码', confidence: 0.9 },
      { pattern: /^(address|addr)$/i, label: '地址', confidence: 0.85 },
      { pattern: /^(city|town)$/i, label: '城市', confidence: 0.85 },
      { pattern: /^(state|province)$/i, label: '省份/州', confidence: 0.85 },
      { pattern: /^(country|nation)$/i, label: '国家', confidence: 0.85 },
      { pattern: /^(zip|postal_?code)$/i, label: '邮政编码', confidence: 0.85 },
      { pattern: /^(age|years_?old)$/i, label: '年龄', confidence: 0.9 },
      { pattern: /^(gender|sex)$/i, label: '性别', confidence: 0.9 },
      { pattern: /^(birth_?date|birthday|dob)$/i, label: '出生日期', confidence: 0.9 },
      { pattern: /^(created_?at|create_?time|creation_?date)$/i, label: '创建时间', confidence: 0.95 },
      { pattern: /^(updated_?at|update_?time|modification_?date)$/i, label: '更新时间', confidence: 0.95 },
      { pattern: /^(deleted_?at|delete_?time)$/i, label: '删除时间', confidence: 0.95 },
      { pattern: /^(status|state)$/i, label: '状态', confidence: 0.85 },
      { pattern: /^(type|category|kind)$/i, label: '类型', confidence: 0.8 },
      { pattern: /^(description|desc|note|comment)$/i, label: '描述', confidence: 0.85 },
      { pattern: /^(price|cost|amount|fee)$/i, label: '价格/金额', confidence: 0.85 },
      { pattern: /^(quantity|qty|count|number)$/i, label: '数量', confidence: 0.8 },
      { pattern: /^(url|link|website)$/i, label: '网址链接', confidence: 0.9 },
      { pattern: /^(image|img|picture|photo)$/i, label: '图片', confidence: 0.85 },
      { pattern: /^(file|filename|document)$/i, label: '文件', confidence: 0.8 },
    ];

    // 尝试匹配字段名称规则
    for (const rule of nameRules) {
      if (rule.pattern.test(name)) {
        return {
          label: rule.label,
          confidence: rule.confidence,
          reason: `基于字段名称 "${fieldName}" 的模式匹配`,
        };
      }
    }

    // 基于字段类型的推断
    const typeLabels: Record<string, string> = {
      email: '邮箱地址',
      url: '网址链接',
      date: '日期时间',
      boolean: '布尔值',
      integer: '整数',
      number: '数值',
    };

    if (typeLabels[fieldType]) {
      return {
        label: typeLabels[fieldType],
        confidence: 0.7,
        reason: `基于字段类型 "${fieldType}" 的推断`,
      };
    }

    // 基于样本值的推断
    if (sampleValues.length > 0) {
      const firstValue = sampleValues[0];
      
      if (typeof firstValue === 'string') {
        if (firstValue.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
          return {
            label: '邮箱地址',
            confidence: 0.8,
            reason: '基于样本值格式识别为邮箱',
          };
        }
        
        if (firstValue.match(/^https?:\/\//)) {
          return {
            label: '网址链接',
            confidence: 0.8,
            reason: '基于样本值格式识别为URL',
          };
        }
      }
    }

    // 默认标签
    const defaultLabel = fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      label: defaultLabel,
      confidence: 0.5,
      reason: '基于字段名称的默认转换',
    };
  }

  /**
   * 验证标注完整性
   */
  async validateAnnotations(sessionId: string): Promise<{
    isComplete: boolean;
    missingFields: string[];
    errors: string[];
  }> {
    const progress = await this.getAnnotationProgress(sessionId);
    const annotations = await this.fieldAnnotationRepository.find({
      where: { sessionId },
    });

    const errors: string[] = [];

    // 检查标注是否为空
    annotations.forEach(annotation => {
      if (!annotation.label || annotation.label.trim() === '') {
        errors.push(`字段 "${annotation.fieldName}" 的标注不能为空`);
      }
    });

    return {
      isComplete: progress.progress === 100,
      missingFields: progress.missingAnnotations,
      errors,
    };
  }
}