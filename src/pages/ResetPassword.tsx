import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import './Login.css';
import './ResetPassword.css';

type Step = 'request' | 'sent' | 'set';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true); setError('');
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch (_) {}
    setLoading(false);
    setStep('sent');
    toast.success('Reset link sent!');
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPw || !confirmPw) { setError('Please fill in all fields.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    if (newPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (err) { setError(err.message); return; }
    toast.success('Password updated! Please sign in.');
    navigate('/login');
  }

  return (
    <div className="login-root">
      <div className="login-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="login-card"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          {step === 'request' && (
            <>
              <div className="reset-back">
                <Link to="/login" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back to Login</Link>
              </div>
              <div className="login-header">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Forgot Password?</h2>
                <p className="login-subtitle">Enter your email and we'll send a reset link.</p>
              </div>
              <form onSubmit={handleRequestReset} className="login-form">
                {error && <div className="login-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div className="input-icon-wrap">
                    <Mail size={15} className="input-icon" />
                    <input type="email" className="input" placeholder="you@espro.ph" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <motion.button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading} whileTap={{ scale: 0.98 }}>
                  {loading ? <span className="spinner-sm" /> : <><span>Send Reset Link</span><ArrowRight size={16} /></>}
                </motion.button>
              </form>
            </>
          )}

          {step === 'sent' && (
            <div className="reset-sent">
              <CheckCircle size={56} color="var(--success)" strokeWidth={1.5} />
              <h2>Check your email</h2>
              <p>We sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.</p>
              <Link to="/login" className="btn btn-primary" style={{ marginTop: 8 }}>Back to Login</Link>
            </div>
          )}

          {step === 'set' && (
            <>
              <div className="login-header">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Set New Password</h2>
                <p className="login-subtitle">Choose a strong new password.</p>
              </div>
              <form onSubmit={handleSetPassword} className="login-form">
                {error && <div className="login-error">{error}</div>}
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input type={showPw ? 'text' : 'password'} className="input" style={{ paddingRight: 42 }} placeholder="••••••••" value={newPw} onChange={e => setNewPw(e.target.value)} />
                    <button type="button" className="login-pw-toggle" onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-icon-wrap">
                    <Lock size={15} className="input-icon" />
                    <input type={showPw ? 'text' : 'password'} className="input" placeholder="••••••••" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                  </div>
                </div>
                <motion.button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading} whileTap={{ scale: 0.98 }}>
                  {loading ? <span className="spinner-sm" /> : 'Update Password'}
                </motion.button>
              </form>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
