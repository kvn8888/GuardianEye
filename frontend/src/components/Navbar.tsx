import { NavLink } from "@/components/NavLink";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";

const GuardianEyeLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 72" fill="none" className="h-12 w-auto">
    <defs>
      <linearGradient id="shieldFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3F9AAE" stopOpacity="0.15"/>
        <stop offset="100%" stopColor="#79C9C5" stopOpacity="0.1"/>
      </linearGradient>
      <linearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3F9AAE"/>
        <stop offset="100%" stopColor="#79C9C5"/>
      </linearGradient>
    </defs>
    <path d="M34 6 L54 14 L54 32 C54 45 45 55 34 61 C23 55 14 45 14 32 L14 14 Z" fill="url(#shieldFill)" stroke="url(#shieldStroke)" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M21 19 L27 27 L25 31" stroke="#F96E5B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
    <path d="M27 27 L31 24" stroke="#F96E5B" strokeWidth="0.9" strokeLinecap="round" opacity="0.65"/>
    <path d="M21 19 L29 21 L34 19" stroke="#FFE2AF" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
    <circle cx="21" cy="19" r="2.5" fill="#F96E5B" opacity="0.9"/>
    <circle cx="21" cy="19" r="1" fill="#FFE2AF"/>
    <path d="M22 36 C26 30.5 42 30.5 46 36 C42 41.5 26 41.5 22 36 Z" fill="none" stroke="#3F9AAE" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="34" cy="36" r="4.5" fill="none" stroke="#79C9C5" strokeWidth="1.5"/>
    <circle cx="34" cy="36" r="2.2" fill="#3F9AAE"/>
    <circle cx="35.2" cy="34.8" r="0.9" fill="#FFE2AF"/>
    <text x="66" y="31" fontFamily="Nunito, 'Helvetica Neue', sans-serif" fontSize="21" fontWeight="800" letterSpacing="0.5" fill="#3F9AAE">Guardian</text>
    <line x1="66" y1="36.5" x2="224" y2="36.5" stroke="#79C9C5" strokeWidth="0.6" opacity="0.5"/>
    <text x="67" y="54" fontFamily="Nunito, 'Helvetica Neue', sans-serif" fontSize="15" fontWeight="400" letterSpacing="7" fill="#79C9C5">EYE</text>
  </svg>
);

const navItems = [
  { to: "/", label: "Scan" },
  { to: "/my-scans", label: "My Scans" },
  { to: "/threat-intel", label: "Threat Intel" },
  { to: "/network", label: "Network" },
  { to: "/about", label: "About" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <NavLink to="/" className="flex-shrink-0">
            <GuardianEyeLogo />
          </NavLink>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="px-4 py-2 rounded-xl text-base font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-600">LIVE MONITORING</span>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="block px-4 py-3 rounded-xl text-lg font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5"
                activeClassName="text-primary bg-primary/10"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center gap-2 px-4 pt-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-semibold text-green-600">LIVE MONITORING</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
