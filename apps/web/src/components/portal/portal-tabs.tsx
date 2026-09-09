'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type PortalTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
};

type PortalTabsProps = {
  tabs: PortalTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function PortalTabs({ tabs, active, onChange, className }: PortalTabsProps) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1', className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all sm:px-4',
              active === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
            {tab.badge != null && tab.badge !== 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                active === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
