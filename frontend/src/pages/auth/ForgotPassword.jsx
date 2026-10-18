import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import api from '../../services/api';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // The server answers the same way whether or not the account exists.
      await api.post('/auth/forgotpassword', { email });
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const back = (
    <Link to="/login" className="link inline-flex items-center gap-1.5">
      <ArrowLeft size={14} aria-hidden="true" />
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout title="Check your email" footer={back}>
        <div className="rounded-lg border border-line bg-surface-2/60 p-5 text-center">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-info-soft text-info-fg">
            <MailCheck size={20} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-fg">
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a link to reset your password.
          </p>
          <p className="mt-2 text-xs text-fg-muted">The link expires in 1 hour. Check your spam folder if it doesn&apos;t arrive.</p>
        </div>
        <Button variant="secondary" className="mt-5 w-full" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" description="Enter the email you sign in with and we'll send you a reset link." footer={back}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email">
          <Input type="email" icon={Mail} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
