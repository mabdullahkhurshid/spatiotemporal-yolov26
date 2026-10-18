import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import { getUser, updateUser } from '../../services/apiEndpoints';
import { setUser } from '../../store/slices/authSlice';
import { isPortalUser } from '../../utils/roleRoutes';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Feedback';
import { Field, Input } from '../../components/ui/Field';

// Photos are stored inline; keep them small enough for the API body limit and fast page loads.
const MAX_PHOTO_BYTES = 1024 * 1024;

const ProfileEditPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated } = useSelector((state) => state.auth);
  const userId = authUser?._id || authUser?.id;
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', avatar: '' });

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(authUser?.role)) {
      navigate('/login', { replace: true });
      return undefined;
    }
    if (!userId) return undefined;
    let isMounted = true;
    getUser(userId)
      .then((response) => {
        if (!isMounted) return;
        const data = response.data.data;
        setForm({ name: data?.name || '', phone: data?.phone || '', avatar: data?.avatar || '' });
      })
      .catch(() => isMounted && setForm({ name: authUser?.name || '', phone: authUser?.phone || '', avatar: authUser?.avatar || '' }))
      .finally(() => isMounted && setLoading(false));
    return () => {
      isMounted = false;
    };
  }, [authUser, isAuthenticated, navigate, userId]);

  const handleChange = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('That image is larger than 1 MB. Choose a smaller photo.');
      return;
    }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, avatar: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      const response = await updateUser(userId, { name: form.name, phone: form.phone, avatar: form.avatar || null });
      const updated = response.data.data;
      const normalized = { ...authUser, ...updated, _id: updated._id || updated.id, id: updated._id || updated.id };
      dispatch(setUser(normalized));
      localStorage.setItem('user', JSON.stringify(normalized));
      toast.success('Profile updated');
      navigate('/customer/profile');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Edit profile" description="Your name and photo appear to your team and in alert history." />

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader title="Personal details" />
            <CardBody className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={form.name || authUser?.name} email={authUser?.email} src={form.avatar} size="lg" />
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => fileInputRef.current?.click()}>
                      {form.avatar ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {form.avatar && (
                      <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => setForm((current) => ({ ...current, avatar: '' }))}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className={photoError ? 'text-xs font-medium text-critical-fg' : 'text-xs text-fg-subtle'} role={photoError ? 'alert' : undefined}>
                    {photoError || 'JPG, PNG or WebP, up to 1 MB.'}
                  </p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} aria-label="Upload profile photo" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input value={form.name} onChange={handleChange('name')} autoComplete="name" />
                </Field>
                <Field label="Phone" optional>
                  <Input type="tel" value={form.phone} onChange={handleChange('phone')} autoComplete="tel" placeholder="+92 300 1234567" />
                </Field>
                <Field label="Email" hint="Email changes aren't supported. Contact support if you need to move accounts." className="sm:col-span-2">
                  <Input value={authUser?.email || ''} readOnly className="bg-surface-2 text-fg-muted" />
                </Field>
              </div>
            </CardBody>
            <CardFooter>
              <Button as={Link} to="/customer/profile" variant="secondary">
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
};

export default ProfileEditPage;
