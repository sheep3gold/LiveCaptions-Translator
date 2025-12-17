import { TranslationAPI } from '../hooks/useTranslation';
import { CloseIcon } from './Icons';

interface SettingsPanelProps {
  apiType: TranslationAPI;
  apiKey: string;
  apiUrl: string;
  model: string;
  onApiTypeChange: (type: TranslationAPI) => void;
  onApiKeyChange: (key: string) => void;
  onApiUrlChange: (url: string) => void;
  onModelChange: (model: string) => void;
  onClose: () => void;
}

const API_OPTIONS = [
  { value: 'google', label: 'Google Translate', description: '免费，无需配置' },
  { value: 'openai', label: 'OpenAI / 兼容 API', description: '需要 API Key' },
  { value: 'deepl', label: 'DeepL', description: '需要 API Key' },
  { value: 'libre', label: 'LibreTranslate', description: '自托管方案' },
] as const;

export function SettingsPanel({
  apiType,
  apiKey,
  apiUrl,
  model,
  onApiTypeChange,
  onApiKeyChange,
  onApiUrlChange,
  onModelChange,
  onClose,
}: SettingsPanelProps) {
  const needsApiKey = apiType === 'openai' || apiType === 'deepl';
  const needsApiUrl = apiType === 'openai' || apiType === 'libre';
  const needsModel = apiType === 'openai';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 面板内容 */}
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-gradient">设置</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* API 类型选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            翻译 API
          </label>
          <div className="grid gap-3">
            {API_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => onApiTypeChange(option.value)}
                className={`p-4 rounded-xl text-left transition-all duration-200 ${
                  apiType === option.value
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/50'
                    : 'glass hover:bg-white/10'
                }`}
              >
                <div className="font-medium text-white">{option.label}</div>
                <div className="text-sm text-gray-400 mt-1">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        {needsApiKey && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="输入您的 API Key"
              className="w-full px-4 py-3 rounded-xl glass bg-transparent text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
        )}

        {/* API URL */}
        {needsApiUrl && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API URL
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => onApiUrlChange(e.target.value)}
              placeholder={apiType === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'http://localhost:5000/translate'}
              className="w-full px-4 py-3 rounded-xl glass bg-transparent text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
        )}

        {/* 模型选择 */}
        {needsModel && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              模型
            </label>
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass bg-transparent text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
            >
              <option value="gpt-3.5-turbo" className="bg-midnight-900">GPT-3.5 Turbo</option>
              <option value="gpt-4" className="bg-midnight-900">GPT-4</option>
              <option value="gpt-4-turbo" className="bg-midnight-900">GPT-4 Turbo</option>
              <option value="gpt-4o" className="bg-midnight-900">GPT-4o</option>
              <option value="gpt-4o-mini" className="bg-midnight-900">GPT-4o Mini</option>
            </select>
          </div>
        )}

        {/* 使用提示 */}
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h3 className="font-medium text-indigo-300 mb-2">💡 提示</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Google Translate 是免费的，开箱即用</li>
            <li>• OpenAI 翻译质量更高，支持上下文理解</li>
            <li>• 使用 Chrome 或 Edge 浏览器可获得最佳语音识别效果</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

