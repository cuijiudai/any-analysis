#!/bin/bash

echo "🚀 开始部署数据拉取与分析系统到生产环境..."

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 发现未提交的更改，正在提交..."
    git add .
    read -p "请输入提交信息 (默认: Deploy updates): " commit_message
    commit_message=${commit_message:-"Deploy updates"}
    git commit -m "$commit_message"
fi

# 推送到远程仓库
echo "📤 推送代码到远程仓库..."
git push origin main

echo ""
echo "✅ 代码已推送！"
echo ""
echo "📋 部署检查列表："
echo "□ 1. 确保 Railway 中配置了正确的环境变量"
echo "□ 2. 确保 Vercel 中配置了 REACT_APP_API_URL"
echo "□ 3. 确保数据库连接正常"
echo "□ 4. 运行数据库迁移（如果需要）"
echo ""
echo "🔗 访问链接："
echo "   前端: https://your-frontend.vercel.app"
echo "   后端: https://your-backend.railway.app"
echo "   API健康检查: https://your-backend.railway.app/api/health"
echo ""
echo "💡 提示: 第一次部署需要手动配置环境变量，后续部署将自动完成。" 