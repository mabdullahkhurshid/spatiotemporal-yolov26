import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import api from '../../services/api';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      toast.error('This reset link is invalid. Request a new one.');
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMismatch(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setMismatch(true);
      return;
    }
    setLoading(true);
    try {
      await api.put('/auth/resetpassword', { token, password: formData.password });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      description="For your security, you'll be signed out of other devices."
      footer={
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password" hint="At least 6 characters.">
          <Input name="password" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.password} onChange={handleChange} autoFocus />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'Passwords don’t match.' : undefined}>
          <Input name="confirmPassword" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.confirmPassword} onChange={handleChange} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
