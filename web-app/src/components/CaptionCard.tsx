interface CaptionCardProps {
  label: string;
  text: string;
  isActive?: boolean;
  className?: string;
  labelColor?: string;
}

export function CaptionCard({
  label,
  text,
  isActive = false,
  className = '',
  labelColor = 'text-indigo-400',
}: CaptionCardProps) {
  return (
    <div className={`caption-enter ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${labelColor}`}>
          {label}
        </span>
        {isActive && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </span>
        )}
      </div>
      <p className="text-lg md:text-xl leading-relaxed text-gray-100 font-body min-h-[60px]">
        {text}
      </p>
    </div>
  );
}

