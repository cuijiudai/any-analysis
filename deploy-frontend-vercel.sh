#!/bin/bash

echo "🚀 准备部署前端到 Vercel..."

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查前端构建
echo "🔧 测试前端构建..."
cd frontend
if npm run build; then
    echo "✅ 前端构建成功"
    cd ..
else
    echo "❌ 前端构建失败，请检查错误并修复"
    cd ..
    exit 1
fi

# 提交更改
echo "📝 准备提交更改..."
if [[ -n $(git status --porcelain) ]]; then
    git add .
    
    read -p "请输入提交信息 (默认: Fix Vercel deployment configuration): " commit_message
    commit_message=${commit_message:-"Fix Vercel deployment configuration"}
    
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
echo "🎉 准备完成！"
echo ""
echo "📋 在 Vercel 中配置项目设置："
echo "  Root Directory: 留空"
echo "  Framework Preset: Other"
echo "  Build Command: cd frontend && npm run build"
echo "  Output Directory: frontend/build"
echo "  Install Command: cd frontend && npm install"
echo ""
echo "🔧 环境变量设置："
echo "  REACT_APP_API_URL=https://your-backend.railway.app"
echo ""
echo "📖 详细指南: 查看 VERCEL_FRONTEND_DEPLOYMENT.md"
echo ""
echo "🔗 部署链接："
echo "  Vercel Dashboard: https://vercel.com/dashboard"
echo "  导入项目: 选择你的 GitHub 仓库" 