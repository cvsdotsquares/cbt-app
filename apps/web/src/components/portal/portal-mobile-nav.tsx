'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { PortalSidebar } from '@/components/portal/portal-sidebar';

type PortalMobileNavProps = {
  variant: 'student' | 'parent';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges?: Partial<Record<'liveClasses' | 'pendingHw' | 'unpaidFees', number>>;
  subtitle?: string;
};

export function PortalMobileNav({ variant, open, onOpenChange, badges, subtitle }: PortalMobileNavProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 left-0 z-50 outline-none lg:hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300',
          )}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <PortalSidebar variant={variant} onNavigate={() => onOpenChange(false)} badges={badges} subtitle={subtitle} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
