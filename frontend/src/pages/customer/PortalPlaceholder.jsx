import { Link } from 'react-router-dom';

const PortalPlaceholder = ({ title, description, phase, actionTo, actionLabel }) => (
  <div className="max-w-2xl mx-auto card text-center py-12 px-6">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{description}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Coming in {phase}</p>
    {actionTo && actionLabel && (
      <Link to={actionTo} className="btn-primary inline-flex mt-6">
        {actionLabel}
      </Link>
    )}
  </div>
);

export default PortalPlaceholder;
