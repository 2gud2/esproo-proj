import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, User, Mail, Shield, CheckCircle } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './Settings.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in both password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message || 'Failed to update password');
      } else {
        toast.success('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopBar title="Settings" />
        <main className="page-body settings-body">
          <div className="page-header">
            <div>
              <h2 className="page-title">Account Settings</h2>
              <p className="page-subtitle">Manage your profile information and security preferences</p>
            </div>
          </div>

          <div className="settings-grid">
            {/* Profile Information (Read-only) */}
            <div className="card card-pad settings-card">
              <div className="settings-card-header">
                <div className="settings-icon-box">
                  <User size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 className="settings-card-title">Profile Information</h3>
                  <p className="settings-card-desc">Your basic account details managed by administrators</p>
                </div>
              </div>

              <div className="settings-fields">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-icon-wrap">
                    <User size={15} className="input-icon" />
                    <input
                      type="text"
                      className="input readonly-input"
                      value={user?.name || 'Staff User'}
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-icon-wrap">
                    <Mail size={15} className="input-icon" />
                    <input
                      type="email"
                      className="input readonly-input"
                      value={user?.email || 'user@espro.ph'}
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Role</label>
                  <div className="input-icon-wrap">
                    <Shield size={15} className="input-icon" />
                    <input
                      type="text"
                      className="input readonly-input"
                      value={user?.role === 'admin' ? 'Administrator (Full Access)' : 'Employee (Cashier/Staff)'}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <div className="card card-pad settings-card">
              <div className="settings-card-header">
                <div className="settings-icon-box">
                  <Lock size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 className="settings-card-title">Security & Password</h3>
                  <p className="settings-card-desc">Update your password to keep your account secure</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="settings-fields" noValidate>
                <div className="form-group">
                  <label className="form-label">New Password (min. 6 characters)</label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      className="input"
                      style={{ paddingRight: 42 }}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      onClick={() => setShowNewPw(v => !v)}
                      tabIndex={-1}
                    >
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      className="input"
                      style={{ paddingRight: 42 }}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      onClick={() => setShowConfirmPw(v => !v)}
                      tabIndex={-1}
                    >
                      {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <motion.button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !newPassword || !confirmPassword}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <span className="spinner-sm" />
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Update Password
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
