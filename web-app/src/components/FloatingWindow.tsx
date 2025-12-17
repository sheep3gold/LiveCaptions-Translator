import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTranslation, TranslationAPI } from '../hooks/useTranslation';

interface FloatingWindowProps {
  onClose?: () => void;
  onOpenFull?: () => void;
}

const SOURCE_LANGUAGES = [
  { code: 'zh-CN', name: '中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
];

const TARGET_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
];

export function FloatingWindow({ onClose, onOpenFull }: FloatingWindowProps) {
  // 语言设置
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('en-US'); // 默认翻译成英文
  
  // API 设置
  const [apiType] = useState<TranslationAPI>('google');
  
  // UI 状态
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'log'>('home');
  const [history, setHistory] = useState<Array<{ source: string; translated: string; time: Date }>>([]);
  
  // 拖拽相关
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // 引用
  const lastTranslatedTextRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 语音识别
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language: sourceLanguage,
    continuous: true,
    interimResults: true,
  });

  // 翻译
  const {
    translatedText,
    isTranslating,
    translate,
    clearTranslation,
  } = useTranslation({
    apiType,
    targetLanguage,
  });

  // 当有新的文本时进行翻译
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

  // 添加到历史记录
  useEffect(() => {
    if (transcript && translatedText && !isTranslating) {
      const lastEntry = history[0];
      if (!lastEntry || lastEntry.source !== transcript) {
        setHistory(prev => [{
          source: transcript,
          translated: translatedText,
          time: new Date(),
        }, ...prev].slice(0, 50));
      }
    }
  }, [transcript, translatedText, isTranslating, history]);

  const handleToggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      clearTranslation();
      lastTranslatedTextRef.current = '';
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, clearTranslation]);

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-800';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const hoverBg = isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100';

  return (
    <div
      className={`fixed shadow-2xl rounded-xl overflow-hidden ${bgColor} ${textColor} select-none`}
      style={{
        left: position.x,
        top: position.y,
        width: '520px',
        zIndex: isPinned ? 9999 : 1000,
      }}
    >
      {/* 标题栏 */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} border-b ${borderColor} cursor-move`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <span className="text-sm font-medium">Live Captions Translator</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* 主题切换 */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-lg ${hoverBg} transition-colors`}
            title={isDarkMode ? '浅色模式' : '深色模式'}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          {/* 暂停/播放 */}
          <button
            onClick={handleToggleListening}
            className={`p-1.5 rounded-lg ${hoverBg} transition-colors`}
            title={isListening ? '暂停' : '开始'}
          >
            {isListening ? (
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          {/* 置顶 */}
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg ${hoverBg} transition-colors ${isPinned ? 'text-blue-500' : ''}`}
            title={isPinned ? '取消置顶' : '置顶'}
          >
            <svg className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          {/* 展开 */}
          {onOpenFull && (
            <button
              onClick={onOpenFull}
              className={`p-1.5 rounded-lg ${hoverBg} transition-colors`}
              title="展开完整界面"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
          
          {/* 最小化 */}
          <button
            className={`p-1.5 rounded-lg ${hoverBg} transition-colors`}
            title="最小化"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          {/* 关闭 */}
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors`}
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex">
        {/* 侧边栏 */}
        <div className={`w-12 py-3 flex flex-col items-center gap-2 border-r ${borderColor} ${isDarkMode ? 'bg-gray-850' : 'bg-gray-50'}`}>
          <button
            onClick={() => setActiveTab('home')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'home' ? 'bg-blue-100 text-blue-600' : hoverBg}`}
            title="主页"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-blue-100 text-blue-600' : hoverBg}`}
            title="历史"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`p-2 rounded-lg transition-colors ${activeTab === 'log' ? 'bg-blue-100 text-blue-600' : hoverBg}`}
            title="日志"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 p-4">
          {activeTab === 'home' && (
            <div className="space-y-4">
              {/* 语言选择 */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className={`px-2 py-1 rounded border ${borderColor} ${isDarkMode ? 'bg-gray-800' : 'bg-white'} text-xs`}
                >
                  {SOURCE_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className={`px-2 py-1 rounded border ${borderColor} ${isDarkMode ? 'bg-gray-800' : 'bg-white'} text-xs`}
                >
                  {TARGET_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
                
                {/* 状态指示器 */}
                <div className="ml-auto flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-gray-500">{isListening ? '识别中' : '已停止'}</span>
                </div>
              </div>

              {/* 原文区域 */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-blue-50'} min-h-[60px]`}>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs font-medium text-blue-600">原文</span>
                  {isListening && (
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {displayText || (isListening ? '正在聆听...' : '点击播放按钮开始语音识别')}
                </p>
              </div>

              {/* 翻译区域 */}
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} min-h-[60px]`}>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  {translatedText || (isTranslating ? '翻译中...' : '翻译结果将显示在这里')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <div className="text-xs font-medium text-gray-500 mb-2">翻译历史</div>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">暂无历史记录</p>
              ) : (
                history.map((item, index) => (
                  <div key={index} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} text-xs`}>
                    <p className="text-gray-500 truncate">{item.source}</p>
                    <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{item.translated}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 mb-2">运行日志</div>
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} text-xs font-mono`}>
                <p className="text-green-500">[INFO] Web Speech API: {isSupported ? '已支持' : '不支持'}</p>
                <p className="text-blue-500">[INFO] 翻译引擎: Google Translate</p>
                <p className="text-gray-500">[INFO] 源语言: {sourceLanguage}</p>
                <p className="text-gray-500">[INFO] 目标语言: {targetLanguage}</p>
                {isListening && <p className="text-yellow-500">[ACTIVE] 语音识别进行中...</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

