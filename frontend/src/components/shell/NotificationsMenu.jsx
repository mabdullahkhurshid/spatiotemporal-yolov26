import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, CheckCheck } from 'lucide-react';
import { fetchNotifications, markAllAsRead, markAsRead } from '../../store/slices/notificationSlice';
import { formatRelative } from '../../utils/format';
import { cn } from '../../utils/cn';
import IconButton from '../ui/IconButton';
import { EmptyState } from '../ui/Feedback';

/** Bell with an unread count and a popover list of in-app notifications. */
const NotificationsMenu = () => {
  const dispatch = useDispatch();
  const { notifications, unreadCount } = useSelector((state) => state.notifications);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <div ref={rootRef} className="relative">
      <IconButton icon={Bell} label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        {unreadCount > 0 && (
          <span className="tabular absolute right-1 top-1 min-w-[1rem] rounded-full bg-brand-600 px-1 text-center text-[0.625rem] font-semibold leading-4 text-white ring-2 ring-surface">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 animate-pop-in overflow-hidden rounded-lg border border-line bg-surface shadow-overlay sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => dispatch(markAllAsRead())} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="You're all caught up" description="New alert notifications will appear here." compact />
          ) : (
            <ul className="max-h-[min(26rem,70vh)] divide-y divide-line overflow-y-auto scrollbar-thin">
              {notifications.slice(0, 20).map((n, i) => (
                <li key={n._id || `local-${i}`}>
                  <button
                    type="button"
                    onClick={() => n._id && !n.isRead && dispatch(markAsRead(n._id))}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2', !n.isRead && 'bg-info-soft/50')}
                  >
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : n.priority === 'critical' ? 'bg-critical' : 'bg-brand-600')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{n.title}</span>
                      {n.message && <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">{n.message}</span>}
                      <span className="mt-1 block text-2xs text-fg-subtle">{formatRelative(n.createdAt || Date.now())}</span>
                    </span>
                    {!n.isRead && <span className="sr-only">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu;
