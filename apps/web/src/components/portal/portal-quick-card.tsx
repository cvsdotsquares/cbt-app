'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const cardStyles = {
  indigo: 'from-indigo-500/15 to-violet-500/5 border-indigo-500/20 hover:border-indigo-500/40 icon-indigo',
  sky: 'from-sky-500/15 to-blue-500/5 border-sky-500/20 hover:border-sky-500/40 icon-sky',
  violet: 'from-violet-500/15 to-purple-500/5 border-violet-500/20 hover:border-violet-500/40 icon-violet',
  emerald: 'from-emerald-500/15 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40 icon-emerald',
  amber: 'from-amber-500/15 to-orange-500/5 border-amber-500/20 hover:border-amber-500/40 icon-amber',
  rose: 'from-rose-500/15 to-pink-500/5 border-rose-500/20 hover:border-rose-500/40 icon-rose',
} as const;

type QuickCardColor = keyof typeof cardStyles;

type PortalQuickCardProps = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color?: QuickCardColor;
  badge?: number | string;
};

export function PortalQuickCard({ href, label, description, icon: Icon, color = 'indigo', badge }: PortalQuickCardProps) {
  const style = cardStyles[color];

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-start gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 shadow-sm transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-lg',
        style,
      )}
    >
      <span className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner',
        color === 'indigo' && 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
        color === 'sky' && 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
        color === 'violet' && 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
        color === 'emerald' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        color === 'amber' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        color === 'rose' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <p className="font-semibold tracking-tight">{label}</p>
          {badge != null && badge !== 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-foreground" />
    </Link>
  );
}
