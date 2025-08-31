/**
 * 测试查询参数处理的脚本
 * 验证冒烟测试和正式拉取是否正确保留URL中的查询参数
 */

const axios = require('axios');

async function testSmokeTestWithQueryParams() {
  console.log('🧪 测试 GET 冒烟测试的查询参数处理...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/data-fetch/smoke-test', {
      apiUrl: 'https://jsonplaceholder.typicode.com/posts?userId=1&_limit=3',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      pageSize: 2
    });

    console.log('✅ GET 冒烟测试成功');
    console.log('📊 返回数据数量:', response.data.data.length);
    console.log('🔍 数据结构字段数:', response.data.dataStructure.totalFields);
    console.log('⏱️ 响应时间:', response.data.responseTime, 'ms');
    
    // 验证是否正确处理了查询参数
    if (response.data.data.length > 0) {
      const firstPost = response.data.data[0];
      if (firstPost.userId === 1) {
        console.log('✅ 查询参数 userId=1 正确处理');
      } else {
        console.log('❌ 查询参数处理可能有问题，userId:', firstPost.userId);
      }
    }
    
  } catch (error) {
    console.error('❌ GET 冒烟测试失败:', error.response?.data || error.message);
  }
}

async function testPostSmokeTest() {
  console.log('\n🧪 测试 POST 冒烟测试的数据处理...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/data-fetch/smoke-test', {
      apiUrl: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Test Post',
        body: 'This is a test post',
        userId: 1
      },
      pageSize: 1
    });

    console.log('✅ POST 冒烟测试成功');
    console.log('📊 返回数据:', response.data.data);
    console.log('🔍 数据结构字段数:', response.data.dataStructure.totalFields);
    console.log('⏱️ 响应时间:', response.data.responseTime, 'ms');
    
  } catch (error) {
    console.error('❌ POST 冒烟测试失败:', error.response?.data || error.message);
  }
}

async function testCurlParsing() {
  console.log('\n🔧 测试 curl 命令解析...');
  
  try {
    const curlCommand = 'curl -X GET "https://jsonplaceholder.typicode.com/posts?userId=2&_limit=5" -H "Authorization: Bearer test-token"';
    
    const response = await axios.post('http://localhost:3000/api/data-fetch/parse-curl', {
      curlCommand
    });

    console.log('✅ curl 解析成功');
    console.log('🔗 解析的 URL:', response.data.config.apiUrl);
    console.log('📋 解析的请求头:', response.data.config.headers);
    console.log('🔍 解析的查询参数:', response.data.config.queryParams);
    
  } catch (error) {
    console.error('❌ curl 解析失败:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 开始测试查询参数和 POST 数据处理功能\n');
  
  // 等待服务器启动
  console.log('⏳ 等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testSmokeTestWithQueryParams();
  await testPostSmokeTest();
  await testCurlParsing();
  
  console.log('\n✨ 测试完成');
}

main().catch(console.error);