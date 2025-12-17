import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// CORS 配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// DeepL 翻译代理
app.post('/api/translate/deepl', async (req, res) => {
  try {
    const { text, targetLang, apiKey } = req.body;
    
    if (!text || !targetLang || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const response = await fetch('https://api.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('DeepL API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OpenAI 翻译代理
app.post('/api/translate/openai', async (req, res) => {
  try {
    const { text, targetLang, apiKey, apiUrl, model } = req.body;
    
    if (!text || !targetLang || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const url = apiUrl || 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text to ${targetLang}. Only output the translation, no explanations.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// 启动服务器
const startServer = () => {
  // 检查是否有 SSL 证书（用于 HTTPS）
  const sslKeyPath = process.env.SSL_KEY || join(__dirname, '../ssl/key.pem');
  const sslCertPath = process.env.SSL_CERT || join(__dirname, '../ssl/cert.pem');
  
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    // HTTPS 模式
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };
    https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
      console.log(`🔒 HTTPS Server running on https://${HOST}:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } else {
    // HTTP 模式
    app.listen(PORT, HOST, () => {
      console.log(`🚀 HTTP Server running on http://${HOST}:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`⚠️  警告：生产环境建议使用 HTTPS`);
        console.log(`   将 SSL 证书放到 ssl/key.pem 和 ssl/cert.pem`);
      }
    });
  }
};

startServer();

