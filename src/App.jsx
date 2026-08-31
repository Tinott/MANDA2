import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Mandats from './pages/Mandats';
import Contacts from './pages/Contacts';
import Facturation from './pages/Facturation';
import NotesFrais from './pages/NotesFrais';
import Comptabilite from './pages/Comptabilite';
import Tresorerie from './pages/Tresorerie';
import IM from './pages/IM';
import Promesses from './pages/Promesses';
import Reporting from './pages/Reporting';
import Parametres from './pages/Parametres';

function Shell() {
  const { societe } = useApp();
  if (!societe.onboarded) return <Onboarding />;
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-10 py-8 max-w-[1400px]">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mandats" element={<Mandats />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/facturation" element={<Facturation />} />
          <Route path="/frais" element={<NotesFrais />} />
          <Route path="/comptabilite" element={<Comptabilite />} />
          <Route path="/tresorerie" element={<Tresorerie />} />
          <Route path="/im" element={<IM />} />
          <Route path="/promesses" element={<Promesses />} />
          <Route path="/rapports" element={<Reporting />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}
