-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS data_fetch_analysis 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE data_fetch_analysis;

-- 数据会话表
CREATE TABLE IF NOT EXISTS data_sessions (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('configuring', 'fetching', 'annotating', 'analyzing', 'completed') DEFAULT 'configuring',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 拉取配置表
CREATE TABLE IF NOT EXISTS fetch_configs (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  api_url TEXT NOT NULL,
  headers JSON,
  fetch_mode ENUM('pagination', 'all') NOT NULL DEFAULT 'pagination',
  start_page INT DEFAULT 1,
  end_page INT NULL,
  page_size INT DEFAULT 20,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES data_sessions(id) ON DELETE CASCADE
);

-- 数据表结构定义表
CREATE TABLE IF NOT EXISTS data_table_schemas (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  field_definitions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES data_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_session_table (session_id, table_name)
);

-- 字段标注表
CREATE TABLE IF NOT EXISTS field_annotations (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES data_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_session_field (session_id, field_name)
);

-- 图表配置表
CREATE TABLE IF NOT EXISTS chart_configs (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  chart_type ENUM('line', 'bar', 'pie') NOT NULL,
  x_axis VARCHAR(255) NOT NULL,
  y_axis VARCHAR(255) NOT NULL,
  aggregation ENUM('sum', 'avg', 'count', 'none') DEFAULT 'none',
  filters JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES data_sessions(id) ON DELETE CASCADE
);