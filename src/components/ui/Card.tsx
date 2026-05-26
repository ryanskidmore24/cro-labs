import { type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const cardVariants = cva('rounded-xl bg-white', {
  variants: {
    variant: {
      default: 'border border-gray-200',
      bordered: 'border-2 border-gray-300',
      elevated: 'shadow-lg border border-gray-100',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  header?: ReactNode;
  footer?: ReactNode;
}

export function Card({
  className,
  variant,
  header,
  footer,
  children,
  ...props
}: CardProps) {
  return (
    <div className={clsx(cardVariants({ variant }), className)} {...props}>
      {header && (
        <div className="px-6 py-4 border-b border-gray-200 font-semibold text-gray-900">
          {header}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}
