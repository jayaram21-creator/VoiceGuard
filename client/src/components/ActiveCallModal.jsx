import { useState } from 'react';
import { useCall } from '../context/CallContext';
import { VoiceGuardSecurityPanel } from './VoiceGuardSecurityPanel';
import { ForensicIncidentModal } from './ForensicIncidentModal';

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ActiveCallModal() {
  const [showTerminalDossier, setShowTerminalDossier] = useState(false);
  const {

    callState,
    currentCall,
    errorMessage,
    callDuration,
    isMuted,
    localVolume,
    remoteVolume,
    aasistAnalyzer,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMute,
    dismissCall,
  } = useCall();


  if (callState === 'idle') {
    return null;
  }

  const peer = currentCall?.peer;
  const peerName = peer?.username || 'Unknown User';

  return (
    <div className="call-modal-overlay" role="dialog" aria-modal="true">
      <div className={`call-modal-card ${callState}`}>
        {/* Outgoing Calling State */}
        {callState === 'calling' && (
          <div className="call-section">
            <div className="avatar-pulse">
              <div className="avatar-circle">{peerName.charAt(0).toUpperCase()}</div>
              <div className="pulse-ring ring-1"></div>
              <div className="pulse-ring ring-2"></div>
            </div>
            <h2>Calling {peerName}...</h2>
            <p className="call-subtext">Ringing remote device via signaling server...</p>
            <div className="call-actions">
              <button
                type="button"
                className="btn-call-action btn-hangup"
                onClick={cancelCall}
                id="cancel-call-btn"
              >
                Cancel Call
              </button>
            </div>
          </div>
        )}

        {/* Incoming Call State */}
        {callState === 'ringing' && (
          <div className="call-section incoming">
            <div className="avatar-pulse incoming-pulse">
              <div className="avatar-circle">{peerName.charAt(0).toUpperCase()}</div>
              <div className="pulse-ring ring-1 incoming-ring"></div>
              <div className="pulse-ring ring-2 incoming-ring"></div>
            </div>
            <h2>Incoming Call</h2>
            <p className="call-caller-name">{peerName} is calling you</p>
            <p className="call-subtext">Microphone access requested upon answering</p>
            <div className="call-actions">
              <button
                type="button"
                className="btn-call-action btn-accept"
                onClick={acceptCall}
                id="accept-call-btn"
              >
                Accept
              </button>
              <button
                type="button"
                className="btn-call-action btn-hangup"
                onClick={() => rejectCall('Call declined')}
                id="reject-call-btn"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Connecting WebRTC State */}
        {callState === 'connecting' && (
          <div className="call-section">
            <div className="spinner-container">
              <div className="call-spinner"></div>
            </div>
            <h2>Connecting...</h2>
            <p className="call-subtext">Exchanging WebRTC SDP offer/answer and ICE candidates</p>
            <div className="call-actions">
              <button
                type="button"
                className="btn-call-action btn-hangup"
                onClick={endCall}
                id="connecting-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active Connected Call State */}
        {callState === 'connected' && (
          <div className="call-section connected-section">
            <div className="call-header">
              <span className="live-indicator">LIVE WEBRTC VOICE</span>
              <span className="call-timer" id="call-duration-timer">{formatDuration(callDuration)}</span>
            </div>

            <div className="connected-peer-info">
              <div className="avatar-circle small">{peerName.charAt(0).toUpperCase()}</div>
              <div>
                <h3 className="connected-title">Connected with {peerName}</h3>
                <span className="codec-badge">STUN P2P Opus Audio</span>
              </div>
            </div>

            {/* Top Quick Call Actions (Always Visible at Top) */}
            <div className="top-call-actions">
              <button
                type="button"
                className={`btn-call-action btn-mute ${isMuted ? 'is-muted' : ''}`}
                onClick={toggleMute}
                id="top-toggle-mute-btn"
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button
                type="button"
                className="btn-call-action btn-hangup"
                onClick={endCall}
                id="top-end-call-btn"
                title="End active call"
              >
                🔴 End Call
              </button>
            </div>

            {/* Audio RMS Level Meters (Local & Remote) */}
            <div className="audio-meters-container">
              {/* Local Microphone Meter */}
              <div className="meter-card">
                <div className="meter-header">
                  <span>You (Microphone)</span>
                  <span className={`mute-badge ${isMuted ? 'muted' : 'active'}`}>
                    {isMuted ? 'MUTED' : 'LIVE'}
                  </span>
                </div>
                <div className="meter-bar-track">
                  <div
                    className={`meter-bar-fill local ${isMuted ? 'muted' : ''}`}
                    style={{ width: `${isMuted ? 0 : localVolume}%` }}
                  ></div>
                </div>
                <div className="meter-level-text">
                  Level: {isMuted ? '0%' : `${localVolume}%`}
                </div>
              </div>

              {/* Remote Audio Meter */}
              <div className="meter-card">
                <div className="meter-header">
                  <span>{peerName} (Remote Audio)</span>
                  <span className="meter-status-dot"></span>
                </div>
                <div className="meter-bar-track">
                  <div
                    className="meter-bar-fill remote"
                    style={{ width: `${remoteVolume}%` }}
                  ></div>
                </div>
                <div className="meter-level-text">Level: {remoteVolume}%</div>
              </div>
            </div>

            {/* Audio Visualizer Wave Simulation */}
            <div className="visualizer-waves">
              {[...Array(16)].map((_, i) => {
                const height = isMuted
                  ? 4
                  : Math.max(
                      4,
                      Math.min(
                        36,
                        Math.round((localVolume || remoteVolume || 5) * (0.3 + (i % 5) * 0.15))
                      )
                    );
                return (
                  <span
                    key={i}
                    className="wave-bar"
                    style={{ height: `${height}px` }}
                  ></span>
                );
              })}
            </div>

            {/* VoiceGuard AI Anti-Spoofing & Voice Cloning Detection Panel */}
            {aasistAnalyzer && <VoiceGuardSecurityPanel analyzer={aasistAnalyzer} />}

            {/* Bottom Call Action Controls (Sticky Footer) */}
            <div className="call-actions connected-actions">
              <button
                type="button"
                className={`btn-call-action btn-mute ${isMuted ? 'is-muted' : ''}`}
                onClick={toggleMute}
                id="toggle-mute-btn"
              >
                {isMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>
              <button
                type="button"
                className="btn-call-action btn-hangup"
                onClick={endCall}
                id="end-call-btn"
              >
                🔴 End Call
              </button>
            </div>
          </div>
        )}

        {/* Terminal Call States (Ended / Rejected / Failed) */}
        {(callState === 'ended' || callState === 'rejected' || callState === 'failed') && (
          <div className="call-section terminal">
            <div className={`terminal-icon ${callState}`}>
              {callState === 'ended' && '✓'}
              {callState === 'rejected' && '✕'}
              {callState === 'failed' && '!'}
            </div>
            <h2>
              {callState === 'ended' && 'Call Ended'}
              {callState === 'rejected' && 'Call Declined'}
              {callState === 'failed' && 'Call Failed'}
            </h2>
            <p className="call-subtext">{errorMessage || 'Connection closed'}</p>
            <div className="call-actions">
              {(aasistAnalyzer?.isLocked || aasistAnalyzer?.spoofScore >= 0.45 || aasistAnalyzer?.isImpersonator || aasistAnalyzer?.showFraudAlert) && (
                <button
                  type="button"
                  className="btn-call-action btn-forensic-terminal"
                  onClick={() => setShowTerminalDossier(true)}
                  id="terminal-forensic-dossier-btn"
                  style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 'bold' }}
                >
                  📋 View I4C / 1930 Forensic Dossier
                </button>
              )}
              <button
                type="button"
                className="btn-call-action btn-secondary"
                onClick={dismissCall}
                id="dismiss-call-btn"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Forensic Incident Dossier Modal on Call Completion */}
        <ForensicIncidentModal
          isOpen={showTerminalDossier}
          onClose={() => setShowTerminalDossier(false)}
          analyzer={aasistAnalyzer}
          peerName={peerName}
          callDuration={callDuration}
        />
      </div>
    </div>
  );
}
