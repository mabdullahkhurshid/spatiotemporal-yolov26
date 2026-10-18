import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

/** Promise-based confirmation dialog: `if (await confirm({ title, tone: 'danger' })) ...` */
export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
};
