'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type SectionCardProps = {
  title: string;
  icon?: LucideIcon;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
  empty?: React.ReactNode;
  isEmpty?: boolean;
};

export function SectionCard({
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
  highlight,
  empty,
  isEmpty,
}: SectionCardProps) {
  return (
    <Card className={cn(
      'surface-card overflow-hidden backdrop-blur-sm',
      highlight && 'border-red-400/50 bg-gradient-to-br from-red-500/[0.06] to-card ring-1 ring-red-400/20 dark:border-red-900/50',
      !highlight && 'bg-card/80',
      className,
    )}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {Icon && (
              <span className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                highlight ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary',
              )}>
                <Icon className="h-4 w-4" />
              </span>
            )}
            {title}
          </CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-0">
        {isEmpty && empty ? empty : children}
      </CardContent>
    </Card>
  );
}

export function ListRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40',
      className,
    )}>
      {children}
    </div>
  );
}
