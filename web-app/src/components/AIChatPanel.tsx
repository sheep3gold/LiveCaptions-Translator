import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isAIGenerated?: boolean;
}

interface AIChatPanelProps {
  context?: string; // 实时翻译的上下文内容
  onClose?: () => void;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

export function AIChatPanel({ context, onClose, apiKey, apiUrl, model }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    { title: '让AI处理忙碌', desc: 'Teams Pie可以生成笔记、列出任务等，帮助您完成此类工作。' },
    { title: '检查事实', desc: '回复可能不准确或不完整。共享反馈以帮助Copilot改进。' },
    { title: '这是你的Teams Pie', desc: '回忆中其他人看不到此对话' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      // 构建消息历史
      const messageHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // 如果有上下文（实时翻译内容），添加到系统消息
      const systemMessage = context 
        ? `你是一个智能助手，可以帮助用户理解和分析对话内容。当前的实时翻译/对话内容如下：\n\n${context}\n\n请基于这些上下文回答用户的问题。`
        : '你是一个智能助手，可以帮助用户理解和分析对话内容。';

      const requestMessages = [
        { role: 'system', content: systemMessage },
        ...messageHistory,
        { role: 'user', content: content.trim() },
      ];

      // 调用 AI API
      const url = apiUrl || 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey || ''}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          messages: requestMessages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。';

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        isAIGenerated: true,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // 如果 API 调用失败，返回一个模拟响应
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: apiKey 
          ? `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}`
          : '请在设置中配置 API Key 以启用 AI 对话功能。\n\n目前您可以：\n• 查看实时翻译内容\n• 配置翻译 API\n• 导出翻译历史',
        timestamp: new Date(),
        isAIGenerated: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, context, apiKey, apiUrl, model]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* 头部 */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              Teams Pie
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </h2>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 建议卡片 */}
        {showSuggestions && messages.length === 0 && (
          <div className="space-y-3">
            {suggestions.map((item, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(item.title)}
                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <h3 className="font-medium text-gray-800 group-hover:text-blue-600">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* 快捷操作 */}
        {showSuggestions && messages.length === 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={() => sendMessage('我们讨论什么')}
              className="px-4 py-2 text-blue-600 border border-blue-200 rounded-full text-sm hover:bg-blue-50 transition-colors"
            >
              我们讨论什么
            </button>
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : ''}`}>
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Teams Pie</span>
                  {message.isAIGenerated && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">由AI生成</span>
                  )}
                  <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                </div>
              )}
              <div
                className={`px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div className="px-4 py-3 bg-gray-100 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 查看提示按钮 */}
      {context && (
        <div className="px-5 py-2 border-t border-gray-100">
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            查看提示
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-100">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="询问关于次会议的任何内容"
            className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
              inputValue.trim() && !isLoading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

