import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // 开发模式 S3 CORS 代理：拦截 /s3-cors-proxy?url=<encoded> 转发到真实 S3
    {
      name: 's3-cors-proxy',
      configureServer(server) {
        server.middlewares.use('/s3-cors-proxy', async (req, res) => {
          const targetUrl = new URL(req.url ?? '/', 'http://localhost').searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing ?url= parameter');
            return;
          }

          try {
            // Skip body collection for GET/HEAD — avoids unnecessary async wait
            let body;
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
              }
              body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
            }

            // 转发请求头，去掉代理相关头
            // 过滤 accept-encoding：阻止 S3 返回 gzip 压缩响应，
            // 避免 Node.js fetch 自动解压后 body 与 content-length/content-encoding 不匹配
            const skipReqHeaders = new Set(['host', 'connection', 'origin', 'referer', 'accept-encoding']);
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (value && !skipReqHeaders.has(key.toLowerCase())) {
                headers.set(key, Array.isArray(value) ? value.join(', ') : value);
              }
            }

            const response = await fetch(targetUrl, {
              method: req.method,
              headers,
              body,
            });

            // 写入 CORS 允许头
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', '*');
            // 转发响应头
            // 过滤 transfer-encoding（Node.js 自行管理传输编码）
            // 过滤 content-encoding / content-length（Node.js fetch 可能自动解压响应体，
            // 导致转发后的 body 与原始头不匹配，浏览器下载会失败）
            const skipHeaders = new Set(['transfer-encoding', 'content-encoding', 'content-length']);
            response.headers.forEach((value, key) => {
              if (!skipHeaders.has(key.toLowerCase())) {
                res.setHeader(key, value);
              }
            });
            res.statusCode = response.status;

            // 流式转发响应体，避免大文件全量缓冲导致卡住
            if (response.body) {
              const reader = response.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
            }
            res.end();
          } catch (err) {
            const error = err as Error;
            res.statusCode = 502;
            res.end(`Proxy error: ${error.message}`);
          }
        });
      },
    },
  ],
})
