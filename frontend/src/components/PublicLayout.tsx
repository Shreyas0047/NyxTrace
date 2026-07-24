import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../design-system';

const DotMatrix = lazy(() => import('./DotMatrixBackground').then((m) => ({ default: m.DotMatrix })));

const AnimatedNavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="group relative inline-block overflow-hidden h-5 flex items-center text-sm font-body">
    <div className="flex flex-col transition-transform duration-400 ease-out transform group-hover:-translate-y-1/2">
      <span className="text-[#a8a294]">{children}</span>
      <span className="text-[#f0ede4]">{children}</span>
    </div>
  </Link>
);

function MiniNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass('rounded-[20px]');
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass('rounded-full'), 300);
    }
    return () => { if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current); };
  }, [isOpen]);

  const logoElement = (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] top-0 left-1/2 -translate-x-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] left-0 top-1/2 -translate-y-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] right-0 top-1/2 -translate-y-1/2 opacity-80" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-[#a8a294] bottom-0 left-1/2 -translate-x-1/2 opacity-80" />
    </div>
  );

  const navLinksData = [
    { label: 'Manifesto', to: '/manifesto' },
    { label: 'Discover', to: '/discover' },
  ];

  const baseButtonClass = "relative z-10 block px-4 py-2 sm:px-3 text-xs sm:text-sm rounded-full transition-all duration-200 w-full sm:w-auto text-center border font-body";

  const loginButtonElement = (
    <Link to="/login" className="relative group w-full sm:w-auto inline-block">
      {isLoginPage && (
        <div className="absolute inset-0 -m-3 rounded-full bg-amber-500 opacity-20 blur-2xl pointer-events-none" />
      )}
      <span className={`${baseButtonClass} ${isLoginPage ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-[#3a3730] text-[#a8a294] bg-transparent hover:border-[#5c574c] hover:text-[#f0ede4]'}`}>
        Login
      </span>
    </Link>
  );

  const signupButtonElement = (
    <Link to="/register" className="relative group w-full sm:w-auto inline-block">
      {isRegisterPage && (
        <div className="absolute inset-0 -m-3 rounded-full bg-amber-500 opacity-20 blur-2xl pointer-events-none" />
      )}
      <span className={`${baseButtonClass} ${isRegisterPage ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-[#3a3730] text-[#a8a294] bg-transparent hover:border-[#5c574c] hover:text-[#f0ede4]'}`}>
        Sign Up
      </span>
    </Link>
  );

  return (
    <header className={`fixed top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pl-6 pr-6 py-3 backdrop-blur-sm ${headerShapeClass} border border-[#3a3730] bg-[#171510]/80 w-[calc(100%-2rem)] sm:w-auto transition-[border-radius] duration-0 ease-in-out`}>
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <Link to="/" className="flex items-center">{logoElement}</Link>
        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.to} to={link.to}>{link.label}</AnimatedNavLink>
          ))}
        </nav>
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {loginButtonElement}
          {signupButtonElement}
        </div>
        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-[#a8a294] focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>
      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <Link key={link.to} to={link.to} className="text-[#a8a294] hover:text-[#f0ede4] transition-colors w-full text-center font-body">{link.label}</Link>
          ))}
        </nav>
        <div className="flex flex-col items-center space-y-4 mt-4 w-full">
          {loginButtonElement}
          {signupButtonElement}
        </div>
      </div>
    </header>
  );
}

interface PublicLayoutProps {
  children: React.ReactNode;
  reverse?: boolean;
  className?: string;
}

export function PublicLayout({ children, reverse = false, className }: PublicLayoutProps) {
  return (
    <div className={cn('flex w-[100%] flex-col min-h-screen relative', className)}
      style={{ background: '#0a0a08' }}>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0">
          <Suspense fallback={<div className="absolute inset-0 bg-[#0a0a08]" />}>
            <DotMatrixWithAnimationSpeed
              animationSpeed={reverse ? 4 : 3}
              colors={[[245, 240, 230], [245, 240, 230]]}
              dotSize={6}
              reverse={reverse}
            />
          </Suspense>
        </div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(10,10,8,1) 0%, transparent 100%)' }} />
        <div className="absolute top-0 left-0 right-0 h-1/3" style={{ background: 'linear-gradient(to bottom, #0a0a08, transparent)' }} />
      </div>
      <div className="relative z-10 flex flex-col flex-1">
        <MiniNavbar />
        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex-1 flex flex-col justify-center items-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const DotMatrixWithAnimationSpeed: React.FC<{
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ('x' | 'y')[];
  animationSpeed?: number;
  reverse?: boolean;
}> = ({ animationSpeed = 3, reverse = false, ...props }) => {
  return (
    <div className="h-full w-full">
      <DotMatrix
        {...props}
        shader={`${reverse ? 'u_reverse_active' : 'false'}_; animation_speed_factor_${animationSpeed.toFixed(1)}_;`}
      />
    </div>
  );
};

export default PublicLayout;
