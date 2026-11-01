import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileUp,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AuthProvider } from "./features/auth/auth-provider";
import "./features/auth/auth.css";
import { AuthenticatedShell } from "./layout/app-shell";
import { ThemeProvider, ThemeToggle } from "./theme/theme-provider";
import { useAuth } from "./features/auth/use-auth";
import type { UserProfile } from "./features/auth/auth-schema";
import { supabase, supabaseConfigurationError } from "./lib/supabase";

const AwaitingApprovalPage = lazy(() =>
  import("./features/auth/auth-pages").then((module) => ({
    default: module.AwaitingApprovalPage,
  })),
);
const LoginPage = lazy(() =>
  import("./features/auth/auth-pages").then((module) => ({
    default: module.LoginPage,
  })),
);
const SignupPage = lazy(() =>
  import("./features/auth/auth-pages").then((module) => ({
    default: module.SignupPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./features/auth/auth-pages").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./features/auth/auth-pages").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("./features/admin/admin-users").then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const CampaignsPage = lazy(() =>
  import("./features/campaigns/campaigns-page").then((module) => ({
    default: module.CampaignsPage,
  })),
);
const SubmissionFormPage = lazy(() =>
  import("./features/submissions/submissions-page").then((module) => ({
    default: module.SubmissionFormPage,
  })),
);
const MySubmissionsPage = lazy(() =>
  import("./features/submissions/submissions-page").then((module) => ({
    default: module.MySubmissionsPage,
  })),
);
const SubmissionDetailPage = lazy(() =>
  import("./features/submissions/submissions-page").then((module) => ({
    default: module.SubmissionDetailPage,
  })),
);
const ReviewerSubmissionsPage = lazy(() =>
  import("./features/review/review-pages").then((module) => ({
    default: module.ReviewerSubmissionsPage,
  })),
);
const ReviewSubmissionPage = lazy(() =>
  import("./features/review/review-pages").then((module) => ({
    default: module.ReviewSubmissionPage,
  })),
);
const RankingPage = lazy(() =>
  import("./features/review/review-pages").then((module) => ({
    default: module.RankingPage,
  })),
);
const SubmissionExportPage = lazy(() =>
  import("./features/review/review-pages").then((module) => ({
    default: module.SubmissionExportPage,
  })),
);
const PrivacyPage = lazy(() =>
  import("./features/legal/legal-pages").then((module) => ({
    default: module.PrivacyPage,
  })),
);
const TermsPage = lazy(() =>
  import("./features/legal/legal-pages").then((module) => ({
    default: module.TermsPage,
  })),
);

function AuthStatusError({ message }: { message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card" role="alert">
        <p className="auth-eyebrow">Acesso seguro</p>
        <h1>Não foi possível verificar sua conta</h1>
        <p className="auth-description">{message}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

function RouteLoading() {
  return (
    <main className="auth-page">
      <p className="auth-loading" role="status">
        Verificando sua conta…
      </p>
    </main>
  );
}

function PublicRoute() {
  const { session, profile, loading, error } = useAuth();

  if (loading) return <RouteLoading />;
  if (error) return <AuthStatusError message={error} />;
  if (session) {
    return (
      <Navigate
        to={profile?.status === "approved" ? "/" : "/awaiting-approval"}
        replace
      />
    );
  }

  return <Outlet />;
}

function ApprovedRoute() {
  const { session, profile, loading, error } = useAuth();

  if (loading) return <RouteLoading />;
  if (error) return <AuthStatusError message={error} />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.status !== "approved") {
    return <Navigate to="/awaiting-approval" replace />;
  }

  return (
    <main className="app-dashboard">
      <section className="app-dashboard-welcome" aria-labelledby="approved-title">
        <p className="app-dashboard-eyebrow">Acesso aprovado</p>
        <h1 id="approved-title">Boas-vindas, {profile.full_name}</h1>
        <p>
          Seu espaço está pronto. Acesse as campanhas e acompanhe as atividades
          do seu capítulo.
        </p>
      </section>
      <section className="app-dashboard-shortcuts" aria-label="Acesso rápido">
        <Link className="app-dashboard-card" to="/campaigns">
          <span className="app-dashboard-card-icon" aria-hidden="true">
            <ClipboardList aria-hidden="true" size={22} />
          </span>
          <span>
            <strong>Campanhas</strong>
            <small>Consulte atividades e prazos</small>
          </span>
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
        {profile.role === "member" && (
          <Link className="app-dashboard-card" to="/my-submissions">
            <span className="app-dashboard-card-icon" aria-hidden="true">
              <FileUp aria-hidden="true" size={22} />
            </span>
            <span>
              <strong>Meus envios</strong>
              <small>Acompanhe suas atividades</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        )}
        {profile.role !== "member" && (
          <Link className="app-dashboard-card" to="/review">
            <span className="app-dashboard-card-icon" aria-hidden="true">
              <ShieldCheck aria-hidden="true" size={22} />
            </span>
            <span>
              <strong>Avaliações</strong>
              <small>Acesse os envios para análise</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        )}
        <Link className="app-dashboard-card" to="/ranking">
          <span className="app-dashboard-card-icon" aria-hidden="true">
            <BarChart3 aria-hidden="true" size={22} />
          </span>
          <span>
            <strong>Ranking</strong>
            <small>Veja os resultados das campanhas</small>
          </span>
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
        {profile.role === "admin" && (
          <Link className="app-dashboard-card" to="/admin/users">
            <span className="app-dashboard-card-icon" aria-hidden="true">
              <Users aria-hidden="true" size={22} />
            </span>
            <span>
              <strong>Gestão de usuários</strong>
              <small>Administre os acessos ao portal</small>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        )}
      </section>
    </main>
  );
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserProfile["role"][];
  children: ReactNode;
}) {
  const { session, profile, loading, error } = useAuth();

  if (loading) return <RouteLoading />;
  if (error) return <AuthStatusError message={error} />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.status !== "approved") {
    return <Navigate to="/awaiting-approval" replace />;
  }
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/campaigns" replace />;
  }

  return children;
}

function ConfigurationError() {
  return (
    <main className="auth-page">
      <section className="auth-card" role="alert">
        <p className="auth-eyebrow">Configuração necessária</p>
        <h1>Autenticação indisponível</h1>
        <p className="auth-description">{supabaseConfigurationError}</p>
      </section>
    </main>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ThemeToggle />
        {!supabase ? (
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<ConfigurationError />} />
            </Routes>
          </Suspense>
        ) : (
          <AuthProvider client={supabase}>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                </Route>
                <Route
                  path="/forgot-password"
                  element={<ForgotPasswordPage />}
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<AuthenticatedShell />}>
                  <Route
                    path="/awaiting-approval"
                    element={<AwaitingApprovalPage />}
                  />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route
                    path="/campaigns/:campaignId"
                    element={<CampaignsPage />}
                  />
                  <Route
                    path="/activities/:activityId/submit"
                    element={<SubmissionFormPage />}
                  />
                  <Route
                    path="/my-submissions"
                    element={<MySubmissionsPage />}
                  />
                  <Route
                    path="/my-submissions/:submissionId"
                    element={<SubmissionDetailPage />}
                  />
                  <Route
                    path="/review"
                    element={
                      <RoleRoute allowedRoles={["reviewer", "admin"]}>
                        <ReviewerSubmissionsPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/review/:submissionId"
                    element={
                      <RoleRoute allowedRoles={["reviewer", "admin"]}>
                        <ReviewSubmissionPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/ranking"
                    element={
                      <RoleRoute allowedRoles={["member", "reviewer", "admin"]}>
                        <RankingPage />
                      </RoleRoute>
                    }
                  />
                  <Route
                    path="/export"
                    element={
                      <RoleRoute allowedRoles={["reviewer", "admin"]}>
                        <SubmissionExportPage />
                      </RoleRoute>
                    }
                  />
                  <Route path="/" element={<ApprovedRoute />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        )}
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
