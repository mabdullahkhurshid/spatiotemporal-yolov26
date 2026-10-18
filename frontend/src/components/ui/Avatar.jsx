import { cn } from '../../utils/cn';
import { initialsOf } from '../../utils/format';

const SIZES = { xs: 'h-6 w-6 text-2xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' };

/** Photo when available, otherwise initials on a neutral brand tint. */
const Avatar = ({ name, email, src, size = 'sm', className }) =>
  src ? (
    <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100', SIZES[size], className)}
    >
      {initialsOf(name, email)}
    </span>
  );

export default Avatar;
