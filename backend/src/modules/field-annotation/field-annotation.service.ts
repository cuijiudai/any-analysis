import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FieldAnnotation } from '../../entities/field-annotation.entity';
import { DataSession } from '../../entities/data-session.entity';
import { FieldType } from '../../common/enums/field-type.enum';
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly schemaAnalysisService: SchemaAnalysisService,
  ) {}

  /**
   * 将字符串转换为 FieldType 枚举
   */
  private stringToFieldType(typeString: string): FieldType {
    // 检查是否是有效的枚举值
    if (Object.values(FieldType).includes(typeString as FieldType)) {
      return typeString as FieldType;
    }
    
    // 如果不是有效的枚举值，返回默认的字符串类型
    this.logger.warn(`无效的字段类型: ${typeString}，使用默认类型 STRING`);
    return FieldType.STRING;
  }

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

    // 获取字段类型信息
    let fieldTypeString = 'string'; // 默认类型
    try {
      const fields = await this.getFieldsFromDataTable(sessionId);
      const field = fields.find(f => f.name === fieldName);
      if (field) {
        fieldTypeString = field.type;
      }
    } catch (error) {
      this.logger.warn(`获取字段类型失败，使用默认类型: ${error.message}`);
    }

    const fieldType = this.stringToFieldType(fieldTypeString);

    // 检查是否已存在标注
    let annotation = await this.fieldAnnotationRepository.findOne({
      where: { sessionId, fieldName },
    });

    if (annotation) {
      // 更新现有标注
      annotation.label = label;
      annotation.description = description;
      annotation.fieldType = fieldType; // 更新字段类型
    } else {
      // 创建新标注
      annotation = this.fieldAnnotationRepository.create({
        sessionId,
        fieldName,
        fieldType,
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
   * 更新字段类型
   */
  async updateFieldType(
    sessionId: string,
    fieldName: string,
    fieldTypeString: string
  ): Promise<FieldAnnotation> {
    // 验证会话存在
    const session = await this.dataSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`会话 ${sessionId} 不存在`);
    }

    // 转换字符串为枚举类型
    const fieldType = this.stringToFieldType(fieldTypeString);

    // 查找现有标注
    let annotation = await this.fieldAnnotationRepository.findOne({
      where: { sessionId, fieldName },
    });

    if (annotation) {
      // 更新现有标注的字段类型
      annotation.fieldType = fieldType;
    } else {
      // 如果标注不存在，创建一个新的标注
      annotation = this.fieldAnnotationRepository.create({
        sessionId,
        fieldName,
        fieldType,
        label: fieldName, // 使用字段名作为默认标签
        description: null,
      });
    }

    const savedAnnotation = await this.fieldAnnotationRepository.save(annotation);
    
    this.logger.log(`更新字段类型: ${sessionId}.${fieldName} -> ${fieldTypeString}`);
    
    return savedAnnotation;
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
    try {
      // 生成动态表名
      const tableName = `data_${sessionId.replace(/-/g, '_')}`;
      
      // 检查表是否存在
      const tableExistsQuery = `
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
      `;
      
      const tableExistsResult = await this.dataSource.query(tableExistsQuery, [tableName]);
      
      if (tableExistsResult[0].count === 0) {
        this.logger.warn(`动态表 ${tableName} 不存在，返回空字段列表`);
        return [];
      }

      // 获取表结构信息
      const columnsQuery = `
        SELECT 
          COLUMN_NAME as name,
          DATA_TYPE as type,
          IS_NULLABLE as nullable
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('id', 'session_id', 'page_number', 'data_index', 'data_hash', 'created_at')
        ORDER BY ORDINAL_POSITION
      `;
      
      const columns = await this.dataSource.query(columnsQuery, [tableName]);
      
      if (columns.length === 0) {
        this.logger.warn(`动态表 ${tableName} 没有数据字段`);
        return [];
      }

      // 获取每个字段的样本数据
      const fields = [];
      
      for (const column of columns) {
        try {
          // 获取该字段的样本值（非空值，最多5个）
          const sampleQuery = `
            SELECT DISTINCT \`${column.name}\` as value
            FROM \`${tableName}\`
            WHERE \`${column.name}\` IS NOT NULL
            AND \`${column.name}\` != ''
            LIMIT 5
          `;
          
          const sampleResult = await this.dataSource.query(sampleQuery);
          const sampleValues = sampleResult.map((row: any) => row.value);
          
          // 映射MySQL类型到应用类型
          const appType = this.mapMySQLTypeToAppType(column.type);
          
          fields.push({
            name: column.name,
            type: appType,
            suggestedLabel: this.inferFieldLabel(column.name, appType, sampleValues).label,
            sampleValues: sampleValues,
          });
          
        } catch (sampleError) {
          this.logger.warn(`获取字段 ${column.name} 样本数据失败: ${sampleError.message}`);
          
          // 即使获取样本数据失败，也要包含该字段
          const appType = this.mapMySQLTypeToAppType(column.type);
          fields.push({
            name: column.name,
            type: appType,
            suggestedLabel: this.inferFieldLabel(column.name, appType, []).label,
            sampleValues: [],
          });
        }
      }

      this.logger.log(`从动态表 ${tableName} 获取到 ${fields.length} 个字段`);
      return fields;
      
    } catch (error) {
      this.logger.error(`获取动态表字段信息失败: ${error.message}`, error.stack);
      
      // 如果获取失败，返回空数组而不是模拟数据
      return [];
    }
  }

  /**
   * 将MySQL数据类型映射到应用类型
   */
  private mapMySQLTypeToAppType(mysqlType: string): string {
    const type = mysqlType.toLowerCase();
    
    if (type.includes('int') || type.includes('bigint') || type.includes('decimal') || type.includes('double') || type.includes('float')) {
      return 'number';
    }
    
    if (type.includes('varchar') || type.includes('text') || type.includes('char')) {
      return 'string';
    }
    
    if (type.includes('datetime') || type.includes('timestamp') || type.includes('date')) {
      return 'date';
    }
    
    if (type.includes('boolean') || type.includes('tinyint(1)')) {
      return 'boolean';
    }
    
    if (type.includes('json')) {
      return 'object';
    }
    
    // 默认返回字符串类型
    return 'string';
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