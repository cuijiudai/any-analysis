/**
 * 测试东方财富 API 的冒烟测试
 */

const axios = require('axios');

async function testEastmoneyAPI() {
  console.log('🧪 测试东方财富 SSE API...');
  
  try {
    // 测试完整的 URL（包含所有查询参数）
    console.log('📝 测试完整 URL（包含查询参数）');
    const response1 = await axios.post('http://localhost:3000/api/data-fetch/smoke-test', {
      apiUrl: 'https://23.newspush.eastmoney.com/sse?cb=icomet_cb_0&cname=bdc02c361aab973818f3583fb8b5e6d5&seq=78136&noop=5&token=&_=1756636096092',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Origin': 'https://data.eastmoney.com',
        'Referer': 'https://data.eastmoney.com/zlsj/sb.html',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      },
      pageSize: 20,
      addPaginationParams: false // 不添加分页参数，保持原有参数
    });

    console.log('✅ 完整 URL 测试 - 成功');
    console.log('📊 返回数据数量:', response1.data.data.length);
    console.log('🔍 数据结构字段数:', response1.data.dataStructure?.totalFields || 0);
    console.log('⏱️ 响应时间:', response1.data.responseTime, 'ms');
    console.log('📋 响应数据类型:', typeof response1.data.data);
    
    if (response1.data.data.length > 0) {
      console.log('📋 样本数据:', JSON.stringify(response1.data.data[0], null, 2));
    } else if (typeof response1.data.data === 'string') {
      console.log('📋 响应内容（前500字符）:', response1.data.data.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ 完整 URL 测试 - 失败:', error.response?.data || error.message);
    
    // 如果失败，尝试添加分页参数
    try {
      console.log('\n📝 尝试2: 添加分页参数');
      const response2 = await axios.post('http://localhost:3000/api/data-fetch/smoke-test', {
        apiUrl: 'https://data.eastmoney.com/dataapi/zlsj/list',
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://data.eastmoney.com/zlsj/sb.html',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        },
        pageSize: 20,
        addPaginationParams: true // 添加分页参数
      });

      console.log('✅ 添加分页参数 - 成功');
      console.log('📊 返回数据数量:', response2.data.data.length);
      console.log('🔍 数据结构字段数:', response2.data.dataStructure?.totalFields || 0);
      console.log('⏱️ 响应时间:', response2.data.responseTime, 'ms');
      
    } catch (error2) {
      console.error('❌ 添加分页参数 - 也失败:', error2.response?.data || error2.message);
    }
  }
}

async function testWithCommonParams() {
  console.log('\n🧪 测试带常见参数的东方财富 API...');
  
  // 尝试一些常见的参数组合
  const paramCombinations = [
    { ps: 20, p: 1 }, // 常见的分页参数
    { pageSize: 20, pageIndex: 1 },
    { size: 20, page: 1 },
    { limit: 20, offset: 0 },
    { rows: 20, start: 0 },
  ];

  for (const params of paramCombinations) {
    try {
      console.log(`📝 尝试参数: ${JSON.stringify(params)}`);
      
      // 构建带参数的URL
      const url = new URL('https://data.eastmoney.com/dataapi/zlsj/list');
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });

      const response = await axios.post('http://localhost:3000/api/data-fetch/smoke-test', {
        apiUrl: url.toString(),
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://data.eastmoney.com/zlsj/sb.html',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        },
        pageSize: 20,
        addPaginationParams: false // 不添加额外的分页参数
      });

      console.log(`✅ 参数 ${JSON.stringify(params)} - 成功`);
      console.log('📊 返回数据数量:', response.data.data.length);
      
      if (response.data.data.length > 0) {
        console.log('🎉 找到有效的参数组合！');
        console.log('📋 样本数据:', JSON.stringify(response.data.data[0], null, 2));
        break; // 找到有效组合就停止
      }
      
    } catch (error) {
      console.log(`❌ 参数 ${JSON.stringify(params)} - 失败:`, error.response?.data?.error || error.message);
    }
  }
}

async function main() {
  console.log('🚀 开始测试东方财富 API\n');
  
  // 等待服务器启动
  console.log('⏳ 等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testEastmoneyAPI();
  await testWithCommonParams();
  
  console.log('\n✨ 测试完成');
}

main().catch(console.error);