import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setUser } from '../../store/slices/authSlice';
import { socketService } from '../../services/socketService';
import api from '../../services/api';
import { setAccessToken } from '../../services/tokenStore';
import { getPostAuthRedirectPath } from '../../utils/roleRoutes';
import { Loader2 } from 'lucide-react';
import { LogoMark } from '../../components/ui/Logo';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  // The one-time code is consumed by the first request; React StrictMode would otherwise run this twice.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get('code');
    const needsPasswordParam = searchParams.get('needsPassword') === '1';

    // Remove the code from the address bar and history.
    window.history.replaceState(null, '', window.location.pathname);

    if (!code) {
      toast.error('Invalid authentication response');
      navigate('/login');
      return;
    }

    (async () => {
      try {
        // Sets the httpOnly refresh cookie and returns a short-lived access token.
        const { data } = await api.post('/auth/oauth/exchange', { code });
        setAccessToken(data.accessToken);

        const me = await api.get('/auth/me');
        const user = me.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        dispatch(setUser(user));
        socketService.connect(data.accessToken);

        if (needsPasswordParam || user.needsPasswordSetup) {
          toast.success('Google sign-in successful. Please set a password to continue.');
          navigate('/auth/set-password');
          return;
        }

        navigate(getPostAuthRedirectPath(user.role));
        toast.success('Login successful!');
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error(error.response?.data?.message || 'Authentication failed');
        navigate('/login');
      }
    })();
  }, [searchParams, navigate, dispatch]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-4" aria-busy="true">
      <LogoMark size={40} />
      <div className="flex items-center gap-2.5 text-sm text-fg-muted" role="status">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Signing you in with Google…
      </div>
    </main>
  );
};

export default OAuthCallback;
