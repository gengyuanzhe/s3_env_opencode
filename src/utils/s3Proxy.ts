/**
 * 开发模式 S3 CORS 代理
 * 拦截浏览器 fetch，将跨域 S3 请求透明转发到 Vite 中间件代理，
 * 避免 CORS 拦截，同时保持 AWS SDK SigV4 签名不变。
 */
export function setupS3CorsProxy(): void {
  if (!import.meta.env.DEV) return;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    // 仅代理跨域请求（非本站点的 http/https 请求）
    if (url.startsWith('http') && !url.includes(window.location.host)) {
      const proxyUrl = `/s3-cors-proxy?url=${encodeURIComponent(url)}`;

      if (input instanceof Request) {
        // 不能直接用 new Request(proxyUrl, input) —— 浏览器会从原始 HTTPS 请求
        // 继承连接属性（如 ALPN/HTTP2），导致代理请求失败 (ERR_ALPN_NEGOTIATION_FAILED)。
        // 必须手动提取属性，创建全新的 Request 对象。
        let body: BodyInit | undefined;
        if (init?.body) {
          body = init.body as BodyInit;
        } else if (input.body) {
          const ab = await input.arrayBuffer();
          body = new Uint8Array(ab);
        }
        return origFetch(proxyUrl, {
          method: input.method,
          headers: input.headers,
          body,
          signal: init?.signal,
          duplex: body instanceof ReadableStream ? 'half' : undefined,
        } as RequestInit);
      }
      return origFetch(proxyUrl, init);
    }

    return origFetch(input, init);
  };
}
