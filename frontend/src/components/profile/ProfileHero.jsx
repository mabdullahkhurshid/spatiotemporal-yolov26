import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import { roleLabel } from '../../utils/accountFormatting';

/** Identity header for profile pages. */
const ProfileHero = ({ name, email, avatar, role, actions, children }) => (
  <Card className="p-5 sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Avatar name={name} email={email} src={avatar} size="xl" className="ring-4 ring-surface-2" />
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-xl font-semibold text-fg">{name || '—'}</h2>
        <p className="mt-0.5 break-all text-sm text-fg-muted">{email || '—'}</p>
        <Badge tone="brand" className="mt-2">
          {roleLabel(role)}
        </Badge>
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </div>
  </Card>
);

export default ProfileHero;
