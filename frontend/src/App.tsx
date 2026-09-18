import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";

const HomePage = lazy(() => import("./pages/HomePage"));
const AgentEditorPage = lazy(() => import("./pages/AgentEditorPage"));
const RunDashboardPage = lazy(() => import("./pages/RunDashboardPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const CompareRunsPage = lazy(() => import("./pages/CompareRunsPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TestSuitesPage = lazy(() => import("@/pages/TestSuitesPage"));
const TestSuiteDetailsPage = lazy(() => import("@/pages/TestSuiteDetailsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg mt-4" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/agents/new" element={<AgentEditorPage />} />
              <Route path="/agents/:id" element={<AgentEditorPage />} />
              <Route path="/runs/:id" element={<RunDashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/compare" element={<CompareRunsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/test-suites" element={<TestSuitesPage />} />
              <Route path="/test-suites/:id" element={<TestSuiteDetailsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
