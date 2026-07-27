import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setUser } from '../../store/slices/authSlice';
import { socketService } from '../../services/socketService';
import { getPostAuthRedirectPath } from '../../utils/roleRoutes';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();

  useEffect(() => {
    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');
    const needsPasswordParam = searchParams.get('needsPassword') === '1';

    if (token && refresh) {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('refreshToken', refresh);

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

            if (needsPasswordParam || data.data.needsPasswordSetup) {
              toast.success('Google sign-in successful. Please set a password to continue.');
              navigate('/auth/set-password');
              return;
            }

            navigate(getPostAuthRedirectPath(data.data.role));
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
