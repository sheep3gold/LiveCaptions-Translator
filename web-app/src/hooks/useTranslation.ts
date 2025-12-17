import { useState, useCallback, useRef } from 'react';

export type TranslationAPI = 'google' | 'openai' | 'deepl' | 'libre';

interface TranslationConfig {
  apiType: TranslationAPI;
  targetLanguage: string;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

interface UseTranslationReturn {
  translatedText: string;
  isTranslating: boolean;
  error: string | null;
  translate: (text: string) => Promise<string>;
  clearTranslation: () => void;
}

export function useTranslation(config: TranslationConfig): UseTranslationReturn {
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTextRef = useRef<string>('');

  const translateWithGoogle = async (text: string, signal: AbortSignal): Promise<string> => {
    const encodedText = encodeURIComponent(text);
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${config.targetLanguage}&q=${encodedText}`;
    
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    return data[0][0] || '';
  };

  const translateWithOpenAI = async (text: string, signal: AbortSignal): Promise<string> => {
    if (!config.apiKey || !config.apiUrl) {
      throw new Error('请配置 API Key 和 API URL');
    }

    const languageMap: Record<string, string> = {
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'en-US': 'English',
      'ja-JP': '日本語',
      'ko-KR': '한국어',
      'fr-FR': 'Français',
    };
    const targetLang = languageMap[config.targetLanguage] || config.targetLanguage;

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
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
      signal,
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    return data.choices[0].message.content || '';
  };

  const translateWithDeepL = async (text: string, signal: AbortSignal): Promise<string> => {
    if (!config.apiKey) {
      throw new Error('请配置 DeepL API Key');
    }

    const languageMap: Record<string, string> = {
      'zh-CN': 'ZH',
      'zh-TW': 'ZH',
      'en-US': 'EN-US',
      'en-GB': 'EN-GB',
      'ja-JP': 'JA',
      'ko-KR': 'KO',
      'fr-FR': 'FR',
    };
    const targetLang = languageMap[config.targetLanguage] || config.targetLanguage.split('-')[0].toUpperCase();

    const response = await fetch('/api/translate/deepl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLang,
        apiKey: config.apiKey,
      }),
      signal,
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    return data.translations?.[0]?.text || '';
  };

  const translateWithLibre = async (text: string, signal: AbortSignal): Promise<string> => {
    const apiUrl = config.apiUrl || 'http://localhost:5000/translate';
    
    const languageMap: Record<string, string> = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'en-US': 'en',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'fr-FR': 'fr',
    };
    const targetLang = languageMap[config.targetLanguage] || config.targetLanguage.split('-')[0];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text',
        api_key: config.apiKey || '',
      }),
      signal,
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    return data.translatedText || '';
  };

  const translate = useCallback(async (text: string): Promise<string> => {
    if (!text.trim()) return '';
    
    // 避免重复翻译相同的文本
    if (text === lastTextRef.current) {
      return translatedText;
    }
    lastTextRef.current = text;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsTranslating(true);
    setError(null);

    try {
      let result = '';
      const signal = abortControllerRef.current.signal;

      switch (config.apiType) {
        case 'google':
          result = await translateWithGoogle(text, signal);
          break;
        case 'openai':
          result = await translateWithOpenAI(text, signal);
          break;
        case 'deepl':
          result = await translateWithDeepL(text, signal);
          break;
        case 'libre':
          result = await translateWithLibre(text, signal);
          break;
        default:
          result = await translateWithGoogle(text, signal);
      }

      setTranslatedText(result);
      return result;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // 请求被取消，不需要处理
        return translatedText;
      }
      const errorMsg = e instanceof Error ? e.message : '翻译失败';
      setError(errorMsg);
      return '';
    } finally {
      setIsTranslating(false);
    }
  }, [config.apiType, config.targetLanguage, config.apiKey, config.apiUrl, config.model, translatedText]);

  const clearTranslation = useCallback(() => {
    setTranslatedText('');
    setError(null);
    lastTextRef.current = '';
  }, []);

  return {
    translatedText,
    isTranslating,
    error,
    translate,
    clearTranslation,
  };
}

