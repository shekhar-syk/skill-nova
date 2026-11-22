import React, { Component, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, BookOpen, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
    navy: 'bg-[#0A0F24] text-white hover:bg-slate-800 shadow-sm',
    secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    light: 'bg-white text-[#0A0F24] hover:bg-slate-100 shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl ${
        hover ? 'transition-all duration-200 hover:border-violet-300 hover:shadow-md' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusText({ status }) {
  const s = String(status || '').toUpperCase();
  const styles = {
    PUBLISHED: 'text-emerald-700',
    APPROVED: 'text-emerald-700',
    FULLY_PAID: 'text-emerald-700',
    SUCCESS: 'text-emerald-700',
    COMPLETED: 'text-emerald-700',
    REVIEWED: 'text-emerald-700',
    CONVERTED: 'text-emerald-700',
    SELECTED: 'text-emerald-700',
    PRESENT: 'text-emerald-700',
    OPEN: 'text-emerald-700',
    ACTIVE: 'text-violet-700',
    SHORTLISTED: 'text-violet-700',
    SCHEDULED: 'text-violet-700',
    APPLIED: 'text-violet-700',
    SUBMITTED: 'text-violet-700',
    NEW: 'text-violet-700',
    ADVANCE_PAID: 'text-amber-700',
    PAYMENT_PENDING: 'text-amber-700',
    FOLLOW_UP: 'text-amber-700',
    UNDER_REVIEW: 'text-amber-700',
    INTERVIEW_SCHEDULED: 'text-amber-700',
    LATE: 'text-amber-700',
    FAILED: 'text-rose-700',
    REJECTED: 'text-rose-700',
    NEEDS_REVISION: 'text-rose-700',
    CANCELLED: 'text-rose-700',
    ABSENT: 'text-rose-700',
    CLOSED: 'text-slate-500',
    DRAFT: 'text-slate-500',
    ARCHIVED: 'text-slate-500',
  };

  return (
    <span className={`font-mono text-xs font-medium tracking-tight ${styles[s] || 'text-slate-700'}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className={`bg-white border border-slate-200 rounded-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function CourseThumbnail({ src, alt, className = 'w-full h-48' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-[#0A0F24] via-slate-900 to-violet-950 flex flex-col items-center justify-center p-4 text-center`}
      >
        <BookOpen className="w-8 h-8 text-violet-400 mb-2" />
        <span className="text-xs font-medium text-slate-300 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-900`}
    />
  );
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'left' }) {
  return (
    <div className={align === 'center' ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      {eyebrow && (
        <p className="text-xs font-semibold tracking-wider text-violet-700 mb-2">{eyebrow}</p>
      )}
      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-base text-slate-600 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader label="Verifying your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
        ? '/admin'
        : user.role === 'INSTRUCTOR'
        ? '/instructor'
        : '/student';
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Uncaught UI error:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Something went unexpectedly wrong
              </h2>
              <p className="text-sm text-slate-600 mt-1.5">
                The page encountered a temporary rendering issue. Reload or return home to continue smoothly.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.assign('/');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Return Home
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
