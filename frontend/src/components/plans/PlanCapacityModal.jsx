import { Link } from 'react-router-dom';
import { Camera, Users } from 'lucide-react';
import { getPlanCapacityGaps } from '../../utils/checkoutMode';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';

const PlanCapacityModal = ({ plan, usage, onClose, onManageCameras, onChooseOther }) => {
  const gaps = getPlanCapacityGaps(plan, usage);
  const planName = plan?.name || 'This plan';

  return (
    <Dialog
      open={Boolean(plan)}
      onClose={onClose}
      title={`${planName} doesn't fit your current setup`}
      description="Renewing onto a smaller plan requires your usage to be within its limits. Nothing is removed automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onManageCameras}>
            Reduce cameras
          </Button>
          <Button onClick={onChooseOther}>Choose another plan</Button>
        </>
      }
    >
      <ul className="space-y-3">
        {gaps.camerasOver && (
          <li className="flex items-start gap-3 rounded-md border border-warning-line bg-warning-soft px-3 py-2.5 text-sm text-warning-fg">
            <Camera size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            You have {gaps.camerasUsed} cameras; {planName} allows {gaps.maxCameras}.
          </li>
        )}
        {gaps.operatorsOver && (
          <li className="flex items-start gap-3 rounded-md border border-warning-line bg-warning-soft px-3 py-2.5 text-sm text-warning-fg">
            <Users size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            You have {gaps.operatorsUsed} operators; {planName} allows {gaps.maxOperators}. Remove operators or choose a larger plan.
          </li>
        )}
      </ul>
      <p className="mt-4 text-sm text-fg-muted">
        Not sure what to do?{' '}
        <Link to="/customer/help/contact" className="link" onClick={onClose}>
          Contact support
        </Link>
      </p>
    </Dialog>
  );
};

export default PlanCapacityModal;
