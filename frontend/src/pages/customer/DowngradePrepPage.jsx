import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, Trash2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { getAccountSummary } from '../../services/customerApi';
import { getPublicSubscriptionPlans } from '../../services/publicApi';

const DowngradePrepPage = () => {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');

  const [cameras, setCameras] = useState([]);
  const [usage, setUsage] = useState(null);
  const [targetMaxCameras, setTargetMaxCameras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, camerasRes] = await Promise.all([
        getAccountSummary(),
        api.get('/cameras'),
      ]);

      const summary = summaryRes?.data?.data;
      setUsage(summary?.usage ?? null);

      const list = camerasRes?.data?.data;
      setCameras(Array.isArray(list) ? list : []);

      if (planId) {
        const plansRes = await getPublicSubscriptionPlans();
        const plans = plansRes?.data?.data;
        const plan = Array.isArray(plans) ? plans.find((p) => p._id === planId) : null;
        setTargetMaxCameras(plan?.maxCameras ?? null);
      } else {
        setTargetMaxCameras(null);
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
    const id = camera._id;
    const label = camera.name || camera.label || 'this camera';
    if (!window.confirm(`Remove "${label}"? This frees one camera slot for a smaller plan.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await api.delete(`/cameras/${id}`);
      toast.success('Camera removed');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove camera');
    } finally {
      setDeletingId(null);
    }
  };

  const cameraCount = usage?.camerasUsed ?? cameras.length;
  const overTarget =
    targetMaxCameras != null && Number.isFinite(targetMaxCameras) && cameraCount > targetMaxCameras;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          to={planId ? `/customer/plans` : '/customer/subscription'}
          className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-amber-400 hover:underline mb-4"
        >
          <ArrowLeft size={16} />
          Back to plans
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reduce cameras before renewal</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Your subscription is expired. Remove cameras here so a smaller plan can fit your organization.
          Operators can be removed from the org admin Users area if you exceed operator limits.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40">
            <Camera className="text-primary-600 dark:text-amber-400" size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {cameraCount} camera{cameraCount === 1 ? '' : 's'} in use
            </p>
            {targetMaxCameras != null && (
              <p className={`text-sm ${overTarget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                Selected plan allows {targetMaxCameras} camera{targetMaxCameras === 1 ? '' : 's'}
                {overTarget
                  ? ` — remove at least ${cameraCount - targetMaxCameras} more`
                  : ' — you can proceed to checkout'}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading cameras…</p>
        ) : cameras.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No cameras registered.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {cameras.map((camera) => (
              <li key={camera._id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {camera.name || camera.label || 'Camera'}
                  </p>
                  {camera.location && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{camera.location}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(camera)}
                  disabled={deletingId === camera._id}
                  className="btn-secondary text-sm inline-flex items-center gap-1 shrink-0 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900"
                >
                  <Trash2 size={14} />
                  {deletingId === camera._id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!overTarget && targetMaxCameras != null && planId && (
        <div className="text-center">
          <Link
            to={`/customer/subscribe/${encodeURIComponent(planId)}`}
            className="btn-primary inline-flex"
          >
            Continue to renewal checkout
          </Link>
        </div>
      )}
    </div>
  );
};

export default DowngradePrepPage;
