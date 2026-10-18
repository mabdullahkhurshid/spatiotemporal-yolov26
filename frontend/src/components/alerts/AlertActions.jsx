import { CheckCircle2, Eye, Hand, MoreHorizontal, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import Menu from '../ui/Menu';

/**
 * One clear next step per alert (Acknowledge → Resolve), secondary actions in a menu.
 */
const AlertActions = ({ alert, actions, onView, size = 'sm', className }) => {
  const { acknowledge, requestResolve, falseAlarm, isPending } = actions;
  const open = alert.status === 'active' || alert.status === 'acknowledged';

  return (
    <div className={`flex items-center justify-end gap-1.5 ${className || ''}`}>
      {alert.status === 'active' && (
        <Button size={size} icon={Hand} loading={isPending(alert, 'acknowledge')} onClick={() => acknowledge(alert)}>
          Acknowledge
        </Button>
      )}
      {alert.status === 'acknowledged' && (
        <Button size={size} variant="secondary" icon={CheckCircle2} loading={isPending(alert, 'resolve')} onClick={() => requestResolve(alert)}>
          Resolve
        </Button>
      )}
      {!open && onView && (
        <Button size={size} variant="ghost" icon={Eye} onClick={() => onView(alert)}>
          Details
        </Button>
      )}
      {open && (
        <Menu
          width="w-48"
          items={[
            onView && { label: 'View details', icon: Eye, onClick: () => onView(alert) },
            alert.status === 'active' && { label: 'Resolve', icon: CheckCircle2, onClick: () => requestResolve(alert) },
            { label: 'Mark false alarm', icon: XCircle, onClick: () => falseAlarm(alert) },
          ]}
          trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label="More actions" size="sm" />}
        />
      )}
    </div>
  );
};

export default AlertActions;
