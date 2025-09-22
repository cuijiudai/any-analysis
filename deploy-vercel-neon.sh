#!/bin/bash

echo "🚀 开始配置 Vercel + Neon 部署..."

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

echo "📦 第一步: 安装 PostgreSQL 依赖..."
cd backend

# 安装 PostgreSQL 依赖
npm install pg @types/pg

# 卸载 MySQL 依赖 (可选)
read -p "是否要卸载 MySQL 依赖? (y/n): " remove_mysql
if [[ $remove_mysql =~ ^[Yy]$ ]]; then
    npm uninstall mysql2
    echo "✅ 已移除 MySQL 依赖"
fi

cd ..

echo "🔧 第二步: 更新环境变量示例..."
cat > env.neon.example << 'EOF'
# Vercel + Neon 环境变量配置示例

# 数据库配置 (由 Neon 集成自动设置)
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# 应用配置
NODE_ENV=production
PORT=3001

# JWT密钥 (生成一个强密码)
JWT_SECRET=your-super-secure-jwt-secret-key

# CORS 配置 (可选)
FRONTEND_URL=https://your-app.vercel.app
EOF

echo "📝 第三步: 创建部署检查清单..."
cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
# Vercel + Neon 部署检查清单

## 准备阶段
- [ ] 代码已提交到 GitHub
- [ ] 已安装 PostgreSQL 依赖 (`pg`, `@types/pg`)
- [ ] 已配置 PostgreSQL 数据库连接

## Vercel 配置
- [ ] 在 Vercel 中导入 GitHub 项目
- [ ] 配置构建设置:
  - Root Directory: 项目根目录
  - Build Command: `npm run build`
  - Output Directory: `frontend/build`
  - Install Command: `npm run install:all`

## Neon 数据库
- [ ] 从 Vercel Storage 选项卡添加 Neon 数据库
- [ ] 确认环境变量自动注入
- [ ] 运行数据库迁移

## 验证部署
- [ ] 前端页面正常加载
- [ ] API 路由可访问
- [ ] 数据库连接正常
- [ ] 功能测试通过

## 优化 (可选)
- [ ] 配置自定义域名
- [ ] 设置监控和分析
- [ ] 配置数据库分支策略
EOF

echo "📋 第四步: 准备提交更改..."

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 发现未提交的更改，准备提交..."
    git add .
    
    read -p "请输入提交信息 (默认: Configure for Vercel + Neon deployment): " commit_message
    commit_message=${commit_message:-"Configure for Vercel + Neon deployment"}
    
    git commit -m "$commit_message"
    
    read -p "是否立即推送到远程仓库? (y/n): " push_now
    if [[ $push_now =~ ^[Yy]$ ]]; then
        git push origin main
        echo "✅ 代码已推送到远程仓库"
    fi
else
    echo "ℹ️  没有需要提交的更改"
fi

echo ""
echo "🎉 配置完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. 🌐 访问 https://vercel.com/dashboard"
echo "2. 📥 点击 'Import Project' 并选择你的仓库"
echo "3. 🔧 配置构建设置 (参考 DEPLOYMENT_CHECKLIST.md)"
echo "4. 🗄️  从 Storage 选项卡添加 Neon 数据库"
echo "5. 🔄 运行数据库迁移"
echo "6. 🚀 享受你的全栈应用！"
echo ""
echo "📖 详细指南: 查看 VERCEL_NEON_DEPLOYMENT.md"
echo "📋 检查清单: 查看 DEPLOYMENT_CHECKLIST.md"
echo "🔧 环境变量: 查看 env.neon.example"

# 显示一些有用的命令
echo ""
echo "🛠️  有用的命令:"
echo "  npx vercel dev          # 本地测试 Vercel 环境"
echo "  npx vercel logs         # 查看部署日志"
echo "  npx vercel env ls       # 查看环境变量" 