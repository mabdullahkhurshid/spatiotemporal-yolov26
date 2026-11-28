import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Mail } from 'lucide-react';
import { login, resendVerificationCode, verifyEmail } from '../../store/slices/authSlice';
import { getAccessToken } from '../../services/tokenStore';
import { getPostAuthRedirectPath, storePendingPlanId } from '../../utils/roleRoutes';
import { socketService } from '../../services/socketService';
import AuthLayout from '../../components/auth/AuthLayout';
import GoogleButton from '../../components/auth/GoogleButton';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Feedback';

const OAUTH_ERRORS = {
  account_suspended: 'Your account is suspended. Please contact support.',
  email_unverified: 'Your Google account email is not verified. Verify it with Google, or sign in with email and password.',
  invalid_state: 'Your Google sign-in session expired. Please try again.',
  google_unavailable: 'Google sign-in is not available right now. Sign in with email and password.',
};

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [needsVerification, setNeedsVerification] = useState(false);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    storePendingPlanId(searchParams.get('planId'));
  }, [searchParams]);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (!oauthError) return;
    if (oauthError === 'google_cancelled') toast('Google sign-in was cancelled.');
    else toast.error(OAUTH_ERRORS[oauthError] || 'Google sign-in failed. Please try again.');
  }, [searchParams]);

  const registerPath = searchParams.get('planId') ? `/register?planId=${encodeURIComponent(searchParams.get('planId'))}` : '/register';

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const signIn = async () => {
    const result = await dispatch(login(formData)).unwrap();
    toast.success(`Welcome back${result.user?.name ? `, ${result.user.name.split(' ')[0]}` : ''}`);
    socketService.connect(getAccessToken());
    navigate(getPostAuthRedirectPath(result.user.role));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signIn();
    } catch (err) {
      const message = err?.message || 'Login failed';
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        return;
      }
      toast.error(message);
    }
  };

  const handleResendCode = async () => {
    try {
      const result = await dispatch(resendVerificationCode({ email: formData.email })).unwrap();
      toast.success(result.message || 'A new code has been sent');
    } catch (err) {
      toast.error(err || 'Could not send a new code');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      await dispatch(verifyEmail({ email: formData.email, otp })).unwrap();
      toast.success('Email verified');
      setNeedsVerification(false);
      await signIn();
    } catch (err) {
      toast.error(err?.message || err || 'Verification failed');
    }
  };

  const googleHref = `${import.meta.env.VITE_API_URL || '/api'}/auth/google`;
  const googleOnly = typeof error === 'string' && error.includes('Google sign-in');

  if (needsVerification) {
    return (
      <AuthLayout
        title="Verify your email"
        description={
          <>
            Enter the 6-digit code we sent to <span className="font-medium text-fg">{formData.email}</span>.
          </>
        }
        footer={
          <button type="button" onClick={() => setNeedsVerification(false)} className="link">
            Back to sign in
          </button>
        }
      >
        <form onSubmit={handleVerify} className="space-y-5">
          <Field label="Verification code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="h-12 text-center text-2xl tracking-[0.5em]"
              placeholder="000000"
              autoFocus
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={otp.length !== 6}>
            Verify and sign in
          </Button>
          <p className="text-center text-sm text-fg-muted">
            Didn&apos;t get it?{' '}
            <button type="button" onClick={handleResendCode} className="link">
              Send a new code
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Use your FireGuard AI account to open your cameras and alerts."
      footer={
        <>
          New to FireGuard AI?{' '}
          <Link to={registerPath} className="link">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton href={googleHref}>Continue with Google</GoogleButton>
      <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
        <span className="h-px flex-1 bg-line" />
        or sign in with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && !googleOnly && <Notice tone="critical">{error}</Notice>}
        {googleOnly && <Notice tone="info">This account uses Google sign-in. Continue with Google above, then set a password in Settings if you&apos;d like one.</Notice>}
        <Field label="Email">
          <Input id="email" name="email" type="email" icon={Mail} autoComplete="email" required value={formData.email} onChange={handleChange} placeholder="you@company.com" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-fg">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" icon={Lock} autoComplete="current-password" required value={formData.password} onChange={handleChange} />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;
