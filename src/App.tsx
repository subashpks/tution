import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/context';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/ui/Toast';
import { BottomNav } from '@/ui/BottomNav';
import type { Role } from '@/lib/data/types';
import { AuthCallback } from '@/screens/AuthCallback';
import { Dashboard } from '@/screens/Dashboard';
import { DesignGallery } from '@/screens/DesignGallery';
import { Inbox } from '@/screens/Inbox';
import { LinkEntry } from '@/screens/LinkEntry';
import { Money } from '@/screens/Money';
import { NewStudent } from '@/screens/NewStudent';
import { NotFound } from '@/screens/NotFound';
import { ParentDetail } from '@/screens/ParentDetail';
import { ParentHome } from '@/screens/ParentHome';
import { Parents } from '@/screens/Parents';
import { Queries } from '@/screens/Queries';
import { SignIn } from '@/screens/SignIn';
import { StudentDetail } from '@/screens/StudentDetail';
import { StudentHome } from '@/screens/StudentHome';
import { StudentProgress } from '@/screens/StudentProgress';
import { Students } from '@/screens/Students';
import { Timetable } from '@/screens/Timetable';
import { Today } from '@/screens/Today';
import { TutorDetail } from '@/screens/TutorDetail';
import { Tutors } from '@/screens/Tutors';
import { You } from '@/screens/You';
import { landingFor } from '@/screens/shared';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Boot() {
  return (
    <div className="signin">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          M
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>Meena's Academy</div>
          <div className="tiny">Home tuition, kept calm</div>
        </div>
      </div>
      <div className="stack">
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
      </div>
      <p className="sr-only" role="status">
        Opening the academy
      </p>
    </div>
  );
}

function Shell() {
  const { status, session } = useAuth();
  if (status === 'loading') return <Boot />;
  if (!session) return <Navigate to="/signin" replace />;
  return (
    <div className="app-frame">
      <div className="app">
        <ScrollToTop />
        <Outlet />
        <BottomNav role={session.role} />
      </div>
    </div>
  );
}

function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return null;
  if (!allow.includes(session.role)) return <Navigate to={landingFor(session.role)} replace />;
  return <>{children}</>;
}

function Landing() {
  const { session } = useAuth();
  return <Navigate to={session ? landingFor(session.role) : '/signin'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/l/:code" element={<LinkEntry />} />
            <Route path="/design" element={<DesignGallery />} />

            <Route element={<Shell />}>
              <Route index element={<Landing />} />
              <Route
                path="/dashboard"
                element={
                  <RoleGate allow={['admin']}>
                    <Dashboard />
                  </RoleGate>
                }
              />
              <Route
                path="/today"
                element={
                  <RoleGate allow={['admin', 'tutor']}>
                    <Today />
                  </RoleGate>
                }
              />
              <Route
                path="/timetable"
                element={
                  <RoleGate allow={['admin', 'tutor', 'parent', 'student']}>
                    <Timetable />
                  </RoleGate>
                }
              />
              <Route
                path="/money"
                element={
                  <RoleGate allow={['admin', 'parent']}>
                    <Money />
                  </RoleGate>
                }
              />
              <Route
                path="/inbox"
                element={
                  <RoleGate allow={['admin', 'tutor', 'parent', 'student']}>
                    <Inbox />
                  </RoleGate>
                }
              />
              <Route
                path="/queries"
                element={
                  <RoleGate allow={['admin', 'tutor', 'parent']}>
                    <Queries />
                  </RoleGate>
                }
              />
              <Route
                path="/you"
                element={
                  <RoleGate allow={['admin', 'tutor', 'parent', 'student']}>
                    <You />
                  </RoleGate>
                }
              />
              <Route
                path="/home"
                element={
                  <RoleGate allow={['parent']}>
                    <ParentHome />
                  </RoleGate>
                }
              />
              <Route
                path="/student"
                element={
                  <RoleGate allow={['student']}>
                    <StudentHome />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <RoleGate allow={['admin']}>
                    <Students />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/students/new"
                element={
                  <RoleGate allow={['admin']}>
                    <NewStudent />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/students/:id"
                element={
                  <RoleGate allow={['admin']}>
                    <StudentDetail />
                  </RoleGate>
                }
              />
              <Route
                path="/student/:id/progress"
                element={
                  <RoleGate allow={['admin', 'tutor', 'parent']}>
                    <StudentProgress />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/tutors"
                element={
                  <RoleGate allow={['admin']}>
                    <Tutors />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/tutors/:id"
                element={
                  <RoleGate allow={['admin']}>
                    <TutorDetail />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/parents"
                element={
                  <RoleGate allow={['admin']}>
                    <Parents />
                  </RoleGate>
                }
              />
              <Route
                path="/admin/parents/:id"
                element={
                  <RoleGate allow={['admin']}>
                    <ParentDetail />
                  </RoleGate>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
