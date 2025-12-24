import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTranslation, TranslationAPI } from '../hooks/useTranslation';

interface TranslationEntry {
  id: number;
  source: string;
  translated: string;
  time: Date;
  api: string;
  savedAt?: string; // 服务器保存时间
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
  const [sourceLanguage, setSourceLanguage] = useState('zh-CN'); // 默认简体中文，可在设置中改为自动识别
  const [targetLanguage, setTargetLanguage] = useState('zh-CN'); // 默认翻译成中文简体
  const [apiType, setApiType] = useState<TranslationAPI>('google');
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');
  const [history, setHistory] = useState<TranslationEntry[]>([]);
  const [persistedHistory, setPersistedHistory] = useState<TranslationEntry[]>([]); // 服务器保存的历史
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [isTranslationPaused, setIsTranslationPaused] = useState(false); // 暂停翻译（但继续语音识别）
  
  // 新增设置状态
  const [showLiveCaptions, setShowLiveCaptions] = useState<'show' | 'hide'>('show'); // 实时字幕显示
  const [contextRounds, setContextRounds] = useState(2); // 上下文轮次
  const [contextAware, setContextAware] = useState(true); // 上下文感知
  const [apiInterval, setApiInterval] = useState(50); // API间隔（百分比）
  const [showDelay, setShowDelay] = useState(true); // 显示延迟
  const [floatingWindowSentences, setFloatingWindowSentences] = useState(2); // 悬浮窗显示句数
  
  // 历史记录相关状态
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPageSize] = useState(30);
  const [showSessionHistory, setShowSessionHistory] = useState(false); // 显示当前会话记录
  const [availableDates, setAvailableDates] = useState<string[]>([]); // 可用的历史日期
  const [selectedDate, setSelectedDate] = useState<string>(''); // 选中的日期（空表示全部）
  
  const lastTranslatedTextRef = useRef('');
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTogglingRef = useRef(false); // 防止快速双击
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 显示延迟定时器
  
  // 显示延迟功能：用于存储延迟显示的翻译结果
  const [delayedTranslatedText, setDelayedTranslatedText] = useState('');
  
  // 使用 ref 跟踪上一个 transcript 和对应的翻译
  const prevTranscriptRef = useRef('');
  const pendingEntryRef = useRef<TranslationEntry | null>(null); // 待保存的条目

  // 加载持久化的历史记录（支持按日期筛选）
  const loadHistory = useCallback(async (date?: string) => {
    setHistoryLoading(true);
    try {
      const url = date ? `/api/history?date=${date}` : '/api/history?days=30';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        if (data.history) {
          const parsed = data.history.map((h: TranslationEntry) => ({
            ...h,
            time: new Date(h.time)
          }));
          setPersistedHistory(parsed);
          console.log('[History] Loaded', parsed.length, 'entries from server');
        }
        if (data.dates) {
          setAvailableDates(data.dates);
        }
      }
    } catch (error) {
      console.error('[History] Failed to load:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 保存单条历史记录到服务器
  const saveHistoryEntry = useCallback(async (entry: TranslationEntry) => {
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          entry: {
            ...entry,
            time: entry.time.toISOString()
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        console.log('[History] Saved entry, total:', data.count);
      }
    } catch (error) {
      console.error('[History] Failed to save entry:', error);
    }
  }, []);

  // 清空服务器历史记录
  const clearPersistedHistory = useCallback(async () => {
    setHistorySaving(true);
    try {
      const response = await fetch('/api/history', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setPersistedHistory([]);
        console.log('[History] Cleared all entries');
      }
    } catch (error) {
      console.error('[History] Failed to clear:', error);
    } finally {
      setHistorySaving(false);
    }
  }, []);

  // 组件挂载时加载历史记录
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 同步设置到 localStorage，供 FloatingWindow 读取
  useEffect(() => {
    localStorage.setItem('translator_settings', JSON.stringify({
      floatingWindowSentences,
      showLiveCaptions,
      contextAware,
      contextRounds,
      apiInterval,
      showDelay,
    }));
  }, [floatingWindowSentences, showLiveCaptions, contextAware, contextRounds, apiInterval, showDelay]);

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

  // 当源语言改变时，如果正在监听，则重启语音识别
  const prevSourceLanguageRef = useRef(sourceLanguage);
  useEffect(() => {
    if (prevSourceLanguageRef.current !== sourceLanguage && isListening) {
      console.log('[BottomTranslator] Source language changed, restarting recognition...');
      stopListening();
      // 短暂延迟后重新开始
      setTimeout(() => {
        startListening();
      }, 100);
    }
    prevSourceLanguageRef.current = sourceLanguage;
  }, [sourceLanguage, isListening, stopListening, startListening]);

  const {
    translatedText,
    isTranslating,
    translate,
    clearTranslation,
  } = useTranslation({
    apiType,
    targetLanguage,
    apiKey: apiKey || undefined,
    contextAware, // 上下文感知开关
    contextRounds, // 上下文轮次
    contextHistory: history.map(h => ({ source: h.source, translated: h.translated })), // 历史翻译记录
  });

  useEffect(() => {
    // 如果暂停翻译，则不执行翻译（但语音识别继续）
    if (isTranslationPaused) return;
    
    const textToTranslate = transcript + interimTranscript;
    
    if (!textToTranslate.trim()) return;
    if (textToTranslate === lastTranslatedTextRef.current) return;
    
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    
    translationTimeoutRef.current = setTimeout(() => {
      lastTranslatedTextRef.current = textToTranslate;
      translate(textToTranslate);
    }, 100 + apiInterval * 9); // API间隔: 0%=100ms, 50%=550ms, 100%=1000ms
    
    return () => {
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    };
  }, [transcript, interimTranscript, translate, isTranslationPaused, apiInterval]);

  // 当 transcript 变化时，检测是否是新的一句话
  useEffect(() => {
    // 如果 transcript 变化了，说明新的一句话开始了
    if (transcript && transcript !== prevTranscriptRef.current) {
      console.log('[BottomTranslator] New sentence detected:', transcript.slice(0, 20) + '...');
      
      // 如果有待保存的条目（上一句话），立即保存到历史
      if (pendingEntryRef.current) {
        console.log('[BottomTranslator] Saving previous sentence to history:', pendingEntryRef.current.source.slice(0, 20) + '...');
        
        const entryToSave = pendingEntryRef.current;
        
        // 立即更新前端缓存（history state）
        setHistory(prev => {
          const newHistory = [entryToSave, ...prev].slice(0, 100);
          onHistoryChange?.(newHistory);
          return newHistory;
        });
        
        // 异步保存到服务器（不阻塞UI）
        saveHistoryEntry(entryToSave);
        
        // 清空待保存条目
        pendingEntryRef.current = null;
      }
      
      // 更新 prevTranscriptRef
      prevTranscriptRef.current = transcript;
    }
  }, [transcript, onHistoryChange, saveHistoryEntry]);

  // 当翻译完成时，创建待保存的条目
  useEffect(() => {
    if (transcript && translatedText && !isTranslating && !isTranslationPaused) {
      console.log('[BottomTranslator] Translation complete, creating pending entry');
      
      // 创建待保存条目（等下一句话来时保存）
      const apiName = TRANSLATION_APIS.find(a => a.code === apiType)?.name || apiType;
      pendingEntryRef.current = {
        id: Date.now(),
        source: transcript,
        translated: translatedText,
        time: new Date(),
        api: apiName,
      };
      
      const contextText = `原文：${transcript}\n翻译：${translatedText}`;
      onContextChange?.(contextText);
    }
  }, [transcript, translatedText, isTranslating, isTranslationPaused, apiType, onContextChange]);

  // 显示延迟功能：当启用时，翻译结果延迟300ms显示，避免频繁闪烁
  useEffect(() => {
    if (!showDelay) {
      // 未启用延迟，直接显示
      setDelayedTranslatedText(translatedText);
      return;
    }
    
    // 启用延迟，等待翻译完成后再显示
    if (displayDelayTimeoutRef.current) {
      clearTimeout(displayDelayTimeoutRef.current);
    }
    
    if (translatedText && !isTranslating) {
      // 翻译完成后，延迟300ms显示
      displayDelayTimeoutRef.current = setTimeout(() => {
        setDelayedTranslatedText(translatedText);
      }, 300);
    } else if (isTranslating) {
      // 正在翻译时，保持上一次的结果
    } else {
      setDelayedTranslatedText(translatedText);
    }
    
    return () => {
      if (displayDelayTimeoutRef.current) {
        clearTimeout(displayDelayTimeoutRef.current);
      }
    };
  }, [translatedText, isTranslating, showDelay]);

  // 计算实际显示的翻译文本
  const displayTranslatedText = showDelay ? delayedTranslatedText : translatedText;

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
      
      // 停止时，保存当前句子到历史记录
      // 优先使用 pendingEntryRef（已翻译完成的），否则用当前显示的内容
      const entryToSave = pendingEntryRef.current || 
        (transcript && translatedText ? {
          id: Date.now(),
          source: transcript,
          translated: translatedText,
          time: new Date(),
          api: TRANSLATION_APIS.find(a => a.code === apiType)?.name || apiType,
        } as TranslationEntry : null);
      
      if (entryToSave) {
        // 检查是否已经保存过
        setHistory(prev => {
          const alreadySaved = prev.length > 0 && prev[0].source === entryToSave.source;
          if (alreadySaved) {
            return prev;
          }
          const newHistory = [entryToSave, ...prev].slice(0, 100);
          onHistoryChange?.(newHistory);
          // 异步保存到服务器
          saveHistoryEntry(entryToSave);
          return newHistory;
        });
      }
      
      // 清空 refs
      pendingEntryRef.current = null;
      prevTranscriptRef.current = '';
      
      stopListening();
      
      // 停止后清空翻译面板
      resetTranscript();
      clearTranslation();
      lastTranslatedTextRef.current = '';
    } else {
      console.log('[BottomTranslator] Starting new session...');
      
      // 清空当前会话历史（开始新的录制会话）
      // 之前的记录已经保存在服务器/左侧历史中
      setHistory([]);
      onHistoryChange?.([]);
      
      resetTranscript();
      clearTranslation();
      lastTranslatedTextRef.current = '';
      pendingEntryRef.current = null;
      prevTranscriptRef.current = '';
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, clearTranslation, transcript, translatedText, history, apiType, onHistoryChange, saveHistoryEntry]);

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '');

  // 过滤和分页历史记录（当前会话）
  const filteredHistory = history.filter(item => 
    historySearch === '' || 
    item.source.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.translated.toLowerCase().includes(historySearch.toLowerCase())
  );
  
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize
  );

  // 根据标签切换显示的历史记录（当前会话 或 所有历史）
  const displayedHistory = (showSessionHistory ? history : persistedHistory).filter(item => 
    historySearch === '' || 
    item.source.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.translated.toLowerCase().includes(historySearch.toLowerCase())
  );
  
  const paginatedDisplayedHistory = displayedHistory.slice(
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
            {/* 1. REC 按钮：开始/停止录制（语音识别） */}
            <button
              onClick={handleToggleListening}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                isListening 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : `${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`
              }`}
              title={isListening ? '停止录制' : '开始录制'}
              disabled={!isSupported}
            >
              {isListening ? (
                <>
                  {/* 停止图标 */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  <span className="text-xs font-medium">STOP</span>
                </>
              ) : (
                <>
                  {/* REC 图标 */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" fill="currentColor" />
                  </svg>
                  <span className="text-xs font-medium">REC</span>
                </>
              )}
            </button>

            {/* 2. 历史记录按钮 */}
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

            {/* 3. 暂停翻译按钮：暂停翻译但继续语音识别 */}
            <button
              onClick={() => setIsTranslationPaused(!isTranslationPaused)}
              disabled={!isListening}
              className={`p-2 rounded-lg transition-colors ${
                isTranslationPaused 
                  ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                  : `${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${!isListening ? 'opacity-40 cursor-not-allowed' : ''} ${iconColor}`
              }`}
              title={isTranslationPaused ? '恢复翻译' : '暂停翻译（继续识别原文）'}
            >
              {isTranslationPaused ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              )}
            </button>

            {/* 4. 悬浮字幕框 */}
            <button
              onClick={() => window.open('#floating', '_blank')}
              className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
              title="打开悬浮字幕框"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
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
                  {/* 当前正在进行的翻译（实时显示在顶部） */}
                  {displayText && (
                    <div className={`px-5 py-3 ${history.length > 0 ? (isDarkTheme ? 'border-b border-gray-700' : 'border-b border-gray-200/50') : ''}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                          {isListening ? '录制中' : '当前'}
                        </span>
                      </div>
                      <p 
                        className="text-sm leading-relaxed mb-2"
                        style={{ 
                          fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                          fontWeight: 400,
                          color: isDarkTheme ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
                        }}
                      >
                        {displayText}
                      </p>
                      <p 
                        className="text-base leading-relaxed"
                        style={{ 
                          fontFamily: '"PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                          fontWeight: 500,
                          color: isDarkTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
                        }}
                      >
                        {isTranslationPaused 
                          ? '⏸ 翻译已暂停' 
                          : (displayTranslatedText || (isTranslating ? '翻译中...' : ''))}
                      </p>
                    </div>
                  )}
                  
                  {/* 已完成的历史记录 */}
                  {history.length === 0 && !displayText ? (
                    <div className="flex items-center justify-center h-[152px]">
                      <p className={`text-sm ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                        暂无历史记录，点击 REC 开始录制
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[250px] overflow-auto">
                      {history.map((item, index) => (
                        <div 
                          key={item.id || index}
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

                {/* 原文区域 - 上方，小字体，Regular，60%透明度 - 受「实时字幕」设置控制 */}
                {showLiveCaptions === 'show' && (
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
                )}

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
                    {isTranslationPaused 
                      ? '⏸ 翻译已暂停（原文继续识别中...）' 
                      : (displayTranslatedText || (isTranslating ? '翻译中...' : '翻译结果将显示在这里'))}
                  </p>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-4">
              {/* 顶部标签切换：当前会话 / 所有历史 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowSessionHistory(true)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      showSessionHistory 
                        ? 'bg-blue-100 text-blue-600' 
                        : (isDarkTheme ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')
                    }`}
                  >
                    当前会话 ({history.length})
                  </button>
                  <button
                    onClick={() => { setShowSessionHistory(false); setSelectedDate(''); }}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      !showSessionHistory && !selectedDate
                        ? 'bg-blue-100 text-blue-600' 
                        : (isDarkTheme ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')
                    }`}
                  >
                    所有历史 ({persistedHistory.length})
                  </button>
                  
                  {/* 日期选择器 */}
                  {!showSessionHistory && availableDates.length > 0 && (
                    <select
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        loadHistory(e.target.value || undefined);
                        setHistoryPage(1);
                      }}
                      className={`px-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDarkTheme 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      <option value="">全部日期</option>
                      {availableDates.map(date => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  )}
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadHistory(selectedDate || undefined)}
                    disabled={historyLoading}
                    className={`p-1.5 rounded transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${iconColor}`}
                    title="刷新历史"
                  >
                    <svg className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={clearPersistedHistory}
                    disabled={historySaving || persistedHistory.length === 0}
                    className={`p-1.5 rounded transition-colors ${isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${persistedHistory.length === 0 ? 'opacity-30 cursor-not-allowed' : ''} text-red-500`}
                    title="清空所有历史"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 工具栏：分页 + 搜索 */}
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
                    {historyPage}/{Math.max(1, Math.ceil(displayedHistory.length / historyPageSize))}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(Math.ceil(displayedHistory.length / historyPageSize), p + 1))}
                    disabled={historyPage >= Math.ceil(displayedHistory.length / historyPageSize)}
                    className={`p-1 rounded ${historyPage >= Math.ceil(displayedHistory.length / historyPageSize) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'} ${iconColor}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* 搜索框 */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    placeholder="搜索..."
                    className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 w-32 ${
                      isDarkTheme 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* 表头 */}
              <div className={`grid grid-cols-12 gap-2 py-2 border-b text-xs font-medium ${isDarkTheme ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                <div className="col-span-2">时间</div>
                <div className="col-span-4">原文</div>
                <div className="col-span-4">译文</div>
                <div className="col-span-2 text-right">API</div>
              </div>

              {/* 历史记录列表 */}
              {historyLoading ? (
                <p className={`text-sm text-center py-8 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                  加载中...
                </p>
              ) : displayedHistory.length === 0 ? (
                <p className={`text-sm text-center py-8 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                  暂无历史记录
                </p>
              ) : (
                <div className="max-h-[250px] overflow-auto">
                  {paginatedDisplayedHistory.map((item, index) => (
                    <div 
                      key={item.id || index} 
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
            <div className="px-4 pb-4">
              {/* 设置面板 - 网格布局，匹配设计图，与主页高度一致 */}
              <div 
                className={contentBg}
                style={{ 
                  borderRadius: '12px',
                  padding: '12px 16px',
                  minHeight: '152px',
                  border: isDarkTheme ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
                }}
              >
                {/* 第一行：实时字幕、翻译引擎、上下文轮次、上下文感知、API间隔 */}
                <div className="grid grid-cols-5 gap-3 mb-3">
                  {/* 实时字幕 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      实时字幕
                    </label>
                    <div className="relative">
                      <select
                        value={showLiveCaptions}
                        onChange={(e) => setShowLiveCaptions(e.target.value as 'show' | 'hide')}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        <option value="show">显示</option>
                        <option value="hide">隐藏</option>
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* 翻译引擎 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      翻译引擎
                    </label>
                    <div className="relative">
                      <select
                        value={apiType}
                        onChange={(e) => setApiType(e.target.value as TranslationAPI)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        {TRANSLATION_APIS.map(api => (
                          <option key={api.code} value={api.code}>{api.name}</option>
                        ))}
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* 上下文轮次 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      上下文轮次
                    </label>
                    <div className="relative">
                      <select
                        value={contextRounds}
                        onChange={(e) => setContextRounds(parseInt(e.target.value))}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* 上下文感知 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      上下文感知
                    </label>
                    <button
                      onClick={() => setContextAware(!contextAware)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                        contextAware ? 'bg-blue-500' : (isDarkTheme ? 'bg-gray-600' : 'bg-gray-300')
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                          contextAware ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* API间隔 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      API间隔
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={apiInterval}
                        onChange={(e) => setApiInterval(parseInt(e.target.value))}
                        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${apiInterval}%, ${isDarkTheme ? '#4b5563' : '#d1d5db'} ${apiInterval}%, ${isDarkTheme ? '#4b5563' : '#d1d5db'} 100%)`
                        }}
                      />
                      <span className={`text-xs px-1.5 py-0.5 rounded bg-blue-500 text-white min-w-[36px] text-center`}>
                        {apiInterval}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 第二行：目标语言、显示延迟、悬浮窗显示句数、源语言 */}
                <div className="grid grid-cols-5 gap-3">
                  {/* 目标语言 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      目标语言
                    </label>
                    <div className="relative">
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        {TARGET_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* 显示延迟 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      显示延迟
                    </label>
                    <button
                      onClick={() => setShowDelay(!showDelay)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                        showDelay ? 'bg-blue-500' : (isDarkTheme ? 'bg-gray-600' : 'bg-gray-300')
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                          showDelay ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 悬浮窗显示句数 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      悬浮窗显示句数
                    </label>
                    <div className="relative">
                      <select
                        value={floatingWindowSentences}
                        onChange={(e) => setFloatingWindowSentences(parseInt(e.target.value))}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* 源语言 */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                      源语言
                    </label>
                    <div className="relative">
                      <select
                        value={sourceLanguage}
                        onChange={(e) => setSourceLanguage(e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white' 
                            : 'bg-white border-blue-400 text-gray-800'
                        } border`}
                      >
                        {SOURCE_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                      <svg className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkTheme ? 'text-gray-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>

                  {/* API Key (条件显示) */}
                  {(apiType === 'openai' || apiType === 'deepl') && (
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={apiType === 'openai' ? 'sk-...' : 'Key'}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          isDarkTheme 
                            ? 'bg-gray-800 border-blue-500 text-white placeholder-gray-500' 
                            : 'bg-white border-blue-400 text-gray-800 placeholder-gray-400'
                        } border`}
                      />
                    </div>
                  )}
                </div>

                {/* 状态信息栏 */}
                <div className={`mt-3 pt-2 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'}>
                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${isSupported ? 'bg-green-500' : 'bg-red-500'}`} />
                      Web Speech: {isSupported ? '已支持' : '不支持'}
                    </span>
                    <span className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'}>
                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      {isListening ? '识别中' : '已停止'}
                    </span>
                    {speechError && (
                      <span className="text-red-500">
                        错误: {speechError}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
