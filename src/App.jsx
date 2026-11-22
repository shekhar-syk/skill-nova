import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary, ProtectedRoute } from './components/DesignSystem.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/auth/AuthPages.jsx';
import InstructorDashboard from './pages/instructor/InstructorDashboard.jsx';
import AboutPage from './pages/public/AboutPage.jsx';
import AdmissionPage from './pages/public/AdmissionPage.jsx';
import CampusMapPage from './pages/public/CampusMapPage.jsx';
import CircuitRunnerGamePage from './pages/public/CircuitRunnerGamePage.jsx';
import ContactPage from './pages/public/ContactPage.jsx';
import CourseDetailPage from './pages/public/CourseDetailPage.jsx';
import CoursesPage from './pages/public/CoursesPage.jsx';
import HomePage from './pages/public/HomePage.jsx';
import LearningApproachPage from './pages/public/LearningApproachPage.jsx';
import VerifyCertificatePage from './pages/public/VerifyCertificatePage.jsx';
import AIAssistantPage from './pages/student/AIAssistantPage.jsx';
import CoursePlayerPage from './pages/student/CoursePlayerPage.jsx';
import RoadmapsPage from './pages/student/RoadmapsPage.jsx';
import SkillNovaLabsPage from './pages/student/SkillNovaLabsPage.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        {mapsQuotaExceeded && (
          <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-3 text-sm flex items-center justify-between gap-4">
            <p>
              <strong>Google Maps Demo Quota Reached:</strong> Live map rendering or route calls have exceeded the shared preview key allowance. Update{' '}
              <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
              <strong>Settings &gt; Secrets</strong> or enable billing in your Cloud project to restore unlimited map quota.
            </p>
            <button
              type="button"
              onClick={() => setMapsQuotaExceeded(false)}
              className="px-3 py-1 rounded-md bg-amber-200/80 hover:bg-amber-300 text-xs font-semibold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
            {/* Public Website Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:slug" element={<CourseDetailPage />} />
              <Route path="/roadmaps" element={<RoadmapsPage />} />
              <Route path="/labs" element={<SkillNovaLabsPage />} />
              <Route path="/campus-map" element={<CampusMapPage />} />
              <Route path="/learning-approach" element={<LearningApproachPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/admission" element={<AdmissionPage />} />
              <Route path="/verify-certificate" element={<VerifyCertificatePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Dedicated Full-Viewport Game Shell */}
            <Route path="/game" element={<CircuitRunnerGamePage />} />

            {/* Student LMS Routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'SUPER_ADMIN']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/ai-assistant"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}>
                  <AIAssistantPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/course/:courseId"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}>
                  <CoursePlayerPage />
                </ProtectedRoute>
              }
            />

            {/* Instructor Workspace */}
            <Route
              path="/instructor"
              element={
                <ProtectedRoute allowedRoles={['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']}>
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin & Super Admin Console */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </ToastProvider>
  );
}
