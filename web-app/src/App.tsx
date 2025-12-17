import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTranslation, TranslationAPI } from './hooks/useTranslation';
import { SettingsPanel } from './components/SettingsPanel';
import { CaptionCard } from './components/CaptionCard';
import { HistoryPanel } from './components/HistoryPanel';
import { FloatingPage } from './pages/FloatingPage';
import { MeetingPage } from './pages/MeetingPage';
import { TranslatorPage } from './pages/TranslatorPage';
import { MicrophoneIcon, StopIcon, SettingsIcon, HistoryIcon, CopyIcon } from './components/Icons';

interface HistoryEntry {
  id: number;
  sourceText: string;
  translatedText: string;
  timestamp: Date;
}

const SOURCE_LANGUAGES = [
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'zh-TW', name: '中文（繁体）' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'fr-FR', name: 'Français' },
];

const TARGET_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'fr-FR', name: 'Français' },
];

type ViewMode = 'full' | 'floating' | 'meeting' | 'translator';

function App() {
  // 根据 URL hash 初始化视图模式
  const getInitialViewMode = (): ViewMode => {
    const hash = window.location.hash.slice(1);
    if (hash === 'floating') return 'floating';
    if (hash === 'meeting') return 'meeting';
    if (hash === 'translator') return 'translator';
    return 'full';
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  
  // 语言设置
  const [sourceLanguage, setSourceLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('en-US'); // 默认翻译成英文
  
  // API 设置
  const [apiType, setApiType] = useState<TranslationAPI>('google');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  
  // UI 状态
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // 引用
  const lastTranslatedTextRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'floating') setViewMode('floating');
      else if (hash === 'meeting') setViewMode('meeting');
      else if (hash === 'translator') setViewMode('translator');
      else setViewMode('full');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 更新 URL hash
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'full') {
      window.location.hash = '';
    } else {
      window.location.hash = mode;
    }
  };
  
  // 语音识别
  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
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
    error: translateError,
    translate,
    clearTranslation,
  } = useTranslation({
    apiType,
    targetLanguage,
    apiKey,
    apiUrl,
    model,
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
      if (!lastEntry || lastEntry.sourceText !== transcript) {
        setHistory(prev => [{
          id: Date.now(),
          sourceText: transcript,
          translatedText,
          timestamp: new Date(),
        }, ...prev].slice(0, 100));
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

  const handleCopy = useCallback(async () => {
    const textToCopy = `原文：${transcript}\n翻译：${translatedText}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  }, [transcript, translatedText]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // 如果是悬浮窗口模式
  if (viewMode === 'floating') {
    return <FloatingPage onBack={() => changeViewMode('full')} />;
  }

  // 如果是会议模式（翻译 + AI 对话）
  if (viewMode === 'meeting') {
    return <MeetingPage onBack={() => changeViewMode('full')} />;
  }

  // 如果是纯翻译模式（只有翻译组件，无返回按钮）
  if (viewMode === 'translator') {
    return <TranslatorPage />;
  }

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');
  const error = speechError || translateError;

  return (
    <div className="min-h-screen relative">
      {/* 动态背景 */}
      <div className="animated-bg" />
      
      {/* 主要内容 */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* 头部 */}
        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Live Captions Translator</span>
          </h1>
          <p className="text-gray-400 text-lg">
            实时语音识别与翻译 · Web Speech API 驱动
          </p>
        </header>

        {/* 模式切换按钮 */}
        <div className="flex justify-center mb-8">
          <div className="glass rounded-2xl p-1 flex flex-wrap justify-center gap-1">
            <button
              onClick={() => changeViewMode('full')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
            >
              🖥️ 完整界面
            </button>
            <button
              onClick={() => changeViewMode('translator')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white"
            >
              🎤 纯翻译
            </button>
            <button
              onClick={() => changeViewMode('floating')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white"
            >
              🪟 悬浮窗口
            </button>
            <button
              onClick={() => changeViewMode('meeting')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white"
            >
              🤖 翻译 + AI 助手
            </button>
          </div>
        </div>

        {/* 语言选择区域 */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="bg-transparent text-white border-none outline-none cursor-pointer text-sm font-medium"
            >
              {SOURCE_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code} className="bg-midnight-900">
                  {lang.name}
                </option>
              ))}
            </select>
            
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="bg-transparent text-white border-none outline-none cursor-pointer text-sm font-medium"
            >
              {TARGET_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code} className="bg-midnight-900">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 字幕显示区域 */}
        <div className="glass-strong rounded-3xl p-6 md:p-8 mb-8 min-h-[300px]">
          {/* 原文 */}
          <CaptionCard
            label="原文"
            text={displayText || (isListening ? '正在聆听...' : '点击下方按钮开始')}
            isActive={isListening}
            className="mb-6"
            labelColor="text-indigo-400"
          />
          
          {/* 分隔线 */}
          <div className="border-t border-white/10 my-6" />
          
          {/* 译文 */}
          <CaptionCard
            label="翻译"
            text={translatedText || (isTranslating ? '翻译中...' : '等待翻译...')}
            isActive={isTranslating}
            labelColor="text-purple-400"
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="glass rounded-2xl p-4 mb-8 border border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* 浏览器兼容性提示 */}
        {!isSupported && (
          <div className="glass rounded-2xl p-4 mb-8 border border-yellow-500/30 bg-yellow-500/10">
            <p className="text-yellow-400 text-sm">
              您的浏览器不支持 Web Speech API。请使用 Chrome 或 Edge 浏览器获得最佳体验。
            </p>
          </div>
        )}

        {/* 控制按钮区域 */}
        <div className="flex items-center justify-center gap-4">
          {/* 历史按钮 */}
          <button
            onClick={() => setShowHistory(true)}
            className="glass p-4 rounded-full hover:bg-white/10 transition-all duration-300"
            title="历史记录"
          >
            <HistoryIcon className="w-6 h-6 text-gray-400" />
          </button>

          {/* 录音按钮 */}
          <button
            onClick={handleToggleListening}
            disabled={!isSupported}
            className={`relative w-20 h-20 rounded-full transition-all duration-300 btn-glow ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/30'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30'
            } ${!isSupported ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            {/* 录音时的脉冲动画 */}
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500/50 pulse-ring" />
                <span className="absolute inset-0 rounded-full bg-red-500/30 pulse-ring" style={{ animationDelay: '0.5s' }} />
              </>
            )}
            <span className="relative z-10 flex items-center justify-center">
              {isListening ? (
                <StopIcon className="w-8 h-8 text-white" />
              ) : (
                <MicrophoneIcon className="w-8 h-8 text-white" />
              )}
            </span>
          </button>

          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            disabled={!transcript && !translatedText}
            className={`glass p-4 rounded-full transition-all duration-300 ${
              copySuccess ? 'bg-green-500/20' : 'hover:bg-white/10'
            } ${!transcript && !translatedText ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="复制内容"
          >
            <CopyIcon className={`w-6 h-6 ${copySuccess ? 'text-green-400' : 'text-gray-400'}`} />
          </button>

          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="glass p-4 rounded-full hover:bg-white/10 transition-all duration-300"
            title="设置"
          >
            <SettingsIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* 状态指示器 */}
        <div className="text-center mt-6">
          <span className={`inline-flex items-center gap-2 text-sm ${isListening ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {isListening ? '正在识别...' : '已停止'}
          </span>
        </div>

        {/* 快捷入口提示 */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            直接访问：
            <a href="#translator" className="text-indigo-400 hover:text-indigo-300 ml-2">
              #translator（纯翻译）
            </a>
            <a href="#meeting" className="text-indigo-400 hover:text-indigo-300 ml-2">
              #meeting（翻译+AI助手）
            </a>
            <a href="#floating" className="text-indigo-400 hover:text-indigo-300 ml-2">
              #floating（悬浮窗口）
            </a>
          </p>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel
          apiType={apiType}
          apiKey={apiKey}
          apiUrl={apiUrl}
          model={model}
          onApiTypeChange={setApiType}
          onApiKeyChange={setApiKey}
          onApiUrlChange={setApiUrl}
          onModelChange={setModel}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 历史面板 */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onClear={handleClearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

export default App;
