import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const badgeVariants = cva(
  'inline-flex items-center font-medium rounded-full',
  {
    variants: {
      variant: {
        success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
        warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
        error: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
        info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
        neutral: 'bg-gray-100 text-gray-700 ring-1 ring-gray-500/20',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
