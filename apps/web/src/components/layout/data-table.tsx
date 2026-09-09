import { cn } from '@/lib/utils';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTable({ children, className }: DataTableProps) {
  return (
    <div className={cn('surface-card overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border/60 bg-muted/30">{children}</tr>
    </thead>
  );
}

export function DataTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:px-5 sm:py-4', className)}>
      {children}
    </th>
  );
}

export function DataTableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn('border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20', className)}>
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-3 text-sm sm:px-5 sm:py-4', className)}>{children}</td>;
}

function DefaultEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="m6.8 15-3.5 2" /><path d="m20.7 17-3.5-2" /><path d="M6.8 9 3.3 7" /><path d="m20.7 7-3.5 2" /><circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function EmptyState({ icon: Icon = DefaultEmptyIcon, title, description }: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
