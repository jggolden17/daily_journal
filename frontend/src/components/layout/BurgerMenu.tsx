import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function BurgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Show/hide burger menu based on mouse proximity to left edge
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const proximityThreshold = 80; // pixels from left edge
      const isNearLeftEdge = event.clientX <= proximityThreshold;
      
      // Also check if mouse is over the button or menu
      const isOverButton = buttonRef.current?.contains(event.target as Node);
      const isOverMenu = menuRef.current?.contains(event.target as Node);
      
      setIsVisible(isNearLeftEdge || isOverButton || isOverMenu || isOpen);
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative z-50">
      {/* Hamburger Icon */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 left-4 z-50 p-2 rounded-md hover:bg-gray-100 transition-all duration-200 bg-white shadow-md ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Menu"
      >
        <svg
          className="w-5 h-5 text-gray-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Slide-out Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-40 transform transition-transform">
            <div className="p-4 pt-16">
              <nav className="space-y-2">
                <button
                  onClick={() => handleNavigate('/')}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => handleNavigate('/metrics')}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  View Metric Charts
                </button>
                <div className="border-t border-gray-200 my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

