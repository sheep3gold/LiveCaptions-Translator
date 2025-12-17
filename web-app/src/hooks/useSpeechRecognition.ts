import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionConfig {
  language: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(config: SpeechRecognitionConfig): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // 使用 ref 来跟踪是否应该继续监听
  const shouldListenRef = useRef(false);
  
  const isSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // 请求麦克风权限
  const requestMicrophonePermission = useCallback(async () => {
    try {
      console.log('[SpeechRecognition] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[SpeechRecognition] Microphone permission granted!');
      // 停止流，我们只是测试权限
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('[SpeechRecognition] Microphone permission denied:', err);
      setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      return false;
    }
  }, []);

  // 创建并启动识别
  const startRecognition = useCallback(async () => {
    if (!isSupported) return;
    
    // 先请求麦克风权限
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      shouldListenRef.current = false;
      setIsListening(false);
      return;
    }
    
    // 如果已有识别实例，先停止
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // 忽略
      }
    }
    
    const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    
    recognition.continuous = config.continuous ?? true;
    recognition.interimResults = config.interimResults ?? true;
    // 如果语言为空或 'auto'，则不设置语言，让浏览器自动检测
    // 否则设置指定的语言
    if (config.language && config.language !== 'auto' && config.language !== '') {
      recognition.lang = config.language;
      console.log('[SpeechRecognition] Language set to:', config.language);
    } else {
      console.log('[SpeechRecognition] Language: auto-detect');
    }
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        console.log('[SpeechRecognition] Final:', final);
        // 不再累积，每次只显示当前句子
        setFinalTranscript(final);
        setTranscript(final);
        // 清空 interim，避免显示重复内容
        setInterimTranscript('');
      } else {
        // 只有在没有 final 结果时才更新 interim
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: Event & { error?: string }) => {
      const errorCode = event.error || 'unknown';
      console.log('[SpeechRecognition] Error:', errorCode);
      
      // no-speech 和 aborted 不是真正的错误，不需要处理
      if (errorCode === 'no-speech' || errorCode === 'aborted') {
        return;
      }
      
      // 网络错误或其他错误
      if (errorCode === 'network') {
        setError('网络错误：Chrome 语音识别需要连接 Google 服务器，请检查网络或使用 VPN');
      } else if (errorCode === 'not-allowed') {
        setError('麦克风权限被拒绝，请允许访问麦克风');
        shouldListenRef.current = false;
        setIsListening(false);
      } else if (errorCode === 'audio-capture') {
        setError('无法捕获音频，请检查麦克风');
        shouldListenRef.current = false;
        setIsListening(false);
      } else {
        setError(`语音识别错误: ${errorCode}`);
      }
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Ended, shouldListen:', shouldListenRef.current);
      
      // 如果应该继续监听，则重新启动
      if (shouldListenRef.current) {
        console.log('[SpeechRecognition] Restarting...');
        // 延迟一小段时间再重启，避免过于频繁
        setTimeout(() => {
          if (shouldListenRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.log('[SpeechRecognition] Failed to restart:', e);
              // 如果重启失败，尝试创建新的实例
              startRecognition();
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      console.log('[SpeechRecognition] Starting...');
    } catch (e) {
      console.log('[SpeechRecognition] Failed to start:', e);
      setError('无法启动语音识别，请检查麦克风权限');
      shouldListenRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, config.language, config.continuous, config.interimResults]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    console.log('[SpeechRecognition] User started listening');
    shouldListenRef.current = true;
    await startRecognition();
  }, [isSupported, startRecognition]);

  const stopListening = useCallback(() => {
    console.log('[SpeechRecognition] User stopped listening');
    shouldListenRef.current = false;
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // 忽略
      }
      recognitionRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // 忽略
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    finalTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
