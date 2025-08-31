/**
 * 调试冒烟测试的参数处理
 */

// 模拟冒烟测试的逻辑
function debugSmokeTest() {
  const smokeTestDto = {
    apiUrl: "https://data.eastmoney.com/dataapi/zlsj/list",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7",
      "Connection": "keep-alive",
      "Referer": "https://data.eastmoney.com/zlsj/sb.html",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest"
    },
    pageSize: 20
  };

  const { 
    apiUrl, 
    method = 'GET', 
    headers = {}, 
    data, 
    pageSize = 10,
    addPaginationParams = true 
  } = smokeTestDto;

  console.log('🔍 调试冒烟测试参数处理');
  console.log('📝 输入参数:');
  console.log('  - apiUrl:', apiUrl);
  console.log('  - method:', method);
  console.log('  - pageSize:', pageSize);
  console.log('  - addPaginationParams:', addPaginationParams);

  // 解析URL
  const parsedUrl = new URL(apiUrl);
  console.log('\n🔗 URL 解析结果:');
  console.log('  - protocol:', parsedUrl.protocol);
  console.log('  - host:', parsedUrl.host);
  console.log('  - pathname:', parsedUrl.pathname);
  console.log('  - search:', parsedUrl.search);

  // 构建基础URL
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
  console.log('  - baseUrl:', baseUrl);

  // 准备请求参数
  let requestParams = {};
  let requestData = data;

  // 保留原URL中的所有查询参数
  parsedUrl.searchParams.forEach((value, key) => {
    requestParams[key] = value;
  });
  console.log('\n📋 原始查询参数:', requestParams);

  // 检查是否已有分页相关参数
  const hasPaginationParams = parsedUrl.searchParams.has('page') || 
                              parsedUrl.searchParams.has('pageNum') ||
                              parsedUrl.searchParams.has('pageIndex') ||
                              parsedUrl.searchParams.has('offset') ||
                              parsedUrl.searchParams.has('start');
  console.log('🔍 是否已有分页参数:', hasPaginationParams);

  // 只有在明确要求添加分页参数且没有现有分页参数时才添加
  if (addPaginationParams && !hasPaginationParams) {
    console.log('✅ 添加分页参数');
    if (method === 'GET') {
      requestParams.page = 1;
      requestParams.size = pageSize;
      requestParams.limit = pageSize;
    }
  } else {
    console.log('❌ 不添加分页参数');
    console.log('  - addPaginationParams:', addPaginationParams);
    console.log('  - hasPaginationParams:', hasPaginationParams);
  }

  console.log('\n📤 最终请求参数:', requestParams);
  
  // 构建最终URL
  const finalUrl = new URL(baseUrl);
  Object.entries(requestParams).forEach(([key, value]) => {
    finalUrl.searchParams.set(key, value);
  });
  console.log('🎯 最终请求URL:', finalUrl.toString());

  return {
    baseUrl,
    requestParams,
    requestData,
    finalUrl: finalUrl.toString()
  };
}

debugSmokeTest();