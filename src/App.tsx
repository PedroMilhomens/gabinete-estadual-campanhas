import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider } from "./features/auth/auth-provider";
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
  const { session, profile, loading, error, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  if (loading) return <RouteLoading />;
  if (error) return <AuthStatusError message={error} />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.status !== "approved") {
    return <Navigate to="/awaiting-approval" replace />;
  }

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError("Não foi possível encerrar sua sessão. Tente novamente.");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="approved-title">
        <header className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            D
          </div>
          <div>
            <p className="brand-name">DeMolay Rondônia</p>
            <p className="brand-caption">Campanhas estaduais</p>
          </div>
        </header>
        <div className="auth-heading">
          <p className="auth-eyebrow">Acesso aprovado</p>
          <h1 id="approved-title">Sua conta está pronta</h1>
          <p className="auth-description">
            Olá, {profile.full_name}. Acesse as campanhas e acompanhe os
            resultados.
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void handleSignOut()}
        >
          Sair da conta
        </button>
        {profile.role === "admin" && (
          <Link
            className="button button--primary button--link"
            to="/admin/users"
          >
            Gerenciar usuários
          </Link>
        )}
        <Link className="button button--primary button--link" to="/campaigns">
          Ver campanhas
        </Link>
        <Link className="button button--secondary button--link" to="/ranking">
          Ver ranking
        </Link>
        {profile.role === "member" && (
          <Link
            className="button button--secondary button--link"
            to="/my-submissions"
          >
            Meus envios
          </Link>
        )}
        {(profile.role === "reviewer" || profile.role === "admin") && (
          <>
            <Link
              className="button button--secondary button--link"
              to="/review"
            >
              Avaliar envios
            </Link>
            <Link
              className="button button--secondary button--link"
              to="/export"
            >
              Exportar CSV
            </Link>
          </>
        )}
        {signOutError && (
          <p className="form-alert" role="alert">
            {signOutError}
          </p>
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
    <BrowserRouter>
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
              <Route path="/my-submissions" element={<MySubmissionsPage />} />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      )}
    </BrowserRouter>
  );
}

export default App;
