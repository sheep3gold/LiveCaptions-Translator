import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTranslation, TranslationAPI } from '../hooks/useTranslation';

interface TranslationEntry {
  source: string;
  translated: string;
  time: Date;
  api: string;
}

interface BottomTranslatorProps {
  onContextChange?: (context: string) => void;
  onHistoryChange?: (history: TranslationEntry[]) => void;
}

const SOURCE_LANGUAGES = [
  { code: '', name: '自动识别' },
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'zh-TW', name: '中文（繁體）' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'es-ES', name: 'Español' },
];

const TARGET_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'es-ES', name: 'Español' },
  { code: 'ru-RU', name: 'Русский' },
];

const TRANSLATION_APIS: { code: TranslationAPI; name: string }[] = [
  { code: 'google', name: 'Google 翻译' },
  { code: 'openai', name: 'OpenAI' },
  { code: 'deepl', name: 'DeepL' },
];

export function BottomTranslator({ onContextChange, onHistoryChange }: BottomTranslatorProps) {
  const [sourceLanguage, setSourceLanguage] = useState(''); // 空字符串表示自动识别
  const [targetLanguage, setTargetLanguage] = useState('zh-CN');
  const [apiType, setApiType] = useState<TranslationAPI>('google');
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [history, setHistory] = useState<TranslationEntry[]>([]);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [apiKey, setApiKey] = useState('');
  
  // 历史记录相关状态
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPageSize] = useState(30);
  const [showSessionHistory, setShowSessionHistory] = useState(false); // 显示当前会话记录
  
  const lastTranslatedTextRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTogglingRef = useRef(false); // 防止快速双击

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language: sourceLanguage, // 空字符串表示自动识别
    continuous: true,
    interimResults: true,
  });

  // 打印语音识别状态变化
  useEffect(() => {
    console.log('[BottomTranslator] isListening:', isListening, 'sourceLanguage:', sourceLanguage || 'auto');
  }, [isListening, sourceLanguage]);

  const {
    translatedText,
    isTranslating,
    translate,
    clearTranslation,
  } = useTranslation({
    apiType,
    targetLanguage,
    apiKey: apiKey || undefined,
  });

  useEffect(() => {
    const textToTranslate = transcript + interimTranscript;
    
    if (!textToTranslate.trim()) return;
    if (textToTranslate === lastTranslatedTextRef.current) return;
    
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    
    translationTimeoutRef.current = setTimeout(() => {
      lastTranslatedTextRef.current = textToTranslate;
      translate(textToTranslate);
    }, 300);
    
    return () => {
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    };
  }, [transcript, interimTranscript, translate]);

  useEffect(() => {
    if (transcript && translatedText && !isTranslating) {
      const lastEntry = history[0];
      if (!lastEntry || lastEntry.source !== transcript) {
        const apiName = TRANSLATION_APIS.find(a => a.code === apiType)?.name || apiType;
        const newHistory = [{
          source: transcript,
          translated: translatedText,
          time: new Date(),
          api: apiName,
        }, ...history].slice(0, 100);
        setHistory(newHistory);
        onHistoryChange?.(newHistory);
      }
      
      const contextText = `原文：${transcript}\n翻译：${translatedText}`;
      onContextChange?.(contextText);
    }
  }, [transcript, translatedText, isTranslating, history, onContextChange, onHistoryChange, apiType]);

  const handleToggleListening = useCallback(() => {
    // 防止快速双击
    if (isTogglingRef.current) {
      console.log('[BottomTranslator] Ignoring rapid click');
      return;
    }
    
    console.log('[BottomTranslator] handleToggleListening called, current isListening:', isListening);
    isTogglingRef.current = true;
    
    // 500ms 后解除锁定
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 500);
    
    if (isListening) {
      console.log('[BottomTranslator] Stopping...');
      stopListening();
    } else {
      console.log('[BottomTranslator] Starting...');
      resetTranscript();
      clearTranslation();
      lastTranslatedTextRef.current = '';
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, clearTranslation]);

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  // 过滤和分页历史记录
  const filteredHistory = history.filter(item => 
    historySearch === '' || 
    item.source.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.translated.toLowerCase().includes(historySearch.toLowerCase())
  );
  
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  const containerBg = isDarkTheme ? 'bg-gray-900' : 'bg-white';
  const contentBg = isDarkTheme ? 'bg-gray-800' : 'bg-[#F0F1F4]';
  const iconColor = isDarkTheme ? 'text-gray-300' : 'text-[#1e3a5f]';

  return (
    <div 
      className={`flex overflow-hidden ${containerBg}`}
      style={{ 
        // Card4: 圆角16px，阴影 offset 0px 8px, blur 10px, spread -5px
        borderRadius: '16px',
        boxShadow: '0 8px 10px -5px rgba(0, 0, 0, 0.1)',
        minHeight: '219px',
      }}
    >
      {/* 左侧边栏 - 无边框，融合设计 */}
      <div className={`w-12 py-3 flex flex-col items-center ${containerBg} flex-shrink-0`}>
        {/* 左上角小图标 */}
        <div className="mb-3">
          <img 
            src="/images/Group 96.png" 
            alt="AI" 
            className="w-6 h-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center hidden">
            <span className="text-white text-[8px] font-bold">AI</span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('home')}
          className={`p-2 rounded-lg transition-colors mb-2 ${activeTab === 'home' ? (isDarkTheme ? 'bg-gray-700' : 'bg-blue-50') : (isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
          title="主页"
        >
          <svg className={`w-5 h-5 ${activeTab === 'home' ? 'text-blue-600' : iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`p-2 rounded-lg transition-colors mb-2 ${activeTab === 'history' ? (isDarkTheme ? 'bg-gray-700' : 'bg-blue-50') : (isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
          title="历史记录"
        >
          <svg className={`w-5 h-5 ${activeTab === 'history' ? 'text-blue-600' : iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? (isDarkTheme ? 'bg-gray-700' : 'bg-blue-50') : (isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
          title="设置"
        >
          <svg className={`w-5 h-5 ${activeTab === 'settings' ? 'text-blue-600' : iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部标题栏 */}
        <div className={`flex items-center justify-between px-4 py-2 ${containerBg}`}>
          {/* 左侧：标题 */}
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
              Live Captions Translator
            </span>
          </div>

          {/* 右侧：控制按钮组 */}
          <div className="flex items-center gap-1">
            {/* 历史记录按钮 */}
            <button
              onClick={() => setShowSessionHistory(!showSessionHistory)}
              className={`p-2 rounded-lg transition-colors ${
                showSessionHistory 
                  ? 'bg-blue-100 text-blue-600' 
                  : `${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`
              }`}
              title="历史记录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* 主题切换 */}
            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
              title={isDarkTheme ? '切换到亮色主题' : '切换到暗色主题'}
            >
              {isDarkTheme ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* 开始/暂停翻译 */}
            <button
              onClick={handleToggleListening}
              className={`p-2 rounded-lg transition-colors ${
                isListening 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : `${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`
              }`}
              title={isListening ? '暂停翻译' : '开始翻译'}
              disabled={!isSupported}
            >
              {isListening ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* 窗口模式 */}
            <button
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
              title="窗口模式"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* 置顶 */}
            <button
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
              title="置顶"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {/* 最小化 */}
            <button
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
              title="最小化"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            {/* 关闭 */}
            <button
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100'} ${iconColor}`}
              title="关闭"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className={`flex-1 overflow-auto ${containerBg}`}>
          {activeTab === 'home' && (
            <div className="px-4 pb-4">
              {/* 当前会话历史记录（卡片格式）- 点击顶部历史按钮后显示 */}
              {showSessionHistory ? (
                <div 
                  className={contentBg}
                  style={{ 
                    borderRadius: '12px',
                    minHeight: '152px',
                    border: isDarkTheme ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
                  }}
                >
                  {history.length === 0 ? (
                    <div className="flex items-center justify-center h-[152px]">
                      <p className={`text-sm ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                        暂无历史记录
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-auto">
                      {history.map((item, index) => (
                        <div 
                          key={index}
                          className={`px-5 py-3 ${index < history.length - 1 ? (isDarkTheme ? 'border-b border-gray-700' : 'border-b border-gray-200/50') : ''}`}
                        >
                          {/* 原文 - 小字体 */}
                          <p 
                            className="text-sm leading-relaxed mb-2"
                            style={{ 
                              fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                              fontWeight: 400,
                              color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
                            }}
                          >
                            {item.source}
                          </p>
                          {/* 译文 - 大字体加粗 */}
                          <p 
                            className="text-base leading-relaxed"
                            style={{ 
                              fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                              fontWeight: 500,
                              color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
                            }}
                          >
                            {item.translated}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 原文和译文共用一个灰色背景区域 - Rectangle 18390: 圆角12px, 背景#F0F1F4, 内边框1px #000000 10% */
              <div 
                className={contentBg}
                style={{ 
                  borderRadius: '12px',
                  padding: '16px 20px 20px 20px',
                  minHeight: '152px',
                  border: isDarkTheme ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
                }}
              >
                {/* 错误提示 */}
                {speechError && (
                  <div className={`mb-3 p-3 rounded-lg text-sm ${isDarkTheme ? 'bg-red-900/50 text-red-200' : 'bg-red-100 text-red-700'}`}>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{speechError}</span>
                    </div>
                  </div>
                )}

                {/* 原文区域 - 上方，小字体，Regular，60%透明度 */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDarkTheme ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-600'}`}>
                      原文
                    </span>
                    {isListening && (
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                    {/* 原文文本：PingFang SC-Regular，#000000 60% */}
                    <span 
                      className="text-sm leading-relaxed"
                      style={{ 
                        fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        fontWeight: 400,
                        color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
                      }}
                    >
                      {displayText || (isListening ? '正在聆听...' : '点击播放按钮开始语音识别')}
                    </span>
                  </div>
                </div>

                {/* 译文区域 - 下方，大字体，Medium，90%透明度 */}
                <div>
                  {/* 译文文本：PingFang SC-Medium，#000000 90% */}
                  <p 
                    className="text-base leading-relaxed"
                    style={{ 
                      fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      fontWeight: 500,
                      color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
                    }}
                  >
                    {translatedText || (isTranslating ? '翻译中...' : '翻译结果将显示在这里')}
                  </p>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-4">
              {/* 顶部工具栏：分页 + 搜索 */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                {/* 分页控制 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className={`p-1 rounded ${historyPage <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'} ${iconColor}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    {historyPage}/{Math.max(1, Math.ceil(filteredHistory.length / historyPageSize))}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredHistory.length / historyPageSize), p + 1))}
                    disabled={historyPage >= Math.ceil(filteredHistory.length / historyPageSize)}
                    className={`p-1 rounded ${historyPage >= Math.ceil(filteredHistory.length / historyPageSize) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'} ${iconColor}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    {historyPageSize}/page
                  </span>
                </div>

                {/* 搜索框 */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    placeholder="Search"
                    className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 ${
                      isDarkTheme 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* 表头 */}
              <div className={`grid grid-cols-12 gap-2 py-2 border-b text-xs font-medium ${isDarkTheme ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                <div className="col-span-2">Time</div>
                <div className="col-span-4">Caption</div>
                <div className="col-span-4">Translated</div>
                <div className="col-span-2 text-right">API</div>
              </div>

              {/* 历史记录列表 */}
              {filteredHistory.length === 0 ? (
                <p className={`text-sm text-center py-8 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                  暂无历史记录
                </p>
              ) : (
                <div className="max-h-[250px] overflow-auto">
                  {paginatedHistory.map((item, index) => (
                    <div 
                      key={index} 
                      className={`grid grid-cols-12 gap-2 py-2 text-xs border-b ${isDarkTheme ? 'border-gray-800' : 'border-gray-100'} hover:${isDarkTheme ? 'bg-gray-800' : 'bg-gray-50'}`}
                    >
                      <div className={`col-span-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.time.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} {item.time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div 
                        className="col-span-4 truncate"
                        style={{ color: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}
                        title={item.source}
                      >
                        {item.source}
                      </div>
                      <div 
                        className="col-span-4 truncate"
                        style={{ color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)' }}
                        title={item.translated}
                      >
                        {item.translated}
                      </div>
                      <div className={`col-span-2 text-right ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                        {item.api}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-4 space-y-4">
              <h3 className={`text-sm font-semibold ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                翻译设置
              </h3>
              
              {/* 源语言（语音识别语言） */}
              <div>
                <label className={`block text-xs mb-1.5 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                  源语言（说话语言）
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkTheme 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-900'
                  } border`}
                >
                  {SOURCE_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              {/* 目标语言 */}
              <div>
                <label className={`block text-xs mb-1.5 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                  目标语言（翻译成）
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkTheme 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-900'
                  } border`}
                >
                  {TARGET_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              {/* 翻译引擎 */}
              <div>
                <label className={`block text-xs mb-1.5 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                  翻译引擎
                </label>
                <select
                  value={apiType}
                  onChange={(e) => setApiType(e.target.value as TranslationAPI)}
                  className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkTheme 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-200 text-gray-900'
                  } border`}
                >
                  {TRANSLATION_APIS.map(api => (
                    <option key={api.code} value={api.code}>{api.name}</option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              {(apiType === 'openai' || apiType === 'deepl') && (
                <div>
                  <label className={`block text-xs mb-1.5 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={apiType === 'openai' ? 'sk-...' : 'DeepL API Key'}
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkTheme 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    } border`}
                  />
                </div>
              )}

              {/* 状态信息 */}
              <div className={`p-3 rounded-lg text-xs space-y-1 ${contentBg}`}>
                <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isSupported ? 'bg-green-500' : 'bg-red-500'}`} />
                  Web Speech API: {isSupported ? '已支持' : '不支持'}
                </p>
                <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  状态: {isListening ? '识别中' : '已停止'}
                </p>
                <p className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'}>
                  源语言: {SOURCE_LANGUAGES.find(l => l.code === sourceLanguage)?.name || sourceLanguage}
                </p>
                {speechError && (
                  <p className="text-red-500">
                    错误: {speechError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
