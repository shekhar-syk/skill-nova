import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bot,
  CheckCheck,
  Compass,
  ExternalLink,
  LogOut,
  Menu,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';
import { formatDate } from '../utils/formatters.js';

export default function DashboardLayout({ title, navItems, activeTab, onSelectTab, children }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notification Center state
  const [notifOpen, setNotifOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState({
    announcements: true,
    liveReminders: true,
    assignmentDeadlines: true,
    quizResults: true,
    mentorFeedback: true,
    paymentUpdates: true,
    placementUpdates: true,
    emailDigest: true,
  });
  const notifRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications/center');
      setNotifications(res.data.notifications || []);
      setUnreadCount(Number(res.data.unreadCount || 0));
    } catch {
      // ignore transient poll failures
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const timer = setInterval(loadNotifications, 45000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [user, loadNotifications]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const markRead = async (n) => {
    try {
      if (!n.is_read) {
        await api.patch(`/notifications/center/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      if (n.action_url) {
        setNotifOpen(false);
        navigate(n.action_url);
      }
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/center/read-all');
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
    } catch {
      showToast('Unable to mark notifications as read.', 'error');
    }
  };

  const openPrefs = async () => {
    setNotifOpen(false);
    setPrefsOpen(true);
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data.preferences) setPrefs(res.data.preferences);
    } catch {
      // keep defaults
    }
  };

  const savePrefs = async (e) => {
    e.preventDefault();
    try {
      await api.put('/notifications/preferences', prefs);
      showToast('Notification preferences updated.', 'success');
      setPrefsOpen(false);
    } catch {
      showToast('Failed to save preferences.', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#0A0F24] text-slate-200 shrink-0 border-r border-slate-800">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <Link to="/" className="font-display text-lg font-extrabold tracking-tight text-white">
            SKILLNOVA
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1.5">
          {user?.role === 'STUDENT' && (
            <Link
              to="/student/ai-assistant"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-violet-300 bg-violet-950/50 hover:bg-violet-900/60"
            >
              <span className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5" /> AI Learning Assistant
              </span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          <Link
            to="/roadmaps"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/70"
          >
            <span className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5" /> Career Roadmaps
            </span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <Link
            to="/courses"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/70"
          >
            <span>Browse Courses</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:bg-rose-950/50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-[#0A0F24] text-slate-200 flex flex-col h-full">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
              <Link to="/" className="font-display text-lg font-extrabold text-white">
                SKILLNOVA
              </Link>
              <button type="button" onClick={() => setSidebarOpen(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 space-y-2">
              {user?.role === 'STUDENT' && (
                <Link
                  to="/student/ai-assistant"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-violet-300 bg-violet-950/60"
                >
                  <Bot className="w-4 h-4" /> AI Assistant
                </Link>
              )}
              <Link
                to="/roadmaps"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800"
              >
                <Compass className="w-4 h-4" /> Career Roadmaps
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-950/50"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open workspace navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {user?.role === 'STUDENT' && (
              <Link
                to="/student/ai-assistant"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 whitespace-nowrap"
              >
                <Bot className="w-3.5 h-3.5" /> AI Tutor
              </Link>
            )}

            {/* Notification Bell Center */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Open notifications"
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-violet-600 text-white font-mono text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900">Notification Center</p>
                      <p className="font-mono text-[11px] text-slate-500">{unreadCount} unread</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-medium text-violet-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark all
                      </button>
                      <button
                        type="button"
                        onClick={openPrefs}
                        title="Notification preferences"
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-200/70 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                            !n.is_read ? 'bg-violet-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold text-violet-700">
                              {(n.category || 'SYSTEM').replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">{formatDate(n.created_at)}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />}
                            <span>{n.title}</span>
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 truncate max-w-[160px]">{user?.fullName}</p>
              <p className="font-mono text-xs text-violet-700">{user?.role?.replace('_', ' ')}</p>
            </div>
            <Link
              to="/courses"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
            >
              Catalogue
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Notification Preferences Modal */}
      {prefsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">Notification Preferences</h3>
              <button type="button" onClick={() => setPrefsOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={savePrefs} className="p-6 space-y-3">
              {[
                ['announcements', 'Academy Announcements & Broadcasts'],
                ['liveReminders', 'Live Class Schedules & Reminders'],
                ['assignmentDeadlines', 'Assignment & Deliverable Alerts'],
                ['quizResults', 'Assessment & Quiz Result Notices'],
                ['mentorFeedback', 'Instructor Reviews & Feedback'],
                ['placementUpdates', 'Placement & Internship Updates'],
                ['paymentUpdates', 'Fee Receipts & Payment Notices'],
                ['emailDigest', 'Weekly Progress Email Digest'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between text-sm text-slate-700 cursor-pointer py-1">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-violet-600"
                  />
                </label>
              ))}
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrefsOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg cursor-pointer"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
