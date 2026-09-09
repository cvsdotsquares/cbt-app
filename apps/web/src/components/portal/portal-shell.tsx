'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/layout/logo';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

type PortalShellProps = {
  roleLabel: string;
  userName?: string;
  userInitials?: string;
  onLogout: () => void;
  children: React.ReactNode;
  maxWidth?: '5xl' | '6xl' | '7xl';
  className?: string;
};

export function PortalShell({
  roleLabel,
  userName,
  userInitials,
  onLogout,
  children,
  maxWidth = '6xl',
  className,
}: PortalShellProps) {
  const { theme, setTheme } = useTheme();
  const maxClass = { '5xl': 'max-w-5xl', '6xl': 'max-w-6xl', '7xl': 'max-w-7xl' }[maxWidth];

  return (
    <div className={cn('min-h-dvh mesh-bg', className)}>
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className={cn('mx-auto flex items-center justify-between px-4 py-3 sm:px-6', maxClass)}>
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            {userInitials && (
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary sm:flex">
                {userInitials}
              </div>
            )}
            {userName && (
              <span className="hidden text-sm font-medium text-muted-foreground md:inline">{userName}</span>
            )}
            <Badge variant="secondary" className="font-semibold">{roleLabel}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className={cn('mx-auto space-y-6 p-4 animate-fade-in sm:space-y-8 sm:p-6 lg:p-8', maxClass)}>
        {children}
      </main>
    </div>
  );
}
