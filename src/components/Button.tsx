import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-rush text-ink',
  secondary: 'bg-card text-white ring-1 ring-white/10',
  ghost: 'bg-white/5 text-white',
  danger: 'bg-transparent text-red-300 ring-1 ring-red-300/40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold tracking-[0.14em] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className = '', type = 'button', children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 touch-manipulation place-items-center rounded-xl bg-white/5 text-white transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rush ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
