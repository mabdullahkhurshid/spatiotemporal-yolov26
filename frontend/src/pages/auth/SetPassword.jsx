import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { setPassword, setUser } from '../../store/slices/authSlice';
import { getDashboardPathForRole } from '../../utils/roleRoutes';

const SetPassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await dispatch(setPassword({ password: formData.password })).unwrap();
      const updatedUser = {
        ...user,
        needsPasswordSetup: false,
      };
      dispatch(setUser(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Password set successfully. You can now sign in with email and password.');
      navigate(getDashboardPathForRole(user?.role));
    } catch (error) {
      toast.error(error || 'Failed to set password');
    }
  };

  const handleSkip = () => {
    navigate(getDashboardPathForRole(user?.role));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-600">🔥</h1>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Set Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            You signed in with Google. Set a password if you also want to sign in with email and
            password later.
          </p>
        </div>

        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="Enter password (min 6 characters)"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="Confirm password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Set Password & Continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleSkip}
            className="mt-4 w-full text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            Skip for now (Google sign-in only)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
