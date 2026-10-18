import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, CheckCircle2, Trash2, VideoOff } from 'lucide-react';
import api from '../../services/api';
import { getAccountSummary } from '../../services/customerApi';
import { getPublicSubscriptionPlans } from '../../services/publicApi';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { EmptyState, Notice, Skeleton } from '../../components/ui/Feedback';
import { useConfirm } from '../../components/ui/confirmContext';
import UsageBar from '../../components/account/UsageBar';
import { cameraTitle } from '../../utils/camera';

/** Lets an expired organization remove cameras so a smaller plan fits before renewing. */
const DowngradePrepPage = () => {
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');
  const [cameras, setCameras] = useState([]);
  const [usage, setUsage] = useState(null);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, camerasRes] = await Promise.all([getAccountSummary(), api.get('/cameras')]);
      setUsage(summaryRes?.data?.data?.usage ?? null);
      const list = camerasRes?.data?.data;
      setCameras(Array.isArray(list) ? list : []);
      if (planId) {
        const plansRes = await getPublicSubscriptionPlans();
        const plans = plansRes?.data?.data;
        setTarget(Array.isArray(plans) ? plans.find((p) => p._id === planId) || null : null);
      } else {
        setTarget(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load cameras');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (camera) => {
    const ok = await confirm({
      title: `Remove ${cameraTitle(camera)}?`,
      description: 'This frees one camera slot. The camera moves to deleted cameras and can be restored later if your plan allows.',
      confirmLabel: 'Remove camera',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setDeletingId(camera._id);
      await api.delete(`/cameras/${camera._id}`);
      toast.success('Camera removed');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove camera');
    } finally {
      setDeletingId(null);
    }
  };

  const cameraCount = usage?.camerasUsed ?? cameras.length;
  const maxCameras = target?.maxCameras;
  const overBy = maxCameras != null ? Math.max(0, cameraCount - maxCameras) : 0;
  const fits = maxCameras != null && overBy === 0;

  return (
    <div className="space-y-6">
      <div>
        <Button as={Link} to={planId ? '/customer/plans' : '/customer/subscription'} variant="link" size="sm" icon={ArrowLeft} className="mb-4">
          Back to plans
        </Button>
        <PageHeader
          title="Reduce cameras"
          description="Your subscription has ended. Remove cameras until your setup fits the plan you want to renew onto. Extra operators can be removed from Operators."
          className="mb-0"
        />
      </div>

      {target && (
        <Card className="space-y-4 p-4 sm:p-5">
          <UsageBar label={`Cameras for the ${target.name} plan`} used={cameraCount} limit={maxCameras} />
          {fits ? (
            <Notice
              tone="success"
              icon={CheckCircle2}
              title={`Your cameras now fit the ${target.name} plan`}
              action={
                <Button as={Link} to={`/customer/subscribe/${encodeURIComponent(planId)}`} iconRight={ArrowRight}>
                  Continue to renewal
                </Button>
              }
            />
          ) : (
            <Notice tone="warning" title={`Remove ${overBy} more camera${overBy === 1 ? '' : 's'}`}>
              {target.name} allows {maxCameras} camera{maxCameras === 1 ? '' : 's'}; you have {cameraCount}.
            </Notice>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Cameras" description={`${cameraCount} in use`} />
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : cameras.length === 0 ? (
          <EmptyState icon={VideoOff} title="No cameras registered" compact />
        ) : (
          <ul className="divide-y divide-line">
            {cameras.map((camera) => (
              <li key={camera._id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{cameraTitle(camera)}</p>
                  {camera.location && <p className="truncate text-xs text-fg-muted">{camera.location}</p>}
                </div>
                <Button variant="danger-ghost" size="sm" icon={Trash2} loading={deletingId === camera._id} onClick={() => handleDelete(camera)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default DowngradePrepPage;
