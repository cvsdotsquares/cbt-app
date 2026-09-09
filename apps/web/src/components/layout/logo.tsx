import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'light' }) {
  const isLight = variant === 'light';

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <div className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10',
        isLight
          ? 'bg-white/10 text-white shadow-inner-glow backdrop-blur-sm'
          : 'gradient-primary text-white shadow-glow',
      )}>
        <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
        {!isLight && (
          <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity hover:opacity-100" />
        )}
      </div>
      <div className="min-w-0">
        <p className={cn(
          'truncate text-sm font-bold leading-none tracking-tight sm:text-[15px]',
          isLight ? 'text-white' : 'text-foreground',
        )}>
          SchoolHub
        </p>
        <p className={cn(
          'mt-1 text-[10px] font-semibold uppercase tracking-[0.15em]',
          isLight ? 'text-white/60' : 'text-muted-foreground',
        )}>
          School Management
        </p>
      </div>
    </div>
  );
}
