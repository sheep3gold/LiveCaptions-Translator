import { useState } from 'react';
import { BottomTranslator } from '../components/BottomTranslator';
import { AIChatPanel } from '../components/AIChatPanel';

interface MeetingPageProps {
  onBack?: () => void;
}

interface TranslationEntry {
  source: string;
  translated: string;
  time: Date;
}

export function MeetingPage({ onBack }: MeetingPageProps) {
  const [context, setContext] = useState('');
  const [history, setHistory] = useState<TranslationEntry[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // 构建完整的上下文（包含历史记录）
  const fullContext = history.length > 0
    ? history.slice(0, 10).map(h => `原文: ${h.source}\n翻译: ${h.translated}`).join('\n\n')
    : context;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 flex overflow-hidden">
      {/* 左侧区域（内容 + 底部翻译） */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部工具栏 */}
        <div className="flex items-center px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-gray-200">
          {/* 返回按钮 */}
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回
            </button>
          )}
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 relative overflow-hidden">
          {/* 模拟背景/视频/会议内容 */}
          <div className="absolute inset-0 m-4 bg-gray-300/50 rounded-xl flex items-center justify-center">
            <div className="text-center text-gray-500">
              <svg className="w-20 h-20 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">视频/会议内容区域</p>
            </div>
          </div>
        </div>

        {/* 底部：实时翻译模块（只在左侧） */}
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <BottomTranslator
            onContextChange={setContext}
            onHistoryChange={setHistory}
          />
        </div>
      </div>

      {/* 右侧：AI 对话面板（整列，从上到下） */}
      <div className="w-[400px] flex-shrink-0 border-l border-gray-200 flex flex-col relative bg-white">
        {/* AI 设置按钮 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-3 right-3 z-10 p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          title="AI 设置"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* 设置面板 */}
        {showSettings && (
          <div className="absolute top-14 right-3 z-20 w-72 p-4 bg-white rounded-xl shadow-2xl border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3">AI 对话设置</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <p className="text-xs text-gray-500">
                配置 API Key 后，AI 可以根据实时翻译内容回答问题。
              </p>
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}

        {/* AI 对话面板（占满整个右侧） */}
        <div className="flex-1 overflow-hidden">
          <AIChatPanel
            context={fullContext}
            apiKey={apiKey}
          />
        </div>
      </div>
    </div>
  );
}
