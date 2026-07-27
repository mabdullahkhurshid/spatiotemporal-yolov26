import { Camera } from 'lucide-react';

const ProfileHero = ({
  name,
  email,
  avatar,
  role,
  editable = false,
  onEditPhoto,
  actions,
}) => {
  const initial =
    name?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || '?';

  const roleDisplay =
    role === 'org_admin'
      ? 'Organization Admin'
      : role === 'customer'
        ? 'Customer'
        : role?.replace('_', ' ') || 'Account';

  return (
    <div className="card overflow-hidden p-0">
      <div className="relative h-40 sm:h-48 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-900">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="relative px-4 sm:px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-14 sm:-mt-16">
          <div className="relative flex-shrink-0 mx-auto sm:mx-0">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover border-4 border-white dark:border-gray-900 shadow-lg"
              />
            ) : (
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-primary-600 text-white flex items-center justify-center text-4xl font-bold border-4 border-white dark:border-gray-900 shadow-lg">
                {initial}
              </div>
            )}

            {editable && onEditPhoto && (
              <button
                type="button"
                onClick={onEditPhoto}
                className="absolute bottom-1 right-1 inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-700 transition-colors"
                aria-label="Change profile photo"
              >
                <Camera size={16} />
              </button>
            )}
          </div>

          {actions && (
            <div className="flex flex-wrap justify-center sm:justify-end gap-2 pt-2 sm:pt-0">
              {actions}
            </div>
          )}
        </div>

        <div className="mt-4 text-center sm:text-left">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white break-words">
            {name || '—'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 break-all">
            {email || '—'}
          </p>
          <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-amber-400 capitalize">
            {roleDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileHero;
