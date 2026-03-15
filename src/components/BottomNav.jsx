import { NavLink } from 'react-router-dom';
import { Home, ShirtIcon, PlusCircle, BarChart3, User } from 'lucide-react';
import './BottomNav.css';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/wardrobe', icon: ShirtIcon, label: 'Wardrobe' },
  { to: '/log', icon: PlusCircle, label: 'Log' },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label={label}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
