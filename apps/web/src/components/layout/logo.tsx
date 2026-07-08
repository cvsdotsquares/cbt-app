import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'light' }) {
  const isLight = variant === 'light';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-xl',
        isLight
          ? 'bg-white/10 text-white shadow-inner-glow backdrop-blur-sm'
          : 'gradient-primary text-white shadow-glow',
      )}>
        <GraduationCap className="h-5 w-5" />
        {!isLight && (
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity hover:opacity-100" />
        )}
      </div>
      <div>
        <p className={cn(
          'text-[15px] font-bold leading-none tracking-tight',
          isLight ? 'text-white' : 'text-foreground',
        )}>
          NCERT Institute
        </p>
        <p className={cn(
          'mt-1 text-[10px] font-semibold uppercase tracking-[0.15em]',
          isLight ? 'text-white/60' : 'text-muted-foreground',
        )}>
          Classes 9–12
        </p>
      </div>
    </div>
  );
}
