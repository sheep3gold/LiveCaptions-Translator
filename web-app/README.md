# Live Captions Translator - Web 版

基于 Web Speech API 的实时语音翻译工具，是原 Windows LiveCaptions Translator 的 Web 版本。

## 功能特性

- 🎤 **实时语音识别** - 使用浏览器原生 Web Speech API
- 🌐 **多翻译引擎** - 支持 Google Translate、OpenAI、DeepL、LibreTranslate
- 🌍 **多语言支持** - 支持中文、英文、日文、韩文、法文等
- 📱 **响应式设计** - 支持桌面和移动设备
- 📝 **历史记录** - 自动保存翻译历史，支持导出 CSV
- 🎨 **现代 UI** - 玻璃拟态设计，支持暗色主题

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Vite
- **语音识别**: Web Speech API
- **后端**: Node.js + Express (API 代理)

## 快速开始

### 1. 安装依赖

```bash
cd web-app
npm install
```

### 2. 开发模式

```bash
# 启动前端开发服务器
npm run dev

# 在另一个终端启动后端 API 服务器（可选，用于 DeepL/OpenAI 代理）
npm run server
```

### 3. 生产构建

```bash
npm run build
npm run preview
```

## 🚀 部署到服务器

### 部署步骤

1. **构建前端**
   ```bash
   npm run build
   ```
   这会在 `dist/` 目录生成静态文件。

2. **上传到服务器**
   ```bash
   # 上传整个 web-app 目录（不包含 node_modules）
   scp -r web-app user@your-server:/path/to/app
   ```

3. **服务器上安装依赖**
   ```bash
   cd /path/to/app
   npm install --production
   ```

4. **配置环境变量**
   ```bash
   cp env.example .env
   # 编辑 .env 文件
   ```

5. **启动服务**
   ```bash
   # Linux/macOS
   npm run start
   
   # Windows
   npm run start:win
   
   # 或使用 PM2 保持运行
   pm2 start server/index.js --name live-translator
   ```

### ⚠️ 重要：HTTPS 配置

**Web Speech API 在非 localhost 环境必须使用 HTTPS！**

1. **获取 SSL 证书**
   - 免费证书：Let's Encrypt
   - 或使用 Cloudflare 等 CDN 提供的 SSL

2. **配置证书**
   ```bash
   mkdir ssl
   # 将证书文件放入
   cp /path/to/your/privkey.pem ssl/key.pem
   cp /path/to/your/fullchain.pem ssl/cert.pem
   ```

3. **服务器会自动检测并使用 HTTPS**

### 使用 Nginx 反向代理（推荐）

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### ⚠️ 网络注意事项

即使部署到服务器，**用户的浏览器仍然需要能访问 Google 服务器**才能使用语音识别功能。这是因为 Chrome 的 Web Speech API 会将音频发送到 Google 进行处理。

如果用户在中国大陆使用，需要：
- 使用 VPN，或
- 考虑使用其他语音识别方案（如 Azure Speech Services）

## 使用说明

1. **打开页面**: 使用 Chrome 或 Edge 浏览器访问应用
2. **授权麦克风**: 首次使用需要授权麦克风权限
3. **选择语言**: 设置源语言（你要说的语言）和目标语言（翻译结果语言）
4. **开始录音**: 点击麦克风按钮开始语音识别
5. **查看翻译**: 实时查看语音识别和翻译结果

## 翻译 API 配置

### Google Translate（默认）
- 无需配置，开箱即用
- 免费使用

### OpenAI / 兼容 API
- 需要配置 API Key
- 需要配置 API URL（支持 OpenAI 兼容的 API）
- 支持选择模型

### DeepL
- 需要配置 API Key
- 需要启动后端服务器进行 API 代理

### LibreTranslate
- 可配置自托管服务器地址
- 默认地址: `http://localhost:5000/translate`

## 浏览器兼容性

| 浏览器 | 语音识别支持 |
|--------|-------------|
| Chrome | ✅ 完全支持 |
| Edge | ✅ 完全支持 |
| Firefox | ❌ 不支持 |
| Safari | ⚠️ 部分支持 |

> **注意**: Web Speech API 目前在 Chrome 和 Edge 浏览器中支持最好。

## 与原 Windows 版本的区别

| 功能 | Windows 版 | Web 版 |
|------|-----------|--------|
| 语音识别 | Windows LiveCaptions | Web Speech API |
| 系统要求 | Windows 11 | 现代浏览器 |
| 安装方式 | 安装 exe | 打开网页即用 |
| 离线使用 | ✅ 支持 | ❌ 需要网络 |
| 跨平台 | ❌ 仅 Windows | ✅ 全平台 |

## 项目结构

```
web-app/
├── public/              # 静态资源
├── server/              # 后端 API 服务器
│   └── index.js
├── src/
│   ├── components/      # React 组件
│   │   ├── CaptionCard.tsx
│   │   ├── HistoryPanel.tsx
│   │   ├── Icons.tsx
│   │   └── SettingsPanel.tsx
│   ├── hooks/           # 自定义 Hooks
│   │   ├── useSpeechRecognition.ts
│   │   └── useTranslation.ts
│   ├── App.tsx          # 主应用组件
│   ├── index.css        # 全局样式
│   └── main.tsx         # 入口文件
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 开发提示

### 本地 HTTPS（可选）

如果需要在移动设备上测试，可能需要 HTTPS。可以使用 mkcert 生成本地证书：

```bash
# 安装 mkcert
brew install mkcert  # macOS
mkcert -install
mkcert localhost
```

然后在 `vite.config.ts` 中配置 HTTPS。

### 调试语音识别

在浏览器控制台中可以查看语音识别的详细日志。

## 许可证

MIT License

