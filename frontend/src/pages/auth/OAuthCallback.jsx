import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/slices/authSlice';
import { socketService } from '../../services/socketService';
import toast from 'react-hot-toast';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();

  useEffect(() => {
    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');

    if (token && refresh) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refresh);

      // Fetch user data
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.data));
            dispatch(setUser(data.data));
            socketService.connect(token);

            const role = data.data.role;
            if (role === 'super_admin') {
              navigate('/superadmin/dashboard');
            } else if (role === 'org_admin') {
              navigate('/orgadmin/dashboard');
            } else {
              navigate('/operator/dashboard');
            }
            toast.success('Login successful!');
          } else {
            throw new Error('Failed to get user data');
          }
        })
        .catch((error) => {
          console.error('OAuth callback error:', error);
          toast.error('Authentication failed');
          navigate('/login');
        });
    } else {
      toast.error('Invalid authentication response');
      navigate('/login');
    }
  }, [searchParams, navigate, dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Completing authentication...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
