import { useEffect, useId, useRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export const Icon = ({ d, size = 18, className = '' }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={clsx('shrink-0', className)} aria-hidden="true"><path d={d} /></svg>
);
export const I = {
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  panel: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zM15 3v18',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  plus: 'M12 5v14M5 12h14', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  type: 'M4 7V4h16v3M9 20h6M12 4v16', globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6', back: 'M19 12H5M12 19l-7-7 7-7', fwd: 'M5 12h14M12 5l7 7-7 7',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  pin: 'M12 17v5M5 17h14l-2-7 1-6H6l1 6-2 7z', ext: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01', alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  logo: 'M4 19L9 5l5 14M6.5 13h5M15 19V5l4 7 1-7',
};

export function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid place-items-center rounded-[9px] bg-primary text-on-primary font-bold shadow-[0_0_18px_-4px_var(--primary)]" style={{ width: size, height: size, fontSize: size * 0.28, letterSpacing: '-0.02em' }} aria-hidden="true">A.max</div>
      <span className="font-semibold text-text tracking-tight">A.max</span>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean; icon?: string };
export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-[9px] font-medium transition-colors select-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-dark hover:text-white active:brightness-90',
        variant === 'secondary' && 'bg-raised border border-border text-text hover:border-primary/60',
        variant === 'ghost' && 'text-muted hover:text-text hover:bg-hover',
        variant === 'danger' && 'bg-error/10 text-error border border-error/30 hover:bg-error/20',
        'disabled:opacity-45 disabled:cursor-not-allowed', className)}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon && <Icon d={icon} size={16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, active, className, size = 36, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; active?: boolean; size?: number }) {
  return (
    <button {...rest} aria-label={label} title={label} aria-pressed={active}
      className={clsx('grid place-items-center rounded-[8px] transition-colors', active ? 'bg-selected text-primary' : 'text-muted hover:text-text hover:bg-hover', 'disabled:opacity-40 disabled:cursor-not-allowed', className)} style={{ width: size, height: size }}>
      <Icon d={icon} size={18} />
    </button>
  );
}

export function Switch({ checked, onChange, label, desc, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx('flex items-center justify-between gap-4 py-2.5 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
      <span className="min-w-0"><span className="block text-[14px] text-text">{label}</span>{desc && <span className="block text-[12px] text-muted leading-snug mt-0.5">{desc}</span>}</span>
      <button id={id} role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} type="button"
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors border', checked ? 'bg-primary border-primary' : 'bg-raised border-border')}>
        <span className={clsx('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all', checked ? 'inset-inline-start-[22px]' : 'inset-inline-start-0.5')} style={{ insetInlineStart: checked ? 22 : 2 }} />
      </button>
    </label>
  );
}

export function Checkbox({ checked, onChange, label, ariaLabel, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; ariaLabel?: string; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 cursor-pointer select-none', disabled && 'opacity-50')}>
      <input type="checkbox" checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
      <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-border bg-raised peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary text-on-primary">
        {checked && <Icon d={I.check} size={12} />}
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('h-9 w-full rounded-[8px] border border-border bg-raised px-3 text-[13px] text-text placeholder:text-muted/70 focus:border-primary', props.className)} />;
}
export function Select({ options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={clsx('h-9 rounded-[8px] border border-border bg-raised px-2.5 text-[13px] text-text focus:border-primary', props.className)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error'; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
    tone === 'neutral' && 'bg-raised text-muted border border-border', tone === 'primary' && 'bg-selected text-primary', tone === 'success' && 'bg-success/15 text-success',
    tone === 'warning' && 'bg-warning/15 text-warning', tone === 'error' && 'bg-error/15 text-error', className)}>{children}</span>;
}

export function Card({ children, className, raised }: { children: ReactNode; className?: string; raised?: boolean }) {
  return <div className={clsx('rounded-[12px] border border-border', raised ? 'bg-raised' : 'bg-surface', className)}>{children}</div>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between mb-2"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</h3>{action}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange, compact, showIcons = true }: { tabs: { id: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void; compact?: boolean; showIcons?: boolean }) {
  const onKey = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex(t => t.id === value); const rtl = document.documentElement.dir === 'rtl';
    const next = (e.key === 'ArrowRight') !== rtl ? 1 : (e.key === 'ArrowLeft') !== rtl ? -1 : 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(tabs[(idx + next + tabs.length) % tabs.length].id); }
  };
  return (
    <div role="tablist" onKeyDown={onKey} className="flex gap-1 border-b border-border overflow-x-auto [scrollbar-width:none]">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)} title={t.label}
          className={clsx('relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[12.5px] font-medium transition-colors -mb-px border-b-2',
            // The popup is 400px wide: let all four tabs share the row instead
            // of pushing the last one out of view.
            compact && 'min-w-0 flex-1 justify-center gap-1 px-1.5 text-[11.5px]',
            value === t.id ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text')}>
          {t.icon && showIcons && <Icon d={t.icon} size={15} />}
          <span className="truncate">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4 gap-2">
      <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-raised border border-border text-muted"><Icon d={icon} size={20} /></div>
      <p className="text-[14px] font-medium">{title}</p>
      {desc && <p className="text-[12.5px] text-muted max-w-xs leading-relaxed">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, actions, danger }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions: ReactNode; danger?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, textarea')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('button,input,textarea,select,[tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'var(--overlay)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" className="w-full max-w-md rounded-[12px] border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">{danger && <Icon d={I.alert} className="text-error" />}<h2 id="dlg-title" className="text-[16px] font-semibold">{title}</h2></div>
        <div className="px-5 pb-4 text-[13.5px] text-muted leading-relaxed whitespace-pre-line">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{actions}</div>
      </div>
    </div>
  );
}

export function StatusDot({ tone }: { tone: 'success' | 'warning' | 'error' | 'muted' | 'primary' }) {
  return <span className={clsx('inline-block h-2 w-2 rounded-full', { 'bg-success': tone === 'success', 'bg-warning': tone === 'warning', 'bg-error': tone === 'error', 'bg-muted': tone === 'muted', 'bg-primary': tone === 'primary' })} aria-hidden="true" />;
}

export const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
export const fmtTime = (iso: string | null, lang: 'fa' | 'en') => iso ? new Date(iso).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
