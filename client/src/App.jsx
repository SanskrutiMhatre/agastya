import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireGate, RequireRole, useAuth } from './auth.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import AppShell from './components/layout/AppShell.jsx';
import SignIn from './pages/auth/SignIn.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import { ForcedPasswordChange, Onboarding } from './pages/auth/Gates.jsx';
import AdminDashboard from './pages/dashboards/AdminDashboard.jsx';
import ManagerDashboard from './pages/dashboards/ManagerDashboard.jsx';
import AuthorDashboard from './pages/dashboards/AuthorDashboard.jsx';
import UsersPage from './pages/users/UsersPage.jsx';
import UserDetail from './pages/users/UserDetail.jsx';
import ProjectsPage from './pages/projects/ProjectsPage.jsx';
import ProjectDetail from './pages/projects/ProjectDetail.jsx';
import { AuditPlaceholder, NotFound } from './pages/Placeholders.jsx';
import ApprovalsPage from './pages/approvals/ApprovalsPage.jsx';
import MyPublications from './pages/projects/MyPublications.jsx';
import MyDataModules from './pages/dms/MyDataModules.jsx';
import { FullPageSpinner } from './components/ui/States.jsx';

// The data module editor carries the S1000D content models and Monaco: loaded when a module is opened.
const DmEditor = lazy(() => import('./pages/dms/DmEditor.jsx'));
const ReviewPage = lazy(() => import('./pages/approvals/ReviewPage.jsx'));

const ADMIN = 'software_admin';
const PM = 'project_manager';
const AUTHOR = 'author';

// Each role lands on its own dashboard, and only its own.
function Dashboard() {
  const { me } = useAuth();
  if (me.user.role === ADMIN) return <AdminDashboard />;
  if (me.user.role === PM) return <ManagerDashboard />;
  if (me.user.role === AUTHOR) return <AuthorDashboard />;
  return <Navigate to="/signin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/onboarding" element={<RequireGate gate="/onboarding"><Onboarding /></RequireGate>} />
            <Route path="/change-password" element={<RequireGate gate="/change-password"><ForcedPasswordChange /></RequireGate>} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="projects/:id/dms/:dmId" element={<Suspense fallback={<FullPageSpinner />}><DmEditor /></Suspense>} />
              <Route path="users" element={<RequireRole roles={[ADMIN, PM]}><UsersPage /></RequireRole>} />
              <Route path="users/:id" element={<RequireRole roles={[ADMIN, PM]}><UserDetail /></RequireRole>} />
              <Route path="approvals" element={<RequireRole roles={[ADMIN, PM]}><ApprovalsPage /></RequireRole>} />
              <Route path="approvals/:reqId" element={<RequireRole roles={[ADMIN, PM]}><Suspense fallback={<FullPageSpinner />}><ReviewPage /></Suspense></RequireRole>} />
              <Route path="audit" element={<RequireRole roles={[ADMIN]}><AuditPlaceholder /></RequireRole>} />
              <Route path="data-modules" element={<RequireRole roles={[AUTHOR]}><MyDataModules /></RequireRole>} />
              <Route path="publications" element={<RequireRole roles={[AUTHOR]}><MyPublications /></RequireRole>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
