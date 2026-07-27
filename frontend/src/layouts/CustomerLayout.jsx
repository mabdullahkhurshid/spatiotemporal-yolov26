import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import CustomerSidebar from '../components/CustomerSidebar';
import CustomerHeader from '../components/CustomerHeader';

const CustomerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <CustomerSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CustomerHeader onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
