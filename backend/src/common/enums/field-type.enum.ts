export enum FieldType {
  STRING = 'string',
  INTEGER = 'integer',
  NUMBER = 'number',
  DECIMAL = 'decimal',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  EMAIL = 'email',
  URL = 'url',
  JSON = 'json',
  ENUM = 'enum',
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.STRING]: '文本',
  [FieldType.INTEGER]: '整数',
  [FieldType.NUMBER]: '数值',
  [FieldType.DECIMAL]: '小数',
  [FieldType.FLOAT]: '浮点数',
  [FieldType.BOOLEAN]: '布尔值',
  [FieldType.DATE]: '日期',
  [FieldType.DATETIME]: '日期时间',
  [FieldType.EMAIL]: '邮箱',
  [FieldType.URL]: '链接',
  [FieldType.JSON]: 'JSON',
  [FieldType.ENUM]: '枚举',
};

export const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  [FieldType.STRING]: 'blue',
  [FieldType.INTEGER]: 'green',
  [FieldType.NUMBER]: 'orange',
  [FieldType.DECIMAL]: 'orange',
  [FieldType.FLOAT]: 'orange',
  [FieldType.BOOLEAN]: 'purple',
  [FieldType.DATE]: 'cyan',
  [FieldType.DATETIME]: 'cyan',
  [FieldType.EMAIL]: 'magenta',
  [FieldType.URL]: 'geekblue',
  [FieldType.JSON]: 'gold',
  [FieldType.ENUM]: 'volcano',
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  [FieldType.STRING]: '📝',
  [FieldType.INTEGER]: '🔢',
  [FieldType.NUMBER]: '💯',
  [FieldType.DECIMAL]: '💯',
  [FieldType.FLOAT]: '💯',
  [FieldType.BOOLEAN]: '✅',
  [FieldType.DATE]: '📅',
  [FieldType.DATETIME]: '📅',
  [FieldType.EMAIL]: '📧',
  [FieldType.URL]: '🔗',
  [FieldType.JSON]: '📋',
  [FieldType.ENUM]: '📋',
};