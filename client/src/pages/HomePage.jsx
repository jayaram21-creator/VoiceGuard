import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { checkHealth } from '../services/api';
import { socket } from '../services/socket';
import { ContactsPanel } from '../components/ContactsPanel';
import { ActiveCallModal } from '../components/ActiveCallModal';
import { VoiceprintRegistration } from '../components/VoiceprintRegistration';

function HomePage() {
  const { user, logout } = useAuth();
  const { callState, onlineUserIds } = useCall();
  const [apiStatus, setApiStatus] = useState('checking...');
  const [socketStatus, setSocketStatus] = useState(
    socket.connected ? `connected (id: ${socket.id})` : 'connecting...'
  );
  const [showRegistration, setShowRegistration] = useState(false);
  const [voiceprintActive, setVoiceprintActive] = useState(false);
  const [checkingVoiceprint, setCheckingVoiceprint] = useState(true);

  const checkUserVoiceprint = () => {
    if (!user?.username) return;
    const aiUrl = import.meta.env.VITE_AI_URL || 'http://localhost:8000';
    setCheckingVoiceprint(true);
    fetch(`${aiUrl}/api/voiceprint/status/${encodeURIComponent(user.username.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        setVoiceprintActive(Boolean(data.is_enrolled));
      })
      .catch(() => {
        setVoiceprintActive(false);
      })
      .finally(() => {
        setCheckingVoiceprint(false);
      });
  };

  useEffect(() => {
    checkUserVoiceprint();
  }, [user?.username]);

  useEffect(() => {
    checkHealth()
      .then((data) => setApiStatus(`connected (server time: ${data.timestamp})`))
      .catch(() => setApiStatus('failed - is the server running on port 5001?'));

    function handleConnect() {
      setSocketStatus(`connected (id: ${socket.id})`);
    }
    function handleDisconnect() {
      setSocketStatus('disconnected');
    }
    function handleConnectError(err) {
      setSocketStatus(`connection error: ${err.message}`);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  return (
    <div className="home-page">
      {/* Top Application Header */}
      <header className="app-header">
        <div className="brand-group">
          <span className="brand-logo">🎙️</span>
          <div className="brand-details">
            <h2>VoiceGuard VoIP</h2>
            <span className="stage-badge">Stage 4 — WebRTC Voice</span>
          </div>
        </div>

        <div className="user-profile-header">
          <div className="user-info-text">
            <span className="user-name">{user?.username}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <div className="presence-indicator online">
            <span className="dot"></span> Online
          </div>
          <div className={`presence-indicator ${voiceprintActive ? 'online' : 'warn'}`} style={{ marginRight: '6px' }}>
            <span className="dot" style={{ backgroundColor: voiceprintActive ? '#10b981' : '#f59e0b' }}></span>
            {checkingVoiceprint ? 'Checking Voiceprint...' : voiceprintActive ? 'Voiceprint: Active 🛡️' : 'Voiceprint: Inactive ⚠️'}
          </div>
          <button
            type="button"
            className="btn-logout"
            onClick={() => setShowRegistration(true)}
            style={{
              background: voiceprintActive ? '#3b82f6' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              marginRight: '8px',
              fontWeight: 600
            }}
          >
            {voiceprintActive ? '🔄 Re-enroll Voiceprint' : '🎙️ Register Voiceprint (Active)'}
          </button>
          <button type="button" className="btn-logout" onClick={logout} id="logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="main-content">
        {/* System Diagnostics & Presence Bar */}
        <section className="diagnostics-bar">
          <div className="diag-item">
            <span className="diag-label">REST API</span>
            <span className={`diag-value ${apiStatus.startsWith('connected') ? 'ok' : 'err'}`}>
              {apiStatus}
            </span>
          </div>
          <div className="diag-item">
            <span className="diag-label">Signaling Socket</span>
            <span className={`diag-value ${socketStatus.startsWith('connected') ? 'ok' : 'err'}`}>
              {socketStatus}
            </span>
          </div>
          <div className="diag-item">
            <span className="diag-label">Biometric Voiceprint</span>
            <span className={`diag-value ${voiceprintActive ? 'ok' : 'warn'}`}>
              {checkingVoiceprint ? 'Checking...' : voiceprintActive ? 'Active & Protected 🛡️' : 'Not Enrolled ⚠️'}
            </span>
          </div>
          <div className="diag-item">
            <span className="diag-label">STUN Relay</span>
            <span className="diag-value ok">stun:stun.l.google.com:19302</span>
          </div>
          <div className="diag-item">
            <span className="diag-label">Active Peers Online</span>
            <span className="diag-value info">{onlineUserIds.size} users</span>
          </div>
        </section>

        {/* Contacts & Calling Interface */}
        <ContactsPanel />
      </main>

      {/* Active Call Screen Overlay */}
      <ActiveCallModal />

      {/* Registration Modal Overlay */}
      {showRegistration && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '500px', maxWidth: '90%' }}>
            <button onClick={() => setShowRegistration(false)} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', zIndex: 10 }}>✖</button>
            <VoiceprintRegistration user={user} onComplete={(uname) => {
              setShowRegistration(false);
              checkUserVoiceprint();
              alert('Voiceprint registered and activated successfully for ' + uname);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
