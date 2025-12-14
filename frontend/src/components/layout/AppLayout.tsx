import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { BurgerMenu } from './BurgerMenu';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className={`min-h-screen ${isHomePage ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Show burger menu on all authenticated pages */}
      <BurgerMenu />

      {/* For home page, no padding/constraints - content fills viewport */}
      {isHomePage ? (
        <main className="h-screen w-full">
          {children}
        </main>
      ) : (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      )}
    </div>
  );
}

