import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import AgentEditorPage from "./pages/AgentEditorPage";
import RunDashboardPage from "./pages/RunDashboardPage";
import HistoryPage from "./pages/HistoryPage";
import CompareRunsPage from "./pages/CompareRunsPage";
import TemplatesPage from "./pages/TemplatesPage";
import SkillsPage from "./pages/SkillsPage";
import SettingsPage from "./pages/SettingsPage";
import TestSuitesPage from "@/pages/TestSuitesPage";
import TestSuiteDetailsPage from "@/pages/TestSuiteDetailsPage";
import NotFoundPage from "./pages/NotFoundPage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/agents/new" element={<AgentEditorPage />} />
            <Route path="/agents/:id" element={<AgentEditorPage />} />
            <Route path="/runs/:id" element={<RunDashboardPage />} />
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
        <Toaster position="top-right" />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
