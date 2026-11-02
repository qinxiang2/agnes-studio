// Agnes AI Studio — 通用 CORS 代理 + Workers AI 生图 (Cloudflare Worker)
// 同时支持: Agnes AI / Replicate / Atlas Cloud / Cloudflare Workers AI
// 部署: npx wrangler deploy
// 免费额度: 10万请求/天 (代理)，Workers AI 每天 10,000 Neurons

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Cloudflare Workers AI 生图 / 图生图
    if (url.pathname === '/ai-image') {
      return handleAiImage(request, env);
    }

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

    // 从 query string 解析目标 URL。支持两种格式：
    //   .../?<encoded>       当前客户端/线上部署格式
    //   .../?url=<encoded>   兼容 ?url= 形式的代理
    let targetUrl = url.searchParams.get('url') || '';
    if (!targetUrl) {
      try {
        const legacy = decodeURIComponent(url.search.slice(1));
        if (legacy.startsWith('http')) targetUrl = legacy;
      } catch (e) {
        targetUrl = '';
      }
    }
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

// ─── Cloudflare Workers AI: /ai-image ──────────────────────
const AI_MODELS = {
  '@cf/black-forest-labs/flux-1-schnell': {
    kind: 'flux', defaultSteps: 4, maxSteps: 8,
  },
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    kind: 'sdxl', defaultSteps: 20, maxSteps: 20,
  },
};

function aiCors(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [
    'https://qinxiang2.github.io',
    'http://localhost:8765',
    'http://127.0.0.1:8765',
  ];
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'https://qinxiang2.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function aiJson(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

async function handleAiImage(request, env) {
  const cors = aiCors(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  if (request.method !== 'POST') {
    return aiJson({ error: 'Method not allowed' }, 405, cors);
  }

  // 可选共享密钥：wrangler secret put APP_KEY
  if (env.APP_KEY && request.headers.get('x-app-key') !== env.APP_KEY) {
    return aiJson({ error: 'Unauthorized' }, 401, cors);
  }

  if (!env.AI) {
    return aiJson({ error: 'Workers AI binding 未配置，请检查 wrangler.toml 的 [ai] binding = "AI"' }, 500, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return aiJson({ error: 'Invalid JSON' }, 400, cors);
  }

  const prompt = String(body.prompt || '').trim().slice(0, 2048);
  if (!prompt) {
    return aiJson({ error: 'prompt is required' }, 400, cors);
  }

  const model = String(body.model || '@cf/black-forest-labs/flux-1-schnell');
  const cfg = AI_MODELS[model];
  if (!cfg) {
    return aiJson({ error: 'Unsupported model' }, 400, cors);
  }

  const steps = clampInt(body.steps, 1, cfg.maxSteps, cfg.defaultSteps);
  const input = { prompt };

  if (cfg.kind === 'flux') {
    input.steps = steps;
    if (Number.isFinite(Number(body.seed))) {
      input.seed = Math.trunc(Number(body.seed));
    }
  } else {
    input.num_steps = steps;
    input.width = clampInt(body.width, 256, 2048, 1024);
    input.height = clampInt(body.height, 256, 2048, 1024);
    input.guidance = Number.isFinite(Number(body.guidance)) ? Number(body.guidance) : 7.5;
    if (body.negative_prompt) {
      input.negative_prompt = String(body.negative_prompt).slice(0, 1000);
    }
    if (Number.isFinite(Number(body.seed))) {
      input.seed = Math.trunc(Number(body.seed));
    }
    // SDXL 图生图
    if (body.image_base64) {
      input.image_b64 = String(body.image_base64);
      input.strength = Math.min(Math.max(Number(body.strength) || 0.6, 0), 1);
    }
  }

  try {
    const result = await env.AI.run(model, input);

    let bytes;
    let type = 'image/png';

    if (result instanceof ReadableStream) {
      // SDXL 等模型返回图片流
      bytes = result;
    } else if (result && typeof result.image === 'string') {
      // FLUX.1 Schnell 返回 base64 图片
      const bin = atob(result.image);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      bytes = arr;
      if (arr[0] === 0x89 && arr[1] === 0x50) type = 'image/png';
      else if (arr[0] === 0xFF && arr[1] === 0xD8) type = 'image/jpeg';
    } else if (result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
      bytes = result;
    } else {
      return aiJson({ error: 'Unexpected model output' }, 502, cors);
    }

    return new Response(bytes, {
      headers: {
        ...cors,
        'Content-Type': type,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/daily free allocation|4006/i.test(msg)) {
      return aiJson({
        error: 'Cloudflare Workers AI 今日免费 Neurons 额度已用完，UTC 00:00（北京时间 08:00）重置',
      }, 429, cors);
    }
    return aiJson({ error: msg }, 502, cors);
  }
}
