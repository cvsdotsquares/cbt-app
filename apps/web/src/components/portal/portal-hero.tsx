'use client';

import { cn } from '@/lib/utils';
import { getPortalTheme, type PortalVariant } from '@/components/portal/portal-theme';

type PortalHeroProps = {
  variant: PortalVariant;
  greeting?: string;
  userName?: string;
  title: string;
  highlight: string;
  description: string;
  chip?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function PortalHero({
  variant,
  greeting,
  userName,
  title,
  highlight,
  description,
  chip,
  children,
  className,
}: PortalHeroProps) {
  const theme = getPortalTheme(variant);
  const Icon = theme.icon;

  return (
    <div className={cn(theme.heroClass, 'relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl portal-hero-orb" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full opacity-30 blur-3xl portal-hero-orb-secondary" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider', theme.badgeClass)}>
              <Icon className="h-3.5 w-3.5" />
              {theme.portalTitle}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{theme.tagline}</span>
          </div>

          {greeting && userName && (
            <p className="text-sm font-semibold text-foreground/80">
              Good {greeting}, <span className="text-foreground">{userName}</span>
            </p>
          )}

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {title}{' '}
            <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', theme.gradientFrom, theme.gradientTo)}>
              {highlight}
            </span>
          </h1>

          {chip}
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
