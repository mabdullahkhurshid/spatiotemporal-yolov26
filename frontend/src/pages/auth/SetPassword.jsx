import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { setPassword, setUser } from '../../store/slices/authSlice';
import { getDashboardPathForRole } from '../../utils/roleRoutes';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

const SetPassword = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [mismatch, setMismatch] = useState(false);

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
    try {
      await dispatch(setPassword({ password: formData.password })).unwrap();
      const updatedUser = { ...user, needsPasswordSetup: false };
      dispatch(setUser(updatedUser));
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('Password set. You can now also sign in with your email.');
      navigate(getDashboardPathForRole(user?.role));
    } catch (error) {
      toast.error(error || 'Failed to set password');
    }
  };

  return (
    <AuthLayout title="Add a password" description="You signed in with Google. Add a password if you'd also like to sign in with your email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Password" hint="At least 6 characters.">
          <Input name="password" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.password} onChange={handleChange} autoFocus />
        </Field>
        <Field label="Confirm password" error={mismatch ? 'Passwords don’t match.' : undefined}>
          <Input name="confirmPassword" type="password" icon={Lock} autoComplete="new-password" required minLength={6} value={formData.confirmPassword} onChange={handleChange} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Save password
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => navigate(getDashboardPathForRole(user?.role))}>
          Skip for now
        </Button>
      </form>
    </AuthLayout>
  );
};

export default SetPassword;
