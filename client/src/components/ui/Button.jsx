import { forwardRef } from 'react';
import Icon from '../Icon.jsx';
import { Spinner } from './States.jsx';

const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger-hover shadow-card dark:text-[#1a0608]',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};
const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center rounded-md font-medium whitespace-nowrap transition-colors
        disabled:opacity-55 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === 'sm' || size === 'icon-sm' ? 16 : 18} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={16} /> : null}
    </button>
  );
});

export default Button;
