import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import AgentEditorPage from "./pages/AgentEditorPage";
import RunDashboardPage from "./pages/RunDashboardPage";
import HistoryPage from "./pages/HistoryPage";
import TemplatesPage from "./pages/TemplatesPage";
import SkillsPage from "./pages/SkillsPage";
import SettingsPage from "./pages/SettingsPage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/agents/new" element={<AgentEditorPage />} />
          <Route path="/agents/:id" element={<AgentEditorPage />} />
          <Route path="/runs/:id" element={<RunDashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;
