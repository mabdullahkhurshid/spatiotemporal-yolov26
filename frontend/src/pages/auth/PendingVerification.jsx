import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../store/slices/authSlice';
import { useEffect } from 'react';
import { ShieldAlert, User } from 'lucide-react';
import api from '../../services/api';

const PendingVerification = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(getMe());
  }, [dispatch]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name?.value;
    const userId = user?.id || user?._id;
    if (!name || !userId) return;
    try {
      await api.put(`/users/${userId}`, { name });
      dispatch(getMe());
      window.location.reload(); // refresh user in store
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (user.role === 'super_admin' || user.isVerified) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full card text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <ShieldAlert className="text-amber-600 dark:text-amber-400" size={48} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Pending Verification</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your account is awaiting approval by a Super Admin. Until then, you can only update your profile below.
          You will not have access to cameras, alerts, or other features until verified.
        </p>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 text-left">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <User size={20} /> Limited profile
          </h2>
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                name="name"
                defaultValue={user.name}
                className="w-full rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full rounded-lg border dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-500"
              />
            </div>
            <button type="submit" className="w-full btn-primary">
              Update profile
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PendingVerification;
