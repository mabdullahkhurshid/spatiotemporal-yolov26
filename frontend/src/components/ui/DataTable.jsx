import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';
import { EmptyState, ErrorState, Skeleton } from './Feedback';
import IconButton from './IconButton';

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * Responsive data table: a real <table> from `md` up, stacked cards on phones (actions stay visible).
 *
 * columns: [{ key, header, cell(row), align, hideBelow, primary, mobileHidden, className, headerClassName, width }]
 *  - `primary` column becomes the card title on phones; the `actions` key renders at the card's bottom.
 */
const DataTable = ({
  columns,
  rows,
  rowKey = (row) => row._id || row.id,
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  rowClassName,
  caption,
  skeletonRows = 5,
  className,
  dense = false,
}) => {
  const primary = columns.find((c) => c.primary) || columns[0];
  const actions = columns.find((c) => c.key === 'actions');
  const details = columns.filter((c) => c !== primary && c !== actions && !c.mobileHidden);
  const pad = dense ? 'py-2' : 'py-3';

  if (error) return <ErrorState description={error} onRetry={onRetry} />;

  if (!loading && rows.length === 0) {
    return empty || <EmptyState icon={Inbox} title="Nothing here yet" compact />;
  }

  const clickable = Boolean(onRowClick);
  const onKey = (row) => (e) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={className}>
      {/* Desktop / tablet */}
      <div className="relative hidden overflow-x-auto scrollbar-thin md:block">
        <table className="w-full border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-fg-muted first:pl-5 last:pr-5',
                    col.align === 'right' && 'text-right',
                    col.hideBelow && HIDE_BELOW[col.hideBelow],
                    col.headerClassName
                  )}
                >
                  {col.key === 'actions' ? <span className="sr-only">{col.header || 'Actions'}</span> : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={`s-${i}`}>
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 first:pl-5 last:pr-5', pad, col.hideBelow && HIDE_BELOW[col.hideBelow])}>
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                    onKeyDown={onKey(row)}
                    tabIndex={clickable ? 0 : undefined}
                    className={cn('transition-colors', clickable && 'cursor-pointer hover:bg-surface-2/70 focus-visible:bg-surface-2', rowClassName?.(row))}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        onClick={col.key === 'actions' ? (e) => e.stopPropagation() : undefined}
                        className={cn(
                          'px-4 align-middle text-fg first:pl-5 last:pr-5',
                          pad,
                          col.align === 'right' && 'text-right',
                          col.hideBelow && HIDE_BELOW[col.hideBelow],
                          col.className
                        )}
                      >
                        {col.cell ? col.cell(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <ul className="divide-y divide-line md:hidden">
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 3) }, (_, i) => (
              <li key={`ms-${i}`} className="space-y-2 px-4 py-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : rows.map((row) => (
              <li key={rowKey(row)} className={cn('px-4 py-3.5', rowClassName?.(row))}>
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={onKey(row)}
                  className={cn(clickable && 'cursor-pointer')}
                >
                  <div className="min-w-0 text-sm font-medium text-fg">{primary.cell ? primary.cell(row) : row[primary.key]}</div>
                  {details.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {details.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <dt className="text-xs text-fg-subtle">{col.header}</dt>
                          <dd className="mt-0.5 min-w-0 truncate text-fg">{col.cell ? col.cell(row) : row[col.key]}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                {actions && <div className="mt-3 flex flex-wrap gap-2">{actions.cell(row)}</div>}
              </li>
            ))}
      </ul>
    </div>
  );
};

/** "Showing 1–20 of 54" + previous/next. */
export const Pagination = ({ page, pageSize, total, onChange, className }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5', className)}>
      <p className="tabular text-sm text-fg-muted">
        <span className="font-medium text-fg">{from}</span>–<span className="font-medium text-fg">{to}</span> of{' '}
        <span className="font-medium text-fg">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <span className="tabular px-2 text-sm text-fg-muted">
          {page} / {pages}
        </span>
        <IconButton icon={ChevronRight} label="Next page" variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} />
      </div>
    </nav>
  );
};

export default DataTable;
