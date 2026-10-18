import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { submitContactMessage } from '../../services/publicApi';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardFooter } from '../../components/ui/Card';
import { Notice } from '../../components/ui/Feedback';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';

const SUBJECT_OPTIONS = ['General inquiry', 'Account & login', 'Subscription & billing', 'Technical issue', 'Organization access', 'Other'];

const ContactSupportPage = () => {
  const { user } = useSelector((state) => state.auth);
  const submitLock = useRef(false);
  const orgName = typeof user?.organizationId === 'object' ? user.organizationId?.name : user?.organizationName || '';
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    organization: orgName || '',
    subject: 'General inquiry',
    message: '',
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || user?.name || '',
      email: user?.email || '',
      organization: current.organization || orgName || '',
    }));
  }, [user?.name, user?.email, orgName]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim() || 'General inquiry',
      message: form.message.trim(),
      organization: form.organization.trim() || undefined,
    };
    const nextErrors = {};
    if (!payload.name) nextErrors.name = 'Please enter your name.';
    if (payload.message.length < 10) nextErrors.message = 'Please describe the issue in at least 10 characters.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      await submitContactMessage(payload);
      toast.success('Message sent');
      setSent(true);
      setForm((current) => ({ ...current, subject: 'General inquiry', message: '' }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <div>
      <Button as={Link} to="/customer/help" variant="link" size="sm" icon={ArrowLeft} className="mb-4">
        Help & support
      </Button>
      <PageHeader title="Contact support" description="Tell us what's happening. We reply to your account email, usually within one business day." />

      {sent && (
        <Notice tone="success" icon={CheckCircle2} title="Message sent" className="mb-6">
          We&apos;ll get back to you at {form.email}. You can send another message below.
        </Notice>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required error={errors.name}>
              <Input value={form.name} onChange={handleChange('name')} autoComplete="name" />
            </Field>
            <Field label="Email" hint="Replies go to your account email.">
              <Input type="email" value={form.email} readOnly className="bg-surface-2 text-fg-muted" />
            </Field>
            <Field label="Organization" optional>
              <Input value={form.organization} onChange={handleChange('organization')} autoComplete="organization" />
            </Field>
            <Field label="Topic">
              <Select value={form.subject} onChange={handleChange('subject')}>
                {SUBJECT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Message" required error={errors.message} hint={`${form.message.trim().length} / 5000`} className="sm:col-span-2">
              <Textarea rows={6} maxLength={5000} value={form.message} onChange={handleChange('message')} placeholder="What were you trying to do, and what happened instead?" />
            </Field>
          </CardBody>
          <CardFooter>
            <Button type="submit" icon={Send} loading={submitting}>
              Send message
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default ContactSupportPage;
