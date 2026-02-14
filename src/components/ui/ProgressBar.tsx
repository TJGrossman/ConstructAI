interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  height?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = true,
  variant = 'default',
  height = 'md',
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const variantClasses = {
    default: 'bg-[hsl(38,92%,50%)]', // construction orange
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    danger: 'bg-red-600',
  };

  // Auto-adjust variant based on percentage if variant is default
  let finalVariant = variant;
  if (variant === 'default') {
    if (percentage <= 60) {
      finalVariant = 'success';
    } else if (percentage <= 90) {
      finalVariant = 'warning';
    } else {
      finalVariant = 'danger';
    }
  }

  return (
    <div className="w-full space-y-1">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {label && <span>{label}</span>}
          {showPercentage && <span>{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-muted ${heightClasses[height]}`}>
        <div
          className={`${heightClasses[height]} rounded-full transition-all duration-500 ease-out ${variantClasses[finalVariant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
