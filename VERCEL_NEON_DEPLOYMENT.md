# Vercel + Neon 完整部署指南

本指南将介绍如何将你的全栈应用部署到 Vercel，并使用 Neon Postgres 作为数据库。

## 🌟 优势

- **统一平台**: 前端、后端、数据库都在 Vercel 生态系统中
- **简化部署**: 一键部署，自动环境变量注入
- **成本效益**: Neon 提供慷慨的免费套餐
- **高性能**: 全球 CDN + 边缘数据库
- **开发体验**: 数据库分支、预览环境等

## 📋 前提条件

1. Vercel 账户
2. GitHub 仓库
3. 项目已配置为支持 PostgreSQL

## 🚀 部署步骤

### Step 1: 准备项目结构

我们需要重新配置 vercel.json 以支持全栈部署：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    },
    {
      "src": "backend/package.json",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["backend/dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/dist/main.js"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "installCommand": "npm run install:all",
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/build"
}
```

### Step 2: 配置数据库连接 (PostgreSQL)

更新 `backend/src/config/database.config.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from "@nestjs/typeorm";
// ... 实体导入

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres", // 改为postgres
      url: process.env.DATABASE_URL, // Neon 提供的连接URL
      entities: [
        // ... 你的实体
      ],
      synchronize: process.env.NODE_ENV === "development",
      logging: process.env.NODE_ENV === "development",
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      // Vercel 无服务器环境优化
      extra: {
        connectionLimit: 5,
        acquireTimeout: 60000,
        timeout: 60000,
      },
    };
  }
}
```

### Step 3: 部署到 Vercel

1. **推送代码到 GitHub**:

   ```bash
   git add .
   git commit -m "Configure for Vercel + Neon deployment"
   git push origin main
   ```

2. **导入项目到 Vercel**:

   - 访问 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Import Project"
   - 选择你的 GitHub 仓库
   - Vercel 会自动检测配置

3. **配置构建设置**:
   - **Root Directory**: 保持为根目录
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/build`
   - **Install Command**: `npm run install:all`

### Step 4: 添加 Neon 数据库

1. **从 Vercel Marketplace 添加 Neon**:

   - 在项目页面，点击 "Storage" 选项卡
   - 点击 "Create Database"
   - 选择 "Neon Postgres"
   - 按照向导创建数据库

2. **自动配置环境变量**:
   Neon 集成会自动添加以下环境变量：
   ```bash
   DATABASE_URL=postgresql://...
   POSTGRES_DATABASE=...
   POSTGRES_HOST=...
   POSTGRES_PASSWORD=...
   POSTGRES_PRISMA_URL=...
   POSTGRES_URL=...
   POSTGRES_URL_NON_POOLING=...
   POSTGRES_USER=...
   ```

### Step 5: 数据库迁移

1. **安装 PostgreSQL 依赖**:

   ```bash
   cd backend
   npm install pg @types/pg
   npm uninstall mysql2  # 移除 MySQL 依赖
   ```

2. **运行迁移**:

   ```bash
   # 设置环境变量（从 Vercel 项目设置复制）
   export DATABASE_URL="your-neon-database-url"

   # 运行迁移
   npm run db:migrate
   ```

### Step 6: 配置前端 API URL

更新 `frontend/src/services/api.ts`:

```typescript
const api = axios.create({
  baseURL:
    process.env.NODE_ENV === "production"
      ? "/api" // 生产环境使用相对路径
      : "/api", // 开发环境使用代理
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});
```

## 🔧 环境变量配置

### 生产环境变量

```bash
# 数据库 (由 Neon 集成自动设置)
DATABASE_URL=postgresql://...

# 应用配置
NODE_ENV=production
PORT=3001

# JWT (如果使用)
JWT_SECRET=your-super-secure-jwt-secret-key
```

## 🎯 高级功能

### 1. 数据库分支

Neon 支持数据库分支，类似 Git：

```bash
# 创建开发分支
npx neon branches create --name development

# 为预览环境创建分支
npx neon branches create --name preview-123
```

### 2. 预览环境

Vercel 会为每个 Pull Request 创建预览环境，Neon 可以自动为每个预览创建数据库分支。

### 3. 监控和分析

- **Vercel Analytics**: 前端性能监控
- **Neon Console**: 数据库监控和查询分析
- **Vercel 日志**: 后端日志查看

## 💰 成本优化

### Neon 免费套餐包含:

- **10 个项目**
- **512 MB 存储**
- **190 小时计算时间**
- **无限连接数**

### Vercel 免费套餐包含:

- **100 GB 带宽**
- **无限预览部署**
- **自定义域名**

## 🔍 故障排除

### 常见问题

1. **数据库连接失败**:

   - 检查 `DATABASE_URL` 环境变量
   - 确认 SSL 配置正确

2. **构建失败**:

   - 检查依赖安装
   - 确认 TypeScript 编译通过

3. **API 路由无法访问**:
   - 检查 `vercel.json` 路由配置
   - 确认后端构建成功

### 调试工具

```bash
# 本地测试 Vercel 环境
npx vercel dev

# 查看部署日志
npx vercel logs [deployment-url]

# 检查环境变量
npx vercel env ls
```

## 📚 相关资源

- [Vercel 文档](https://vercel.com/docs)
- [Neon 文档](https://neon.tech/docs)
- [TypeORM PostgreSQL 指南](https://typeorm.io/data-source-options#postgres--cockroachdb-data-source-options)

## 🚀 快速开始脚本

```bash
#!/bin/bash
echo "🚀 开始 Vercel + Neon 部署..."

# 1. 安装 PostgreSQL 依赖
cd backend
npm install pg @types/pg
npm uninstall mysql2

# 2. 提交更改
cd ..
git add .
git commit -m "Configure for Vercel + Neon deployment"
git push origin main

echo "✅ 代码已推送！"
echo "📋 接下来的步骤："
echo "  1. 在 Vercel 中导入项目"
echo "  2. 从 Storage 选项卡添加 Neon 数据库"
echo "  3. 运行数据库迁移"
echo "  4. 访问你的应用！"
```

这种方案提供了真正的全栈部署体验，所有服务都在同一个平台上管理，简化了开发和运维流程。
