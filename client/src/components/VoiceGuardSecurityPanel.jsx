import { useState, useEffect, useRef } from 'react';
import { ForensicIncidentModal } from './ForensicIncidentModal';

export function VoiceGuardSecurityPanel({ analyzer }) {
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const {
    isAnalyzing,
    spoofScore,
    bonafideScore,
    riskLevel,
    verdict,
    action,
    inferenceTimeMs,
    analysisHistory,
    isUnavailable,
    isDemoRunning,
    lastAnalyzedTime,
    runDemoSample,
    // Stabilization & Locking Props
    isLocked,
    lockedDecision,
    listeningProgress,
    voicedSeconds,
    lockThresholdSeconds,
    unlockAndRescan,
    detectedKeywords,
    showFraudAlert,
    triggerKeywordAlert,
    dismissFraudAlert,
    playBuzzerSound,
    reportFalseNegative,
    isReporting,
    // Biometric Voiceprint Props
    voiceprintEnrolled,
    voiceprintStatus,
    speakerSimilarity,
    isImpersonator,
    targetUsername,
  } = analyzer;

  const hasPlayedBuzzerRef = useRef(false);

  useEffect(() => {
    if (showFraudAlert && !hasPlayedBuzzerRef.current) {
      hasPlayedBuzzerRef.current = true;
      if (typeof playBuzzerSound === 'function') {
        playBuzzerSound();
      }
    } else if (!showFraudAlert) {
      hasPlayedBuzzerRef.current = false;
    }
  }, [showFraudAlert, playBuzzerSound]);

  const spoofPercent = Math.min(100, Math.max(0, (spoofScore * 100))).toFixed(1);
  const bonafidePercent = Math.min(100, Math.max(0, (bonafideScore * 100))).toFixed(1);

  const panelTheme = isLocked
    ? (lockedDecision === 'REAL' ? 'low' : 'high')
    : riskLevel.toLowerCase();

  return (
    <div className={`voiceguard-security-panel ${panelTheme} ${isLocked ? 'is-locked' : ''}`}>
      {/* Panel Header */}
      <div className="security-panel-header">
        <div className="shield-title">
          <span className="shield-icon">🛡️</span>
          <div>
            <h4>VoiceGuard AI Anti-Spoofing</h4>
            <span className="model-tag">AASIST Neural Spectro-Temporal Detector</span>
          </div>
        </div>

        <div className="shield-status">
          {isUnavailable ? (
            <span className="status-pill unavailable">AI Service Offline</span>
          ) : isLocked ? (
            <span className={`status-pill active locked ${lockedDecision.toLowerCase()}`}>
              🔒 Locked ({lockedDecision})
            </span>
          ) : isAnalyzing ? (
            <span className="status-pill analyzing">
              <span className="spinner-dot"></span> Listening...
            </span>
          ) : (
            <span className={`status-pill active ${riskLevel.toLowerCase()}`}>
              Shield Active
            </span>
          )}
        </div>
      </div>

      {/* TOP-LEVEL FRAUD & KEYWORD ALERT (Visible immediately on keyword detection) */}
      {showFraudAlert && (
        <div className="fraud-alert-popup">
          <div className="fraud-alert-icon">🚨</div>
          <div className="fraud-alert-text">
            <div className="fraud-alert-header">
              <h4>CRITICAL FRAUD WARNING: SCAM KEYWORDS DETECTED</h4>
              <button
                type="button"
                className="btn-dismiss-fraud"
                onClick={() => {
                  if (typeof dismissFraudAlert === 'function') dismissFraudAlert();
                }}
                title="Dismiss Fraud Alert"
              >
                ✕
              </button>
            </div>
            <p>
              Flagged Extortion / Phishing Words:{' '}
              <strong className="fraud-keywords">
                {detectedKeywords && detectedKeywords.length > 0 ? detectedKeywords.join(', ').toUpperCase() : 'OTP, URGENT TRANSFER'}
              </strong>
            </p>
            <p className="fraud-disclaimer">
              ⚠️ High-probability social engineering / digital arrest attempt. Do not share OTP, PIN, or transfer funds!
            </p>
          </div>
        </div>
      )}

      {/* Main Alert / Status Display */}
      {isUnavailable ? (
        <div className="security-alert-box unavailable">
          <p className="alert-title">AI security analysis temporarily unavailable</p>
          <p className="alert-subtext">
            WebRTC voice call is continuing normally without interruption.
          </p>
        </div>
      ) : isLocked ? (
        /* LOCKED DECISION BANNER (Zero Fluctuation) */
        <div className={`locked-decision-card ${lockedDecision.toLowerCase()}`}>
          <div className="locked-main">
            <div className={`locked-icon-badge ${lockedDecision.toLowerCase()}`}>
              {lockedDecision === 'REAL' ? '🔒' : lockedDecision === 'IMPERSONATOR' ? '👤⚠️' : '🚨'}
            </div>
            <div className="locked-text-block">
              <div className="locked-headline">
                <span className="locked-title">
                  {lockedDecision === 'REAL'
                    ? 'VERIFIED GENUINE HUMAN VOICE'
                    : lockedDecision === 'IMPERSONATOR'
                    ? 'CRITICAL: BIOMETRIC IDENTITY MISMATCH'
                    : 'CRITICAL: CLONED AI VOICE DETECTED'}
                </span>
                <span className={`risk-pill ${lockedDecision === 'REAL' ? 'low' : 'high'}`}>
                  LOCKED
                </span>
              </div>
              <p className="locked-description">
                {lockedDecision === 'REAL'
                  ? 'Acoustic tract resonance and micro-pitch dynamics verified genuine. Decision is locked with zero fluctuation.'
                  : lockedDecision === 'IMPERSONATOR'
                  ? 'Real human voice detected, but the biometric fingerprint DOES NOT MATCH the account owner. Imposter detected!'
                  : 'Synthesizer neural vocoder signatures detected! High probability of impersonation attack. Decision is locked.'}
              </p>
            </div>
          </div>
          
          {lockedDecision === 'CLONED' && (
            <div className="active-learning-indicator">
              <div className="learning-dot"></div>
              <div className="learning-text">
                <strong>Active Learning:</strong> Capturing pattern for Brain 2...
              </div>
              <div className="mini-waveform">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          )}
          
          {lockedDecision === 'IMPERSONATOR' && (
            <div className="active-learning-indicator" style={{background: 'rgba(255, 150, 0, 0.1)', color: '#ffa502', border: '1px solid rgba(255, 150, 0, 0.3)'}}>
              <div className="learning-dot" style={{background: '#ffa502'}}></div>
              <div className="learning-text">
                <strong>Warning:</strong> Someone else is using this account!
              </div>
            </div>
          )}

          <div className="locked-meta-bar">
            <span className="locked-meta-tag">
              ✓ Verified after {voicedSeconds}s of speech • Stable lock maintained
            </span>
            <button
              type="button"
              className="btn-rescan"
              onClick={unlockAndRescan}
              title="Reset analysis lock and re-evaluate speaker"
            >
              ↺ Re-Scan Voice
            </button>
          </div>
        </div>
      ) : (
        /* LISTENING & ACCUMULATING EVIDENCE (Pre-lock observation) */
        <div className="listening-evidence-card">
          <div className="evidence-header">
            <div className="evidence-title-group">
              <span className="evidence-pulse-dot"></span>
              <span className="evidence-title">Listening to voice characteristics...</span>
            </div>
            <span className="evidence-count">
              {voicedSeconds.toFixed(1)}s / {lockThresholdSeconds}s observed
            </span>
          </div>

          {/* Progress bar to lock-in */}
          <div className="evidence-track">
            <div
              className="evidence-fill"
              style={{ width: `${Math.max(8, listeningProgress)}%` }}
            ></div>
          </div>

          <p className="evidence-subtext">
            Observing speech for a few seconds to prevent score fluctuations before locking decision.
          </p>
        </div>
      )}

      {/* Biometric Voiceprint Verification Status Banner */}
      <div className={`voiceprint-status-banner ${voiceprintEnrolled ? (isImpersonator ? 'mismatch' : voiceprintStatus === 'VERIFIED_MATCH' ? 'verified' : 'enrolled') : 'unregistered'}`}>
        <div className="vp-icon">
          {voiceprintEnrolled ? (isImpersonator ? '👤⚠️' : voiceprintStatus === 'VERIFIED_MATCH' ? '👤✅' : '👤🛡️') : '👤ℹ️'}
        </div>
        <div className="vp-content">
          <div className="vp-title-row">
            <span className="vp-title">
              Biometric Voiceprint: {voiceprintEnrolled ? (
                isImpersonator 
                  ? 'CRITICAL IDENTITY MISMATCH' 
                  : voiceprintStatus === 'VERIFIED_MATCH' 
                  ? 'VERIFIED CALLER MATCH' 
                  : 'ACTIVE & ENROLLED'
              ) : 'NOT ENROLLED'}
            </span>
            <span className={`vp-badge ${voiceprintEnrolled ? (isImpersonator ? 'bad' : 'good') : 'neutral'}`}>
              {voiceprintEnrolled ? (isImpersonator ? 'MISMATCH' : 'ACTIVE') : 'INACTIVE'}
            </span>
          </div>
          <p className="vp-subtitle">
            {voiceprintEnrolled ? (
              isImpersonator
                ? `Caller does NOT match registered voiceprint for @${targetUsername || 'peer'}! (Similarity: ${speakerSimilarity}%)`
                : voiceprintStatus === 'VERIFIED_MATCH'
                ? `Voice biometric verified matching @${targetUsername || 'peer'} (${speakerSimilarity}% similarity).`
                : `Voiceprint registered for @${targetUsername || 'peer'}. Monitoring live acoustic identity.`
            ) : (
              `No registered voiceprint found for @${targetUsername || 'caller'}. Enrolling a voiceprint enables biometric anti-impersonation.`
            )}
          </p>
        </div>
      </div>

      {/* Threat Gauge Bar */}
      <div className="threat-gauge-container">
        <div className="threat-gauge-header">
          <span>Spoof Probability Meter {isLocked && '(LOCKED)'}</span>
          <span className="threat-value">{spoofPercent}% Spoof</span>
        </div>
        <div className="threat-gauge-track">
          <div className="zone low">LOW</div>
          <div className="zone med">MEDIUM</div>
          <div className="zone high">HIGH</div>
          <div
            className="threat-gauge-marker"
            style={{ left: `${Math.min(97, Math.max(3, spoofScore * 100))}%` }}
          ></div>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="security-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Spoof Score</span>
          <span className={`metric-val ${isLocked ? (lockedDecision === 'REAL' ? 'low' : 'high') : riskLevel.toLowerCase()}`}>
            {spoofPercent}%
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Bonafide Score</span>
          <span className="metric-val">{bonafidePercent}%</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Policy Action</span>
          <span className={`metric-val action-${action.toLowerCase()}`}>{action}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Inference Latency</span>
          <span className="metric-val">{inferenceTimeMs > 0 ? `${inferenceTimeMs}ms` : '—'}</span>
        </div>
      </div>

      {/* Interactive Controls: Forensic Dossier, Demo Simulation & Active Learning */}
      <div className="demo-eval-section">
        <div className="forensic-trigger-container">
          <button
            type="button"
            className="btn-forensic-trigger"
            onClick={() => setIsDossierOpen(true)}
            id="view-forensic-dossier-btn"
            title="Generate official I4C / 1930 Cybercrime Evidence Dossier with SHA-256 cryptographic waveform proof"
          >
            📋 Generate I4C/1930 Forensic Dossier
          </button>
        </div>

        {/* Live Attack & Keyword Buzzer Simulation */}
        <div className="demo-simulation-row">
          <span className="demo-label">Live Attack Simulation & Buzzer Test:</span>
          <div className="demo-btn-group">
            <button
              type="button"
              className="btn-demo-test btn-buzzer-test"
              onClick={() => {
                if (typeof triggerKeywordAlert === 'function') {
                  triggerKeywordAlert(['OTP', 'URGENT TRANSFER', 'POLICE']);
                }
                if (typeof playBuzzerSound === 'function') {
                  playBuzzerSound();
                }
              }}
              id="test-scam-buzzer-btn"
              title="Test the emergency fraud siren & alert popup (simulates caller asking for OTP)"
            >
              🚨 Test Scam Buzzer (OTP)
            </button>
            <button
              type="button"
              className="btn-demo-test clone"
              onClick={() => runDemoSample('clone')}
              disabled={isDemoRunning}
              id="simulate-clone-btn"
              title="Inject synthetic deepfake voice stream to trigger AASIST neural spoof lock"
            >
              🎭 Simulate AI Clone
            </button>
            <button
              type="button"
              className="btn-demo-test real"
              onClick={() => runDemoSample('real')}
              disabled={isDemoRunning}
              id="simulate-real-btn"
              title="Simulate genuine human bonafide speech stream"
            >
              ✅ Simulate Real Voice
            </button>
          </div>
        </div>

        <div className="active-learning-row">
          <span className="demo-label">Active Learning Feedback:</span>
          <button
            type="button"
            className="btn-demo-test"
            style={{ backgroundColor: '#ff5e57', color: 'white' }}
            onClick={reportFalseNegative}
            disabled={isReporting}
            id="train-brain2-btn"
            title="If an AI voice slipped through, click this to record the last 6 seconds and train Brain 2 immediately."
          >
            {isReporting ? '⏳ Sending to Brain 2...' : '🧠 Mark as Fake AI & Train'}
          </button>
        </div>
      </div>

      {/* Forensic Incident Modal */}
      <ForensicIncidentModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        analyzer={analyzer}
        peerName={targetUsername}
      />
    </div>
  );
}
