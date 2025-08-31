# 数据拉取与分析系统启动指南

## 前置条件
- ✅ Node.js 18+
- ✅ MySQL 数据库运行中
- ✅ 数据库 `data_fetch_analysis` 已创建

## 启动步骤

### 1. 启动后端服务
```bash
cd backend
npm install  # 如果还没安装依赖
npm run start:dev
```

后端将在 http://localhost:3001 启动

### 2. 启动前端服务
```bash
cd frontend
npm install  # 如果还没安装依赖
npm start
```

前端将在 http://localhost:3000 启动

## 验证启动

### 后端验证
访问 http://localhost:3001 应该看到 NestJS 的默认页面或API文档

### 前端验证
访问 http://localhost:3000 应该看到数据拉取与分析系统的主页面

## 故障排除

### 数据库连接问题
如果遇到数据库连接错误：

1. 确认MySQL服务运行：
```bash
brew services list | grep mysql
```

2. 测试数据库连接：
```bash
mysql -h 127.0.0.1 -u root -e "SELECT 1"
```

3. 确认数据库存在：
```bash
mysql -u root -e "SHOW DATABASES;" | grep data_fetch_analysis
```

### 端口冲突
- 后端默认端口：3001
- 前端默认端口：3000

如果端口被占用，可以修改 `.env` 文件中的端口配置。

## 已实现的功能

### ✅ 完成的功能
1. **项目初始化和基础架构** - 完整的NestJS后端和React前端
2. **数据库设计和实体** - 完整的数据库表结构和TypeORM实体
3. **数据会话管理** - 会话创建、查询、删除功能
4. **HTTP客户端服务** - 支持自定义请求头的HTTP客户端
5. **Curl解析服务** - 解析curl命令自动填充配置
6. **冒烟测试功能** - API配置验证和测试
7. **数据拉取配置** - 分页和全部拉取模式
8. **动态表结构管理** - 数据结构分析和动态表创建
9. **正式数据拉取** - 完整的数据拉取执行和进度监控
10. **字段标注功能** - 智能字段标注和批量保存
11. **数据查询和筛选** - 复杂查询、筛选、聚合功能
12. **数据表格组件** - 高级表格展示和筛选面板

### 🚧 进行中的功能
- 图表分析功能
- 历史配置管理
- 响应式布局优化

## API端点

### 数据会话
- `POST /api/data-session/create` - 创建会话
- `GET /api/data-session/:id` - 获取会话详情
- `GET /api/data-session/list` - 获取会话列表

### 数据拉取
- `POST /api/data-fetch/smoke-test` - 冒烟测试
- `POST /api/data-fetch/save-config` - 保存配置
- `POST /api/data-fetch/execute/:sessionId` - 执行拉取
- `GET /api/data-fetch/progress/:sessionId` - 获取进度

### 字段标注
- `GET /api/field-annotation/fields/:sessionId` - 获取字段信息
- `POST /api/field-annotation/batch-save` - 批量保存标注
- `GET /api/field-annotation/progress/:sessionId` - 获取标注进度

### 数据分析
- `POST /api/data-analysis/query` - 查询数据
- `GET /api/data-analysis/data/:sessionId` - 获取数据
- `POST /api/data-analysis/aggregate` - 聚合查询
- `GET /api/data-analysis/field-stats/:sessionId/:field` - 字段统计
- `POST /api/data-analysis/export` - 导出数据

## 技术栈

### 后端
- NestJS + TypeScript
- TypeORM + MySQL
- WebSocket (进度推送)
- Axios (HTTP客户端)

### 前端
- React + TypeScript
- Ant Design (UI组件)
- Axios (API调用)
- ECharts (图表库)

## 开发说明

系统采用三步骤工作流：
1. **数据拉取配置** - 配置API参数并测试连接
2. **字段标注** - 为数据字段添加有意义的标注
3. **数据分析** - 查看、筛选和分析拉取的数据

每个步骤都有完整的前后端实现，支持实时进度跟踪和错误处理。