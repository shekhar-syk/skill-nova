import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card } from '../../components/DesignSystem.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';

export function LoginPage() {
  const { login, getDashboardPath } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      showToast(`Signed in as ${user.fullName}`, 'success');
      const target = location.state?.from || getDashboardPath(user.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <Card className="p-6 sm:p-8">
        <p className="font-mono text-xs text-violet-700 mb-2">PORTAL ACCESS</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Sign In to SKILLNOVA</h1>
        <p className="mt-1 text-sm text-slate-600">Access your Student LMS, Instructor Console, or Admin Portal.</p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@skillnova.edu"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-violet-700 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 mb-2.5">SAMPLE DEMO ACCOUNTS (CLICK TO FILL)</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('student@skillnova.edu', 'SkillNova@Student2026')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 cursor-pointer"
            >
              Student Demo
            </button>
            <button
              type="button"
              onClick={() => fillDemo('instructor@skillnova.edu', 'SkillNova@Mentor2026')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 cursor-pointer"
            >
              Instructor Demo
            </button>
            <button
              type="button"
              onClick={() => fillDemo('admin@skillnova.edu', 'SkillNova@Admin2026')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 cursor-pointer"
            >
              Admin Demo
            </button>
            <button
              type="button"
              onClick={() => fillDemo('superadmin@skillnova.edu', 'SkillNova@Admin2026')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 cursor-pointer"
            >
              Super Admin Demo
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to SKILLNOVA?{' '}
          <Link to="/register" className="font-semibold text-violet-700 hover:underline">
            Create Student Account
          </Link>
        </p>
      </Card>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      showToast('Student account created successfully!', 'success');
      navigate('/student', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <Card className="p-6 sm:p-8">
        <p className="font-mono text-xs text-violet-700 mb-2">STUDENT REGISTRATION</p>
        <h1 className="font-display text-2xl font-bold text-slate-900">Create Your SKILLNOVA Account</h1>
        <p className="mt-1 text-sm text-slate-600">Track admissions, access courses, and earn certificates.</p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password (min 8 chars) *</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Register Student Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-violet-700 hover:underline">
            Sign In
          </Link>
        </p>
      </Card>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [previewToken, setPreviewToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      if (res.data.previewResetToken) setPreviewToken(res.data.previewResetToken);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Reset Your Password</h1>
        <p className="mt-1 text-sm text-slate-600">Enter your registered email to receive a password reset link.</p>

        {message && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 space-y-2">
            <p>{message}</p>
            {previewToken && (
              <Link
                to={`/reset-password?token=${previewToken}`}
                className="inline-block font-semibold underline text-emerald-900"
              >
                Continue to Reset Password →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-600 focus:outline-none"
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Send Reset Instructions
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      showToast('Password updated. Please sign in.', 'success');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900">Set New Password</h1>
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reset Token</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
