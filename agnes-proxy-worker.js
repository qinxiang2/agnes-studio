// Agnes AI Studio — 通用 CORS 代理 (Cloudflare Worker)
// 同时支持: Agnes AI / Replicate / Atlas Cloud
// 部署: npx wrangler deploy
// 免费额度: 10万请求/天

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    // 从 query string 解析目标 URL
    // 格式: https://proxy.workers.dev/?https://api.example.com/path?params
    const targetUrl = decodeURIComponent(url.search.slice(1));
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return new Response(JSON.stringify({
        error: { status: 400, message: 'Missing or invalid target URL in query string' }
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 复制请求头（去掉 origin 和目标 host）
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('Origin');
    headers.delete('Referer');
    // 设置目标 host
    try {
      const targetParsed = new URL(targetUrl);
      headers.set('Host', targetParsed.host);
    } catch(e) {}

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
        redirect: 'follow',
      });

      // 添加 CORS 头
      const corsHeaders = new Headers(response.headers);
      corsHeaders.set('Access-Control-Allow-Origin', '*');
      corsHeaders.set('Access-Control-Expose-Headers', '*');
      // 删除可能冲突的 CSP 头
      corsHeaders.delete('Content-Security-Policy');
      corsHeaders.delete('X-Frame-Options');

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
