# Vercel 部署指南

本文档详细说明如何将项目部署到 Vercel 平台。

## 部署策略

推荐采用**分离部署**策略：

- **前端**: 部署到 Vercel（静态托管）
- **后端**: 部署到 Railway、Render 或其他支持 Node.js 的平台

这种方式具有更好的性能、稳定性和成本效益。

## 前提条件

1. 拥有 Vercel 账户
2. 项目已推送到 GitHub 仓库
3. 已准备好 MySQL 数据库（推荐使用 PlanetScale、Railway 或 Amazon RDS）
4. 已准备好后端部署平台（推荐 Railway 或 Render）

## 部署步骤

### 1. 准备数据库

由于 Vercel 是无服务器平台，需要使用外部数据库服务：

**推荐数据库服务商：**

- [PlanetScale](https://planetscale.com/) - 免费套餐包含 1 个数据库
- [Railway](https://railway.app/) - 简单易用，有免费额度
- [Amazon RDS](https://aws.amazon.com/rds/) - 企业级选择
- [Digital Ocean Managed Database](https://www.digitalocean.com/products/managed-databases)

### 2. 部署后端（推荐 Railway）

1. 登录 [Railway](https://railway.app/)
2. 点击 "New Project" -> "Deploy from GitHub repo"
3. 选择你的仓库
4. 在项目设置中配置：
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start:prod`

### 3. 部署前端到 Vercel

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Import Project"
3. 选择你的 GitHub 仓库
4. 配置项目设置：
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### 4. 配置环境变量

**后端环境变量**（在 Railway 中配置）：

```bash
# 数据库配置
DB_HOST=your-database-host
DB_PORT=3306
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_DATABASE=data_fetch_analysis
DB_SSL=true

# 应用配置
NODE_ENV=production
PORT=3001

# 前端URL（替换为你的 Vercel 域名）
FRONTEND_URL=https://your-frontend.vercel.app

# JWT密钥（生成一个强密码）
JWT_SECRET=your-super-secure-jwt-secret-key
```

**前端环境变量**（在 Vercel 中配置）：

```bash
# 后端API地址（替换为你的 Railway 域名）
REACT_APP_API_URL=https://your-backend.railway.app
```

### 5. 数据库初始化

部署完成后，需要初始化数据库：

1. 在你的本地环境中，连接到生产数据库
2. 运行数据库迁移：

```bash
# 设置生产环境变量
export DB_HOST=your-production-db-host
export DB_USERNAME=your-production-username
export DB_PASSWORD=your-production-password
export DB_DATABASE=data_fetch_analysis

# 运行迁移
cd backend
npm run db:migrate
```

### 6. 部署配置说明

项目包含以下配置文件：

- `vercel.json` - Vercel 前端部署配置
- `env.example` - 环境变量示例
- `frontend/src/services/api.ts` - API 基础配置（已配置支持环境变量）
- `backend/src/main.ts` - 后端入口文件（已配置支持 PORT 环境变量）

### 6.1 快速部署脚本

创建一个 `deploy.sh` 脚本来简化部署流程：

```bash
#!/bin/bash
echo "开始部署到生产环境..."

# 1. 确保代码已提交
git add .
git commit -m "Deploy: $(date)"
git push origin main

# 2. 部署前端到 Vercel
echo "前端将自动部署到 Vercel..."

# 3. 部署后端到 Railway
echo "后端将自动部署到 Railway..."

echo "部署完成！请检查:"
echo "- 前端: https://your-frontend.vercel.app"
echo "- 后端: https://your-backend.railway.app"
```

### 7. 自定义域名（可选）

1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Domains" 选项卡
3. 添加你的自定义域名
4. 按照说明配置 DNS 记录

## 常见问题

### Q: 部署失败，显示构建错误

A: 检查以下几点：

- 确保所有依赖都在 `package.json` 中
- 检查 TypeScript 编译错误
- 查看 Vercel 构建日志

### Q: API 请求失败

A: 检查以下几点：

- 确保环境变量配置正确
- 检查数据库连接配置
- 验证 CORS 设置

### Q: 数据库连接超时

A: 无服务器环境的数据库连接优化：

- 使用连接池
- 设置适当的超时时间
- 考虑使用数据库代理（如 PlanetScale）

### Q: 静态文件无法访问

A: 确保前端构建正确：

- 检查 `frontend/build` 目录是否生成
- 验证 `vercel.json` 中的路由配置

## 性能优化建议

1. **数据库优化**

   - 使用连接池
   - 启用查询缓存
   - 优化数据库索引

2. **前端优化**

   - 启用代码分割
   - 使用 CDN 加速
   - 压缩静态资源

3. **后端优化**
   - 减少冷启动时间
   - 使用适当的内存配置
   - 实现健康检查端点

## 监控和日志

1. 使用 Vercel Analytics 监控性能
2. 配置错误报告（如 Sentry）
3. 设置正常运行时间监控

## 备份和恢复

1. 定期备份数据库
2. 版本控制所有配置文件
3. 文档化部署流程

## 成本优化

1. 监控 Vercel 使用量
2. 优化函数执行时间
3. 合理配置缓存策略

## 获取帮助

- [Vercel 官方文档](https://vercel.com/docs)
- [NestJS 部署指南](https://docs.nestjs.com/deployment)
- [React 部署指南](https://create-react-app.dev/docs/deployment/)
