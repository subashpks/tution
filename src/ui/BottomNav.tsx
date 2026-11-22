import { NavLink } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, GraduationCap, Home, Inbox, LayoutDashboard, MessageCircleQuestion, User, Wallet } from 'lucide-react';
import type { Role } from '@/lib/data/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

function itemsFor(role: Role): NavItem[] {
  if (role === 'admin') {
    return [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/today', label: 'Today', icon: ClipboardCheck },
      { to: '/admin/students', label: 'Students', icon: GraduationCap },
    ];
  }
  if (role === 'tutor') {
    return [
      { to: '/today', label: 'Today', icon: ClipboardCheck },
      { to: '/timetable', label: 'Timetable', icon: CalendarDays },
      { to: '/queries', label: 'Queries', icon: MessageCircleQuestion },
      { to: '/inbox', label: 'Inbox', icon: Inbox },
      { to: '/you', label: 'You', icon: Home },
    ];
  }
  if (role === 'student') {
    return [
      { to: '/student', label: 'Home', icon: Home },
      { to: '/timetable', label: 'Timetable', icon: CalendarDays },
      { to: '/inbox', label: 'Inbox', icon: Inbox },
      { to: '/you', label: 'You', icon: User },
    ];
  }
  return [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/money', label: 'Money', icon: Wallet },
    { to: '/queries', label: 'Queries', icon: MessageCircleQuestion },
    { to: '/inbox', label: 'Inbox', icon: Inbox },
  ];
}

export function BottomNav({ role }: { role: Role }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {itemsFor(role).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <Icon size={20} strokeWidth={1.6} />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
