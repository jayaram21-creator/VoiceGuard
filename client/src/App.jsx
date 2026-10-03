import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import './App.css';

/**
 * Simple state-based routing: AuthGate shows Login/Register when unauthenticated,
 * or wraps HomePage with CallProvider when authenticated.
 */
function AuthGate() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('login');

  if (loading) {
    return (
      <div className="app-shell">
        <p>Loading…</p>
      </div>
    );
  }

  if (user) {
    return (
      <CallProvider>
        <HomePage />
      </CallProvider>
    );
  }

  return view === 'login' ? (
    <LoginPage onSwitchToRegister={() => setView('register')} />
  ) : (
    <RegisterPage onSwitchToLogin={() => setView('login')} />
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;

