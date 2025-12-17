import { CloseIcon, TrashIcon, CopyIcon } from './Icons';
import { useState } from 'react';

interface HistoryEntry {
  id: number;
  sourceText: string;
  translatedText: string;
  timestamp: Date;
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onClear: () => void;
  onClose: () => void;
}

export function HistoryPanel({ history, onClear, onClose }: HistoryPanelProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (entry: HistoryEntry) => {
    const text = `原文：${entry.sourceText}\n翻译：${entry.translatedText}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const exportHistory = () => {
    const csvContent = [
      ['时间', '原文', '翻译'].join(','),
      ...history.map(entry => 
        [
          entry.timestamp.toISOString(),
          `"${entry.sourceText.replace(/"/g, '""')}"`,
          `"${entry.translatedText.replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `translation_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 面板内容 */}
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-gradient">翻译历史</h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={exportHistory}
                  className="px-3 py-2 rounded-lg glass hover:bg-white/10 transition-colors text-sm text-gray-300"
                >
                  导出 CSV
                </button>
                <button
                  onClick={onClear}
                  className="p-2 rounded-full hover:bg-red-500/20 transition-colors group"
                  title="清除历史"
                >
                  <TrashIcon className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 历史列表 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-400">暂无翻译记录</p>
              <p className="text-sm text-gray-500 mt-2">开始说话后，翻译记录将显示在这里</p>
            </div>
          ) : (
            history.map(entry => (
              <div
                key={entry.id}
                className="glass rounded-xl p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* 原文 */}
                    <div className="mb-2">
                      <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">原文</span>
                      <p className="text-gray-200 mt-1 break-words">{entry.sourceText}</p>
                    </div>
                    {/* 译文 */}
                    <div>
                      <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">翻译</span>
                      <p className="text-gray-300 mt-1 break-words">{entry.translatedText}</p>
                    </div>
                    {/* 时间 */}
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">{formatTime(entry.timestamp)}</span>
                    </div>
                  </div>
                  {/* 复制按钮 */}
                  <button
                    onClick={() => handleCopy(entry)}
                    className={`p-2 rounded-lg transition-all ${
                      copiedId === entry.id
                        ? 'bg-green-500/20'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-white/10'
                    }`}
                  >
                    <CopyIcon className={`w-4 h-4 ${copiedId === entry.id ? 'text-green-400' : 'text-gray-400'}`} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部信息 */}
        {history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <span className="text-sm text-gray-500">共 {history.length} 条记录</span>
          </div>
        )}
      </div>
    </div>
  );
}

