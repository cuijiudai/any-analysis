# 数据拉取与分析系统

一个基于NestJS和React的全栈数据处理应用，支持从外部API拉取数据、字段标注和数据分析可视化。

## 功能特性

- 🚀 **数据拉取**: 支持分页拉取和全量拉取，可配置自定义请求头
- 🔍 **冒烟测试**: 快速验证API配置有效性
- 📝 **字段标注**: 智能推断字段含义，支持自定义标注
- 📊 **数据分析**: 多种图表类型，支持筛选和聚合分析
- 📱 **响应式设计**: 适配桌面端和移动端
- 🔧 **Curl导入**: 支持从curl命令快速导入API配置

## 技术栈

### 后端
- NestJS + TypeScript
- TypeORM + MySQL
- Axios (HTTP客户端)

### 前端
- React + TypeScript
- Ant Design (UI组件库)
- ECharts (图表库)
- Zustand (状态管理)

## 快速开始

### 环境要求

- Node.js >= 16
- MySQL >= 8.0
- npm 或 yarn

### 安装依赖

```bash
# 安装所有依赖
npm run install:all
```

### 数据库配置

1. 创建MySQL数据库：
```sql
CREATE DATABASE data_fetch_analysis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 配置数据库连接（backend/.env）：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=data_fetch_analysis
```

### 启动应用

```bash
# 同时启动前后端开发服务器
npm run dev

# 或分别启动
npm run dev:backend  # 后端服务 (端口 3001)
npm run dev:frontend # 前端服务 (端口 3000)
```

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
├── backend/                 # NestJS后端
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── modules/        # 业务模块
│   │   ├── entities/       # 数据库实体
│   │   └── main.ts         # 应用入口
│   └── package.json
├── frontend/               # React前端
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   ├── types/          # 类型定义
│   │   └── App.tsx         # 应用入口
│   └── package.json
└── package.json           # 根项目配置
```

## 使用流程

1. **配置数据拉取**: 输入API URL和认证信息
2. **冒烟测试**: 验证API配置是否正确
3. **执行拉取**: 根据配置拉取数据并存储
4. **字段标注**: 为数据字段添加含义标注
5. **数据分析**: 筛选数据并生成图表分析

## 开发指南

### 添加新的API端点

1. 在 `backend/src/modules/` 下创建新模块
2. 定义DTO、Service和Controller
3. 在对应的模块中注册

### 添加新的前端组件

1. 在 `frontend/src/components/` 下创建组件
2. 更新类型定义 `frontend/src/types/index.ts`
3. 在页面中使用组件

## 许可证

MIT License