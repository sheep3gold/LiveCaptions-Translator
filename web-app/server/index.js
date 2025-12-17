import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// 开发时用 3021（避免与 Vite 3020 冲突），生产时用 3020
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3020 : 3021);
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

// ============= 历史记录持久化 API（按天存储）=============

const DATA_DIR = join(__dirname, '../data');
const HISTORY_DIR = join(DATA_DIR, 'history');

// 确保目录存在
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// 获取日期字符串 YYYY-MM-DD
function getDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// 获取某天的历史文件路径
function getHistoryFilePath(dateStr) {
  return join(HISTORY_DIR, `${dateStr}.json`);
}

// 读取某天的历史记录
function readDayHistory(dateStr) {
  const filePath = getHistoryFilePath(dateStr);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

// 写入某天的历史记录
function writeDayHistory(dateStr, history) {
  const filePath = getHistoryFilePath(dateStr);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
}

// 获取所有历史文件列表（按日期排序）
function getHistoryFiles() {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort((a, b) => b.localeCompare(a)); // 降序，最新的在前
}

// 获取历史记录（支持分页和日期筛选）
app.get('/api/history', (req, res) => {
  try {
    const { date, days = 7 } = req.query;
    let allHistory = [];
    
    if (date) {
      // 获取指定日期的历史
      allHistory = readDayHistory(date);
    } else {
      // 获取最近 N 天的历史
      const files = getHistoryFiles().slice(0, parseInt(days));
      for (const dateStr of files) {
        const dayHistory = readDayHistory(dateStr);
        allHistory = allHistory.concat(dayHistory);
      }
    }
    
    res.json({ 
      success: true, 
      history: allHistory,
      dates: getHistoryFiles() // 返回所有可用日期
    });
  } catch (error) {
    console.error('读取历史记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取可用的历史日期列表
app.get('/api/history/dates', (req, res) => {
  try {
    const dates = getHistoryFiles();
    res.json({ success: true, dates });
  } catch (error) {
    console.error('获取历史日期失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存历史记录（追加到当天文件）
app.post('/api/history', (req, res) => {
  try {
    const { entry } = req.body;
    
    if (!entry) {
      return res.status(400).json({ success: false, error: '缺少历史记录数据' });
    }

    // 根据记录时间确定存储到哪天
    const entryDate = entry.time ? new Date(entry.time) : new Date();
    const dateStr = getDateString(entryDate);
    
    let history = readDayHistory(dateStr);

    // 添加新记录到开头
    history.unshift({
      ...entry,
      id: entry.id || Date.now(),
      savedAt: new Date().toISOString()
    });

    // 每天最多保留 500 条记录
    if (history.length > 500) {
      history = history.slice(0, 500);
    }

    writeDayHistory(dateStr, history);
    res.json({ success: true, count: history.length, date: dateStr });
  } catch (error) {
    console.error('保存历史记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量保存历史记录（按天分组存储）
app.post('/api/history/batch', (req, res) => {
  try {
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: '缺少历史记录数据' });
    }

    // 按日期分组
    const entriesByDate = {};
    for (const entry of entries) {
      const entryDate = entry.time ? new Date(entry.time) : new Date();
      const dateStr = getDateString(entryDate);
      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = [];
      }
      entriesByDate[dateStr].push({
        ...entry,
        id: entry.id || Date.now(),
        savedAt: new Date().toISOString()
      });
    }

    let totalAdded = 0;
    // 保存到各个日期文件
    for (const [dateStr, newEntries] of Object.entries(entriesByDate)) {
      let history = readDayHistory(dateStr);
      const existingIds = new Set(history.map(h => h.id));
      const uniqueEntries = newEntries.filter(e => !existingIds.has(e.id));
      history = [...uniqueEntries, ...history];
      
      // 每天最多保留 500 条
      if (history.length > 500) {
        history = history.slice(0, 500);
      }
      
      writeDayHistory(dateStr, history);
      totalAdded += uniqueEntries.length;
    }

    res.json({ success: true, added: totalAdded, dates: Object.keys(entriesByDate) });
  } catch (error) {
    console.error('批量保存历史记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清空历史记录（支持清空指定日期或全部）
app.delete('/api/history', (req, res) => {
  try {
    const { date } = req.query;
    
    if (date) {
      // 删除指定日期的历史
      const filePath = getHistoryFilePath(date);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.json({ success: true, message: `${date} 的历史记录已清空` });
    } else {
      // 删除所有历史文件
      const files = getHistoryFiles();
      for (const dateStr of files) {
        const filePath = getHistoryFilePath(dateStr);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      res.json({ success: true, message: '所有历史记录已清空', deleted: files.length });
    }
  } catch (error) {
    console.error('清空历史记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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

