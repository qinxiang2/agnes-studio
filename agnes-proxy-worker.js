// Agnes AI CORS Proxy — Cloudflare Worker
// 部署: npx wrangler deploy
// 免费额度: 10万请求/天，全球边缘节点加速

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    // 转发到 Agnes API，保留完整路径
    const targetUrl = 'https://apihub.agnes-ai.com' + url.pathname + url.search;

    // 复制请求头（去掉 host）
    const headers = new Headers(request.headers);
    headers.set('Host', 'apihub.agnes-ai.com');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
      });

      // 添加 CORS 头
      const corsHeaders = new Headers(response.headers);
      corsHeaders.set('Access-Control-Allow-Origin', '*');
      corsHeaders.set('Access-Control-Expose-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: corsHeaders,
      });
    } catch (e) {
      return new Response(JSON.stringify({
        error: { status: 502, message: 'Proxy error: ' + e.message }
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
