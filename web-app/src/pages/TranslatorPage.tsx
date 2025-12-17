import { BottomTranslator } from '../components/BottomTranslator';

export function TranslatorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 flex flex-col">
      {/* 主内容区域 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">视频/会议内容区域</p>
        </div>
      </div>

      {/* 底部：实时翻译模块 */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <BottomTranslator />
        </div>
      </div>
    </div>
  );
}

