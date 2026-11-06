import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  tone?: 'md' | 'sm';
  inline?: boolean;
};

export function Select({ tone = 'md', inline, className = '', children, ...props }: SelectProps) {
  return (
    <div className={`select-wrap${inline ? ' select-wrap--inline' : ''}`}>
      <select className={`select${tone === 'sm' ? ' select--sm' : ''} ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown className="select__chevron" aria-hidden="true" />
    </div>
  );
}
