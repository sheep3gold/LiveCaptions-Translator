import { FloatingWindow } from '../components/FloatingWindow';

interface FloatingPageProps {
  onBack?: () => void;
}

export function FloatingPage({ onBack }: FloatingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
      {/* 模拟桌面背景 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-10 left-10 w-64 h-48 bg-white/50 rounded-lg shadow-lg" />
        <div className="absolute top-20 right-20 w-80 h-60 bg-white/50 rounded-lg shadow-lg" />
        <div className="absolute bottom-32 left-1/4 w-96 h-72 bg-white/50 rounded-lg shadow-lg" />
      </div>

      {/* 模拟任务栏 */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-white/80 backdrop-blur-md border-t border-gray-200 flex items-center px-4 gap-2">
        <div className="w-10 h-10 rounded bg-blue-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
        <div className="h-8 w-px bg-gray-300" />
        <div className="flex items-center gap-1">
          {/* 模拟任务栏图标 */}
          <div className="w-10 h-10 rounded hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div className="w-10 h-10 rounded hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-colors">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <span>{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* 返回按钮 */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-4 left-4 z-50 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-colors flex items-center gap-2 text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回完整界面
        </button>
      )}

      {/* 悬浮窗口 */}
      <FloatingWindow onOpenFull={onBack} />
      
      {/* 提示信息 */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
        💡 拖拽标题栏可移动窗口位置
      </div>
    </div>
  );
}

