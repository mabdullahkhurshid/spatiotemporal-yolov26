import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, MessageSquare, Building2, User, Tag } from 'lucide-react';
import { submitContactMessage } from '../../services/publicApi';

const SUBJECT_OPTIONS = [
  'General inquiry',
  'Account & login',
  'Subscription & billing',
  'Technical issue',
  'Organization access',
  'Other',
];

const ContactSupportPage = () => {
  const { user } = useSelector((state) => state.auth);
  const submitLock = useRef(false);

  const orgName =
    typeof user?.organizationId === 'object'
      ? user.organizationId?.name
      : user?.organizationName || '';

  const [submitting, setSubmitting] = useState(false);
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

    if (!payload.name) {
      toast.error('Please enter your name');
      return;
    }

    if (payload.message.length < 10) {
      toast.error('Message must be at least 10 characters');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);

    try {
      await submitContactMessage(payload);
      toast.success('Your message has been sent successfully. We will get back to you soon.');
      setForm((current) => ({
        ...current,
        subject: 'General inquiry',
        message: '',
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/customer/help"
        className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-amber-400 hover:underline"
      >
        <ArrowLeft size={16} />
        Back to Help
      </Link>

      <section className="card space-y-2">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400">
          <Mail size={20} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Contact Support</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Fill out the form below and our team will respond to your account email. Include as much
          detail as possible about your issue.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label htmlFor="support-name" className="block text-sm font-medium mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="support-name"
              type="text"
              required
              maxLength={120}
              value={form.name}
              onChange={handleChange('name')}
              className="input-field pl-10"
              placeholder="Your name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="support-email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="support-email"
              type="email"
              required
              readOnly
              value={form.email}
              className="input-field pl-10 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Replies will be sent to your account email.
          </p>
        </div>

        <div>
          <label htmlFor="support-organization" className="block text-sm font-medium mb-2">
            Organization <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="support-organization"
              type="text"
              maxLength={200}
              value={form.organization}
              onChange={handleChange('organization')}
              className="input-field pl-10"
              placeholder="Your organization name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="support-subject" className="block text-sm font-medium mb-2">
            Subject
          </label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              id="support-subject"
              value={form.subject}
              onChange={handleChange('subject')}
              className="input-field pl-10 appearance-none"
            >
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="support-message" className="block text-sm font-medium mb-2">
            Message
          </label>
          <div className="relative">
            <MessageSquare
              className="absolute left-3 top-3 text-gray-400"
              size={18}
            />
            <textarea
              id="support-message"
              required
              rows={6}
              minLength={10}
              maxLength={5000}
              value={form.message}
              onChange={handleChange('message')}
              className="input-field pl-10 resize-y min-h-[140px]"
              placeholder="Describe your issue or question in detail..."
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum 10 characters.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Link
            to="/customer/help"
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactSupportPage;
