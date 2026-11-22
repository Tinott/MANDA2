
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Mandats from './pages/Mandats';
import Contacts from './pages/Contacts';
import Suivi from './pages/Suivi';
import Documents from './pages/Documents';
import Facturation from './pages/Facturation';
import NotesFrais from './pages/NotesFrais';
import Comptabilite from './pages/Comptabilite';
import Tresorerie from './pages/Tresorerie';
import IM from './pages/IM';
import Promesses from './pages/Promesses';
import Reporting from './pages/Reporting';
import Corbeille from './pages/Corbeille';
import Parametres from './pages/Parametres';
import UndoToast from './components/UndoToast';
import Mail from './pages/Mail';
import Assistant from './pages/Assistant';
import { NavMemory } from './hooks/useNavMemory';
import QuickAsk from './components/QuickAsk';

function LoadingScreen() {
  return <div className="min-h-screen bg-ink" />;
}

// Écran d'attente quand cet appareil n'a encore aucune donnée : on attend la
// réponse du serveur avant de proposer la création du cabinet — sinon un
// nouvel appareil (ou une connexion lente) afficherait l'accueil « premier
// lancement » à quelqu'un dont le cabinet existe déjà.
function AttenteServeur({ erreur, onRetry }) {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="text-center">
        <div className="font-display text-[20px] text-white">{erreur ? 'Connexion au serveur impossible' : 'Chargement de vos données…'}</div>
        <p className="text-white/60 text-[13px] mt-2 max-w-sm">
          {!erreur ? 'Un instant.' : onRetry ? 'Vérifiez votre connexion internet, puis réessayez — vos données sont en sécurité sur le serveur.' : 'Vérifiez votre connexion internet. Nouvelle tentative automatique en cours — vos données sont en sécurité sur le serveur.'}
        </p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[13px] px-4 py-2">Réessayer</button>}
      </div>
    </div>
  );
}

function Shell() {
  const { societe, cloudReady, cloudStatus } = useApp();
  if (!societe.onboarded) return cloudReady ? <Onboarding /> : <AttenteServeur erreur={cloudStatus === 'error'} />;
  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-10 pt-8 pb-24 max-w-[1400px]">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mandats" element={<Mandats />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/suivi" element={<Suivi />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/facturation" element={<Facturation />} />
          <Route path="/frais" element={<NotesFrais />} />
          <Route path="/comptabilite" element={<Comptabilite />} />
          <Route path="/tresorerie" element={<Tresorerie />} />
          <Route path="/im" element={<IM />} />
          <Route path="/mail" element={<Mail />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/promesses" element={<Promesses />} />
          <Route path="/rapports" element={<Reporting />} />
          <Route path="/corbeille" element={<Corbeille />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <UndoToast />
      <QuickAsk />
    </div>
  );
}

function AuthGate() {
  const { session, orgId, loadingOrg, recoveryMode, orgError, retryOrg } = useAuth();
  if (recoveryMode) return <ResetPassword />;
  if (session === undefined) return <LoadingScreen />;
  if (!session) return <Login />;
  if (loadingOrg) return <LoadingScreen />;
  if (orgError && !orgId) return <AttenteServeur erreur onRetry={retryOrg} />;
  if (!orgId) return <Login />; // étape "créer votre cabinet", gérée dans Login.jsx
  return (
    <AppProvider orgId={orgId}>
      <HashRouter>
        <NavMemory />
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
