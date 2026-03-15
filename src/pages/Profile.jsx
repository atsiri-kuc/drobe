import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Moon, Sun, ShirtIcon } from 'lucide-react';
import './Profile.css';

export default function Profile() {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="page">
      <h1 className="page-title" style={{ paddingTop: 'var(--space-4)' }}>Profile</h1>

      <div className="profile-card card">
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user.displayName} className="profile-avatar" referrerPolicy="no-referrer" />
        ) : (
          <div className="profile-avatar-placeholder">
            <ShirtIcon size={28} />
          </div>
        )}
        <div className="profile-info">
          <span className="profile-name">{user?.displayName}</span>
          <span className="profile-email">{user?.email}</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Settings</h3>

        <button className="card settings-item" onClick={toggleDarkMode}>
          <div className="settings-item-left">
            {darkMode ? <Moon size={20} /> : <Sun size={20} />}
            <span>Dark Mode</span>
          </div>
          <div className={`toggle ${darkMode ? 'active' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </button>

        <button className="card settings-item settings-danger" onClick={logout}>
          <div className="settings-item-left">
            <LogOut size={20} />
            <span>Sign Out</span>
          </div>
        </button>
      </div>

      <div className="profile-footer">
        <p>WearLog v1.0</p>
        <p>Made with ☕ and good taste</p>
      </div>
    </div>
  );
}
