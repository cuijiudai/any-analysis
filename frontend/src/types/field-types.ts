export enum FieldType {
  STRING = "string",
  INTEGER = "integer",
  DECIMAL = "decimal",
  BOOLEAN = "boolean",
  DATE = "date",
  DATETIME = "datetime",
  EMAIL = "email",
  URL = "url",
  JSON = "json",
  ENUM = "enum",
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.STRING]: "文本",
  [FieldType.INTEGER]: "整数",
  [FieldType.DECIMAL]: "小数",
  [FieldType.BOOLEAN]: "布尔值",
  [FieldType.DATE]: "日期",
  [FieldType.DATETIME]: "日期时间",
  [FieldType.EMAIL]: "邮箱",
  [FieldType.URL]: "链接",
  [FieldType.JSON]: "JSON",
  [FieldType.ENUM]: "枚举",
};

export const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  [FieldType.STRING]: "blue",
  [FieldType.INTEGER]: "green",
  [FieldType.DECIMAL]: "orange",
  [FieldType.BOOLEAN]: "purple",
  [FieldType.DATE]: "cyan",
  [FieldType.DATETIME]: "cyan",
  [FieldType.EMAIL]: "magenta",
  [FieldType.URL]: "geekblue",
  [FieldType.JSON]: "gold",
  [FieldType.ENUM]: "volcano",
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  [FieldType.STRING]: "📝",
  [FieldType.INTEGER]: "🔢",
  [FieldType.DECIMAL]: "💯",
  [FieldType.BOOLEAN]: "✅",
  [FieldType.DATE]: "📅",
  [FieldType.DATETIME]: "📅",
  [FieldType.EMAIL]: "📧",
  [FieldType.URL]: "🔗",
  [FieldType.JSON]: "📋",
  [FieldType.ENUM]: "📋",
};

// 数值类型判断
export const isNumericType = (type: FieldType): boolean => {
  return [FieldType.INTEGER, FieldType.DECIMAL].includes(type);
};

// 日期类型判断
export const isDateType = (type: FieldType): boolean => {
  return [FieldType.DATE, FieldType.DATETIME].includes(type);
};

// 文本类型判断
export const isTextType = (type: FieldType): boolean => {
  return [
    FieldType.STRING,
    FieldType.EMAIL,
    FieldType.URL,
    FieldType.JSON,
  ].includes(type);
};
