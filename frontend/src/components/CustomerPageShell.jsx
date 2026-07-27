import { Link, useNavigate } from "react-router-dom";
import CustomerProfileMenu from "./CustomerProfileMenu";

const CustomerPageShell = ({
  title,
  subtitle,
  user,
  backTo = "/",
  backLabel = "Back to Home",
  children,
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              to={backTo}
              className="text-sm text-primary-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 mb-1"
            >
              ← {backLabel}
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          {user && (
            <CustomerProfileMenu
              user={user}
              onScrollToContact={() => navigate("/#contact")}
              onPurchasePlan={() => navigate("/subscribe")}
            />
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default CustomerPageShell;
