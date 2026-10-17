import { useCallback, useEffect, useState } from 'react';
import { getAccountSummary } from '../services/customerApi';
import {
  CHECKOUT_MODE,
  deriveCheckoutMode,
  planFitsUsage,
} from '../utils/checkoutMode';

/**
 * Portal renewal eligibility from GET /users/me/account-summary.
 * `mode` stays null until the summary resolves so callers do not treat
 * a loading state as a first purchase.
 */
export function useRenewalEligibility({ enabled = true } = {}) {
  const [accountSummary, setAccountSummary] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getAccountSummary();
        if (!cancelled) {
          setAccountSummary(response.data?.data ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setAccountSummary(null);
          setError(err.response?.data?.message || 'Failed to load account summary');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  const mode = accountSummary ? deriveCheckoutMode(accountSummary) : null;
  const flags = accountSummary?.flags ?? null;
  const usage = accountSummary?.usage ?? null;
  const isRenewalMode = mode === CHECKOUT_MODE.RENEWAL;
  const canRenew = isRenewalMode;

  const canCheckoutPlan = (plan) => {
    if (mode === CHECKOUT_MODE.FIRST_PURCHASE) {
      return true;
    }
    if (mode === CHECKOUT_MODE.RENEWAL) {
      return planFitsUsage(plan, usage);
    }
    return false;
  };

  return {
    mode,
    flags,
    usage,
    loading,
    error,
    refetch,
    canRenew,
    canCheckoutPlan,
    isRenewalMode,
    accountSummary,
  };
}
