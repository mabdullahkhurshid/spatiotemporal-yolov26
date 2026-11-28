import { cn } from '../../utils/cn';

/** The single <h1> of a page, with an optional description, meta row and actions. */
const PageHeader = ({ title, description, actions, meta, className }) => (
  <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="text-xl font-medium text-fg sm:text-[1.375rem] sm:leading-8">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-fg-muted">{description}</p>}
      {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export default PageHeader;
