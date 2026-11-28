import { cn } from '../../utils/cn';

/** Flat surface with a 1px border. Elevation is reserved for overlays. */
export const Card = ({ as: Component = 'section', className, children, ...props }) => (
  <Component className={cn('rounded-lg border border-line bg-surface', className)} {...props}>
    {children}
  </Component>
);

export const CardHeader = ({ title, description, actions, icon: Icon, className, titleAs: Title = 'h2', id }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5', className)}>
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon && <Icon size={18} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />}
      <div className="min-w-0">
        <Title id={id} className="text-[0.9375rem] font-medium text-fg">
          {title}
        </Title>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ className, children }) => <div className={cn('p-4 sm:p-5', className)}>{children}</div>;

export const CardFooter = ({ className, children }) => (
  <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-5', className)}>
    {children}
  </div>
);

export default Card;
