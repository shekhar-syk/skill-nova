import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function PublicLayout() {
  const { user, getDashboardPath } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
      isActive
        ? 'text-violet-700 border-violet-600'
        : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-xl font-extrabold tracking-tight text-[#0A0F24] whitespace-nowrap shrink-0"
          >
            SKILLNOVA
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/courses" className={navLinkClass}>
              Courses
            </NavLink>
            <NavLink to="/roadmaps" className={navLinkClass}>
              Roadmaps
            </NavLink>
            <NavLink to="/labs" className={navLinkClass}>
              Labs
            </NavLink>
            <NavLink to="/campus-map" className={navLinkClass}>
              Campuses
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate(user ? getDashboardPath() : '/login')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'Dashboard' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2">
            {[
              ['/courses', 'Courses'],
              ['/roadmaps', 'Career Roadmaps'],
              ['/labs', 'Interactive Labs & AI Studios'],
              ['/campus-map', 'Campuses & Tech Hubs'],
              ['/learning-approach', 'Methodology'],
              ['/about', 'About'],
              ['/verify-certificate', 'Verify Certificate'],
              ['/contact', 'Contact'],
              ['/admission', 'Apply for Admission'],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate(user ? getDashboardPath() : '/login');
                }}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
              >
                {user ? 'Open Dashboard' : 'Sign In'}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#0A0F24] text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <span className="font-display text-xl font-extrabold tracking-tight text-white">SKILLNOVA</span>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Learn Skills. Build Careers. Shape Your Future. Industry-aligned engineering education built around 80% hands-on practice.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-white mb-4">Programs</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li><Link to="/courses?category=artificial-intelligence-and-data-science" className="hover:text-white transition-colors">AI & Data Science</Link></li>
              <li><Link to="/courses?category=full-stack-development" className="hover:text-white transition-colors">Full Stack Engineering</Link></li>
              <li><Link to="/courses?category=cloud-computing" className="hover:text-white transition-colors">Cloud & DevOps</Link></li>
              <li><Link to="/courses?category=electric-vehicle-technology" className="hover:text-white transition-colors">EV & Automotive Tech</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-white mb-4">Academy</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li><Link to="/about" className="hover:text-white transition-colors">About SkillNova</Link></li>
              <li><Link to="/roadmaps" className="hover:text-white transition-colors">Career Roadmaps</Link></li>
              <li><Link to="/learning-approach" className="hover:text-white transition-colors">80/20 Learning Approach</Link></li>
              <li><Link to="/admission" className="hover:text-white transition-colors">Admission Portal</Link></li>
              <li><Link to="/verify-certificate" className="hover:text-white transition-colors">Certificate Verification</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-white mb-4">Admissions Desk</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>admissions@skillnova.edu</li>
              <li>+91 80 4192 8800</li>
              <li>Level 7, Prestige Tech Park, Bengaluru 560103</li>
              <li className="pt-1">
                <Link to="/contact" className="text-violet-400 hover:text-violet-300 font-medium">
                  Send an Enquiry →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} SKILLNOVA Education Technologies. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <Link to="/verify-certificate" className="hover:text-slate-300">Verify Credential</Link>
              <Link to="/login" className="hover:text-slate-300">Portal Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
