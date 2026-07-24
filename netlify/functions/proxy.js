// Agnes AI Studio — 通用 CORS 代理 (Netlify Function)
// 同时支持: Agnes AI / Replicate / Atlas Cloud
// 部署: npm install -g netlify-cli && netlify deploy --prod
// 免费额度: 125k 请求/月, 100 小时执行时间/月

exports.handler = async (event) => {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // 从 URL 解析目标 URL
  // 格式: https://proxy.netlify.app/.netlify/functions/proxy?https://api.example.com/path
  let targetUrl = '';
  try {
    const rawUrl = event.rawUrl || '';
    const qIndex = rawUrl.indexOf('?');
    if (qIndex >= 0) {
      targetUrl = decodeURIComponent(rawUrl.slice(qIndex + 1));
    }
  } catch (e) {
    targetUrl = '';
  }

  // Fallback: try queryStringParameters
  if (!targetUrl && event.queryStringParameters) {
    const keys = Object.keys(event.queryStringParameters);
    if (keys.length > 0 && keys[0].startsWith('http')) {
      targetUrl = keys[0];
    }
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: { status: 400, message: 'Missing or invalid target URL in query string' }
      }),
    };
  }

  // Build headers for target request
  const headers = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'origin' || lower === 'referer') continue;
      headers[key] = value;
    }
  }

  // Set target host
  try {
    const targetParsed = new URL(targetUrl);
    headers['host'] = targetParsed.host;
  } catch (e) {}

  try {
    const fetchOptions = {
      method: event.httpMethod,
      headers,
      redirect: 'follow',
    };

    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      fetchOptions.body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': '*',
    };

    if (response.headers) {
      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === 'content-security-policy' || lower === 'x-frame-options') return;
        responseHeaders[key] = value;
      });
    }

    const body = await response.arrayBuffer();
    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: Buffer.from(body).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: { status: 502, message: 'Proxy error: ' + e.message }
      }),
    };
  }
};
