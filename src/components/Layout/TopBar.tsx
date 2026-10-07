import { Bell, HelpCircle, User, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './TopBar.css';

interface TopBarProps {
  title: string;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  action?: React.ReactNode;
}

export default function TopBar({ title, searchPlaceholder, onSearch, action }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        {onSearch && (
          <div className="topbar-search">
            <Search size={15} className="topbar-search-icon" />
            <input
              className="topbar-search-input"
              placeholder={searchPlaceholder ?? 'Search...'}
              onChange={e => onSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="topbar-right">
        {action}
        <button className="topbar-icon-btn" title="Notifications">
          <Bell size={18} />
          <span className="topbar-notif-dot" />
        </button>
        <button className="topbar-icon-btn" title="Help">
          <HelpCircle size={18} />
        </button>
        <div className="topbar-avatar" title={user?.name}>
          {user?.name?.charAt(0).toUpperCase() ?? <User size={16} />}
        </div>
      </div>
    </header>
  );
}
