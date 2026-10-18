import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Mail, User } from 'lucide-react';
import { register, verifyEmail, login, resendVerificationCode } from '../../store/slices/authSlice';
import { getAccessToken } from '../../services/tokenStore';
import { getPostAuthRedirectPath, storePendingPlanId } from '../../utils/roleRoutes';
import { socketService } from '../../services/socketService';
import AuthLayout from '../../components/auth/AuthLayout';
import GoogleButton from '../../components/auth/GoogleButton';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Feedback';

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading, error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [mismatch, setMismatch] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    storePendingPlanId(searchParams.get('planId'));
  }, [searchParams]);

  const loginPath = searchParams.get('planId') ? `/login?planId=${encodeURIComponent(searchParams.get('planId'))}` : '/login';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'confirmPassword' || e.target.name === 'password') setMismatch(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setMismatch(true);
      return;
    }
    try {
      const { name, email, password } = formData;
      await dispatch(register({ name, email, password })).unwrap();
      toast.success('Account created — check your email for the code');
      setShowOTP(true);
    } catch (err) {
      toast.error(err || 'Registration failed');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      await dispatch(verifyEmail({ email: formData.email, otp })).unwrap();
      toast.success('Email verified');
      const result = await dispatch(login({ email: formData.email, password: formData.password })).unwrap();
      socketService.connect(getAccessToken());
      navigate(getPostAuthRedirectPath(result.user.role));
    } catch (err) {
      toast.error(err?.message || err || 'Verification failed');
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

  if (showOTP) {
    return (
      <AuthLayout
        title="Check your email"
        description={
          <>
            We sent a 6-digit code to <span className="font-medium text-fg">{formData.email}</span>. It expires in 10 minutes.
          </>
        }
      >
        <form onSubmit={handleVerifyOTP} className="space-y-5">
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
            Verify email
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
      title="Create your account"
      description="Start monitoring your cameras for fire and smoke."
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginPath} className="link">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton href={`${import.meta.env.VITE_API_URL || '/api'}/auth/google`}>Sign up with Google</GoogleButton>
      <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Notice tone="critical">{error}</Notice>}
        <Field label="Full name">
          <Input name="name" icon={User} autoComplete="name" required minLength={2} value={formData.name} onChange={handleChange} />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" icon={Mail} autoComplete="email" required value={formData.email} onChange={handleChange} placeholder="you@company.com" />
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <Input name="password" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.password} onChange={handleChange} />
        </Field>
        <Field label="Confirm password" error={mismatch ? 'Passwords don’t match.' : undefined}>
          <Input name="confirmPassword" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.confirmPassword} onChange={handleChange} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
        <p className="text-center text-xs text-fg-subtle">You&apos;ll verify your email before your first sign-in.</p>
      </form>
    </AuthLayout>
  );
};

export default Register;
