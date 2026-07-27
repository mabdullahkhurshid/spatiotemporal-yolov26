import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle, Mail } from 'lucide-react';
import { FAQ_CATEGORIES } from '../../data/faq';

const FaqItem = ({ question, answer, isOpen, onToggle }) => (
  <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 py-4 text-left"
      aria-expanded={isOpen}
    >
      <span className="text-sm font-medium text-gray-900 dark:text-white">{question}</span>
      <ChevronDown
        size={18}
        className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
    {isOpen && (
      <p className="pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{answer}</p>
    )}
  </div>
);

const HelpPage = () => {
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (id) => {
    setOpenItems((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section className="card text-center py-8 px-6">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-amber-400 mb-4">
          <HelpCircle size={24} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">How can we help?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
          Browse common questions about your account, subscriptions, and getting started with
          FireGuard AI.
        </p>
      </section>

      {FAQ_CATEGORIES.map((category) => (
        <section key={category.id} className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {category.title}
          </h3>
          <div>
            {category.items.map((item) => (
              <FaqItem
                key={item.id}
                question={item.question}
                answer={item.answer}
                isOpen={Boolean(openItems[item.id])}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Still need help?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Send us a message and we will respond to your account email.
          </p>
        </div>
        <Link
          to="/customer/help/contact"
          className="btn-primary inline-flex items-center gap-2 text-sm flex-shrink-0"
        >
          <Mail size={16} />
          Contact Support
        </Link>
      </section>
    </div>
  );
};

export default HelpPage;
