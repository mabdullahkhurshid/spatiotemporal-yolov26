import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, SearchX } from 'lucide-react';
import { FAQ_CATEGORIES } from '../../data/faq';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/Field';
import { cn } from '../../utils/cn';

const FaqItem = ({ id, question, answer, isOpen, onToggle }) => (
  <div>
    <h3>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-${id}`}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 sm:px-5"
      >
        <span className="text-sm font-medium text-fg">{question}</span>
        <ChevronDown size={18} className={cn('shrink-0 text-fg-subtle transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden="true" />
      </button>
    </h3>
    <div id={`faq-${id}`} role="region" hidden={!isOpen} className="px-4 pb-4 text-sm leading-relaxed text-fg-muted sm:px-5">
      {answer}
    </div>
  </div>
);

const HelpPage = () => {
  const [openItems, setOpenItems] = useState({});
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_CATEGORIES;
    return FAQ_CATEGORIES.map((c) => ({ ...c, items: c.items.filter((i) => `${i.question} ${i.answer}`.toLowerCase().includes(q)) })).filter((c) => c.items.length);
  }, [query]);

  const toggle = (id) => setOpenItems((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & support"
        description="Answers about your account, subscription and getting started."
        actions={
          <Button as={Link} to="/customer/help/contact" variant="secondary" icon={Mail}>
            Contact support
          </Button>
        }
        className="mb-0"
      />

      <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" label="Search help articles" className="sm:max-w-md" />

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No answers match your search"
            description="Try other words, or ask our team directly."
            action={
              <Button as={Link} to="/customer/help/contact">
                Contact support
              </Button>
            }
          />
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <CardHeader title={category.title} />
            <div className="divide-y divide-line">
              {category.items.map((item) => (
                <FaqItem
                  key={item.id}
                  id={item.id}
                  question={item.question}
                  answer={item.answer}
                  isOpen={Boolean(query.trim()) || Boolean(openItems[item.id])}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          </Card>
        ))
      )}

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">Still need help?</p>
          <p className="mt-0.5 text-sm text-fg-muted">Send us a message — we reply to your account email.</p>
        </div>
        <Button as={Link} to="/customer/help/contact" icon={Mail}>
          Contact support
        </Button>
      </Card>
    </div>
  );
};

export default HelpPage;
