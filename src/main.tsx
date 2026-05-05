import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { setupS3CorsProxy } from './utils/s3Proxy';
import App from './App';
import './index.css';

// 在任何 S3Client 创建前拦截 fetch，绕过 CORS
setupS3CorsProxy();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </StrictMode>,
);