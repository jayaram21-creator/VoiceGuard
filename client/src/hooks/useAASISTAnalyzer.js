import { useCallback, useEffect, useRef, useState } from 'react';

const AI_SERVICE_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000';

// Target speech duration (in seconds) to observe before locking the decision
const LOCK_THRESHOLD_SECONDS = 2.5;
// Minimum concordant voiced chunks needed to lock
const MIN_VOICED_CHUNKS_TO_LOCK = 2;

export function playBuzzerSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();

    const triggerTones = () => {
      try {
        const now = audioCtx.currentTime;
        // 4 loud distinct urgent alarm siren beeps (880Hz -> 1400Hz sweep)
        [0, 0.18, 0.36, 0.54].forEach((offset) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, now + offset);
          osc.frequency.exponentialRampToValueAtTime(1400, now + offset + 0.08);

          gain.gain.setValueAtTime(0.8, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + 0.17);
        });

        setTimeout(() => {
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => { });
        }, 1500);
      } catch (err) {
        console.warn('Error during tone generation:', err);
      }
    };

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(triggerTones).catch(() => triggerTones());
    } else {
      triggerTones();
    }
  } catch (e) {
    console.warn('AudioContext buzzer error:', e);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes Float32Array PCM samples (at 16kHz) to standard 16-bit Mono WAV Blob.
 */
function floatTo16BitWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio data
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Custom hook for live AASIST voice cloning and synthetic speech detection.
 * Taps audio non-intrusively from the active WebRTC voice stream.
 * Includes Voice Activity Detection (VAD) and a multi-second observation lock-in
 * mechanism that firmly locks the verdict once sufficient speech is heard.
 */
export function useAASISTAnalyzer(activeStream, isConnected, username = null, secondaryStream = null) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [spoofScore, setSpoofScore] = useState(0.0);
  const [bonafideScore, setBonafideScore] = useState(1.0);
  const [riskLevel, setRiskLevel] = useState('LOW'); // 'LOW' | 'MEDIUM' | 'HIGH'
  const [verdict, setVerdict] = useState('INITIALIZING');
  const [action, setAction] = useState('MONITOR');
  const [inferenceTimeMs, setInferenceTimeMs] = useState(0);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState(null);
  const [isReporting, setIsReporting] = useState(false);

  // --- Stabilization & Locking State ---
  const [isLocked, setIsLocked] = useState(false);
  const [lockedDecision, setLockedDecision] = useState(null); // 'REAL' | 'CLONED'
  const [listeningProgress, setListeningProgress] = useState(0); // 0 to 100%
  const [voicedSeconds, setVoicedSeconds] = useState(0.0);
  const [speechDetected, setSpeechDetected] = useState(false);
  const [detectedKeywords, setDetectedKeywords] = useState([]);
  const [showFraudAlert, setShowFraudAlert] = useState(false);

  // --- Biometric Voiceprint Verification State ---
  const [voiceprintEnrolled, setVoiceprintEnrolled] = useState(false);
  const [voiceprintStatus, setVoiceprintStatus] = useState('NOT_ENROLLED'); // 'NOT_ENROLLED' | 'VERIFIED_MATCH' | 'MISMATCH' | 'ENROLLED'
  const [speakerSimilarity, setSpeakerSimilarity] = useState(0.0);
  const [isImpersonator, setIsImpersonator] = useState(false);

  // Check voiceprint enrollment status whenever username changes
  useEffect(() => {
    if (!username || username === 'undefined' || username === 'null') {
      setVoiceprintEnrolled(false);
      setVoiceprintStatus('NOT_ENROLLED');
      return;
    }
    let isCancelled = false;
    fetch(`${AI_SERVICE_URL}/api/voiceprint/status/${encodeURIComponent(username.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data) {
          setVoiceprintEnrolled(Boolean(data.is_enrolled));
          setVoiceprintStatus(data.is_enrolled ? 'ENROLLED' : 'NOT_ENROLLED');
        }
      })
      .catch((err) => console.warn('[useAASISTAnalyzer] Voiceprint status check failed:', err));

    return () => {
      isCancelled = true;
    };
  }, [username]);

  const usernameRef = useRef(username);
  usernameRef.current = username;

  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioBufferRef = useRef([]); // Accumulates raw samples
  const analysisIntervalRef = useRef(null);
  const sendBufferRef = useRef(null);

  // Accumulator references across chunk calls
  const isAnalyzingRef = useRef(false);
  const isLockedRef = useRef(false);
  isLockedRef.current = isLocked;

  const lockedDecisionRef = useRef(null);
  lockedDecisionRef.current = lockedDecision;

  const voicedDurationAccumRef = useRef(0.0);
  const accumulatedScoresRef = useRef([]);
  const smoothedScoreRef = useRef(0.0);
  const consecutiveErrorsRef = useRef(0);
  const lastKeywordCheckRef = useRef(0);

  // Unlock and re-scan function to allow manual re-evaluation
  const unlockAndRescan = useCallback(() => {
    isLockedRef.current = false;
    voicedDurationAccumRef.current = 0.0;
    accumulatedScoresRef.current = [];
    smoothedScoreRef.current = 0.0;
    lockedDecisionRef.current = null;
    consecutiveErrorsRef.current = 0;

    setDetectedKeywords([]);
    setShowFraudAlert(false);
    setIsLocked(false);
    setLockedDecision(null);
    setIsImpersonator(false);
    setVoiceprintStatus((prev) => (prev === 'MISMATCH' ? 'ENROLLED' : prev));
    setIsUnavailable(false);
    setListeningProgress(0);
    setVoicedSeconds(0.0);
    setVerdict('LISTENING & ANALYZING...');
    setRiskLevel('LOW');
    setAction('MONITOR');
    setSpoofScore(0.0);
    setBonafideScore(1.0);
  }, []);

  const triggerKeywordAlert = useCallback((customKeywords = ['OTP', 'URGENT TRANSFER', 'DIGITAL ARREST']) => {
    setDetectedKeywords((prev) => Array.from(new Set([...prev, ...customKeywords])));
    setShowFraudAlert(true);
    playBuzzerSound();
  }, []);

  const dismissFraudAlert = useCallback(() => {
    setShowFraudAlert(false);
  }, []);

  const checkKeywordsAsync = useCallback(async (blob) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'chunk.wav');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${AI_SERVICE_URL}/api/analyze/keywords`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.is_fraudulent && data.detected_keywords && data.detected_keywords.length > 0) {
          setDetectedKeywords((prev) => {
            const combined = Array.from(new Set([...prev, ...data.detected_keywords]));
            return combined;
          });
          setShowFraudAlert(true);
          playBuzzerSound();
        }
      }
    } catch (err) {
      // Background check failure is non-fatal
    }
  }, []);

  const sendBufferForAnalysis = useCallback(async () => {
    // Require at least 1.4 seconds of audio (22,400 samples) for responsive streaming
    if (audioBufferRef.current.length < 16000 * 1.4) {
      return;
    }

    // Prevent overlapping network requests
    if (isAnalyzingRef.current) {
      return;
    }

    try {
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      // Grab up to 4 seconds (~64600 samples)
      const samplesToAnalyze = audioBufferRef.current.slice(-64600);

      // Client-side quick RMS check to avoid sending pure zero silence
      let sumSquares = 0;
      for (let i = 0; i < samplesToAnalyze.length; i++) {
        sumSquares += samplesToAnalyze[i] * samplesToAnalyze[i];
      }
      const clientRms = Math.sqrt(sumSquares / samplesToAnalyze.length);

      console.log(`[useAASISTAnalyzer] Sliced buffer: ${samplesToAnalyze.length} samples @ 16kHz, clientRMS: ${clientRms.toFixed(5)}`);

      if (clientRms < 0.0001) {
        // Audio is silent background; do not fluctuate scores
        if (!isLockedRef.current) {
          setSpeechDetected(false);
        }
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        return;
      }

      const wavBlob = floatTo16BitWav(samplesToAnalyze, 16000);

      // --- CONTINUOUS PARALLEL KEYWORD & EXTORTION MONITORING (THROTTLED) ---
      const nowMs = Date.now();
      if (clientRms >= 0.001 && (!lastKeywordCheckRef.current || nowMs - lastKeywordCheckRef.current >= 3500)) {
        lastKeywordCheckRef.current = nowMs;
        checkKeywordsAsync(wavBlob);
      }

      // If locked as REAL, bypass running heavy PyTorch AASIST model to save CPU
      if (isLockedRef.current && lockedDecisionRef.current !== 'CLONED') {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        return;
      }

      // --- NORMAL AASIST CLONE DETECTION PHASE ---
      setSpeechDetected(true);

      const formData = new FormData();
      formData.append('file', wavBlob, 'chunk.wav');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const currentTargetUser = usernameRef.current;
      const endpoint = currentTargetUser
        ? `${AI_SERVICE_URL}/api/analyze/chunk?username=${encodeURIComponent(currentTargetUser)}`
        : `${AI_SERVICE_URL}/api/analyze/chunk`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI Service returned ${response.status}`);
      }

      const data = await response.json();
      consecutiveErrorsRef.current = 0;
      setIsUnavailable(false);
      setInferenceTimeMs(data.inference_time_ms);
      setLastAnalyzedTime(new Date().toLocaleTimeString());

      // Update Biometric Voiceprint Verification metrics
      if (data.voiceprint_enrolled !== undefined) {
        setVoiceprintEnrolled(Boolean(data.voiceprint_enrolled));
        setVoiceprintStatus(data.voiceprint_status || (data.voiceprint_enrolled ? 'ENROLLED' : 'NOT_ENROLLED'));
      }
      if (data.speaker_verification_percentage !== undefined) {
        setSpeakerSimilarity(data.speaker_verification_percentage);
      }
      if (data.is_impersonator !== undefined) {
        setIsImpersonator(Boolean(data.is_impersonator));
      }

      // If server VAD flagged silence or ambient room noise, do not accumulate or fluctuate
      if (data.speech_detected === false) {
        setSpeechDetected(false);
        return;
      }

      // Valid voiced speech detected!
      setSpeechDetected(true);
      const chunkSpoof = data.spoof_score;
      const chunkVoicedSec = data.voiced_seconds || (data.duration_seconds ? data.duration_seconds * 0.7 : 1.5);

      // Accumulate voiced speech
      voicedDurationAccumRef.current += chunkVoicedSec;
      accumulatedScoresRef.current.push(chunkSpoof);

      // Smooth score with exponential moving average (alpha = 0.40)
      const prevSmoothed = smoothedScoreRef.current || chunkSpoof;
      const newSmoothed = 0.40 * chunkSpoof + 0.60 * prevSmoothed;
      smoothedScoreRef.current = newSmoothed;

      const currentVoiced = Math.min(LOCK_THRESHOLD_SECONDS, voicedDurationAccumRef.current);
      setVoicedSeconds(parseFloat(currentVoiced.toFixed(1)));

      const progress = Math.min(100, Math.round((currentVoiced / LOCK_THRESHOLD_SECONDS) * 100));
      setListeningProgress(progress);

      // Check if observation threshold (2.5s of speech) is satisfied to LOCK decision
      const hasEnoughSpeech = voicedDurationAccumRef.current >= LOCK_THRESHOLD_SECONDS;
      const hasEnoughChunks = accumulatedScoresRef.current.length >= MIN_VOICED_CHUNKS_TO_LOCK;

      if (data.is_impersonator || hasEnoughSpeech || (hasEnoughChunks && (newSmoothed > 0.70 || newSmoothed < 0.20))) {
        // Compute average over collected voiced samples for final locked decision
        const total = accumulatedScoresRef.current.reduce((a, b) => a + b, 0);
        const avgSpoof = total / accumulatedScoresRef.current.length;

        // Balanced composite score (weighted smoothed dynamic score + observation window average)
        const finalScore = 0.60 * newSmoothed + 0.40 * avgSpoof;

        isLockedRef.current = true;
        setIsLocked(true);
        setListeningProgress(100);

        if (data.is_impersonator) {
          // Locked as IMPERSONATOR
          setLockedDecision('IMPERSONATOR');
          setRiskLevel('CRITICAL');
          setVerdict('BIOMETRIC IDENTITY MISMATCH');
          setAction('BLOCK');
          setSpoofScore(finalScore);
          setBonafideScore(1.0 - finalScore);
        } else if (finalScore >= 0.50) {
          // Locked as CLONED / SPOOFED
          setLockedDecision('CLONED');
          setRiskLevel('HIGH');
          setVerdict('CLONED / AI VOICE DETECTED (LOCKED)');
          setAction('BLOCK');
          setSpoofScore(finalScore);
          setBonafideScore(1.0 - finalScore);
        } else {
          // Locked as GENUINE HUMAN VOICE
          setLockedDecision('REAL');
          setRiskLevel('LOW');
          setVerdict('VERIFIED GENUINE VOICE (LOCKED)');
          setAction('ALLOW');
          setSpoofScore(finalScore);
          setBonafideScore(1.0 - finalScore);
        }

        setAnalysisHistory((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            spoofScore: finalScore,
            riskLevel: finalScore >= 0.50 ? 'HIGH' : 'LOW',
            verdict: `🔒 [DECISION LOCKED] ${finalScore >= 0.50 ? 'CLONED VOICE' : 'GENUINE VOICE'}`,
          },
          ...prev.slice(0, 7),
        ]);
      } else {
        // Still accumulating evidence in LISTENING phase
        setSpoofScore(newSmoothed);
        setBonafideScore(1.0 - newSmoothed);
        setVerdict(`LISTENING & VERIFYING (${currentVoiced.toFixed(1)}s / ${LOCK_THRESHOLD_SECONDS}s)...`);
        setRiskLevel(newSmoothed >= 0.50 ? 'MEDIUM' : 'LOW');
        setAction('MONITOR');
      }
    } catch (err) {
      console.warn('[useAASISTAnalyzer] Analysis skipped or service transient error:', err.message);
      consecutiveErrorsRef.current = (consecutiveErrorsRef.current || 0) + 1;
      if (consecutiveErrorsRef.current >= 3) {
        setIsUnavailable(true);
      }
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      // Keep trailing 1.5s for hop overlap
      audioBufferRef.current = audioBufferRef.current.slice(-24000);
    }
  }, [checkKeywordsAsync]);

  sendBufferRef.current = sendBufferForAnalysis;

  // Single-fire reset when call transitions to connected
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      console.log('[useAASISTAnalyzer] Call connected -> initializing fresh analysis state');
      unlockAndRescan();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, unlockAndRescan]);

  // Hook into Web Audio API non-intrusively
  useEffect(() => {
    if (!isConnected || !activeStream) {
      // Cleanup when not in an active connected call
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
      audioBufferRef.current = [];
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      // Initialize with native hardware sample rate (e.g. 48kHz or 44.1kHz).
      // Crucial: Forcing custom sampleRate on remote WebRTC MediaStream causes silence (zero samples) in Chromium!
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Ensure AudioContext is actively running (not suspended by autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };

      const inRate = ctx.sampleRate || 48000;
      const targetRate = 16000;
      const downsampleRatio = inRate / targetRate;

      // 4096 samples buffer
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Resample dynamically from native inRate (e.g. 48000) to target 16000Hz
        if (Math.abs(downsampleRatio - 1.0) < 0.05) {
          for (let i = 0; i < inputData.length; i++) {
            audioBufferRef.current.push(inputData[i]);
          }
        } else {
          // Anti-aliasing boxcar averaging downsampling
          const step = downsampleRatio;
          const outCount = Math.floor(inputData.length / step);
          for (let i = 0; i < outCount; i++) {
            const startIdx = Math.floor(i * step);
            const endIdx = Math.min(inputData.length, Math.floor((i + 1) * step));
            let sum = 0;
            for (let j = startIdx; j < endIdx; j++) {
              sum += inputData[j];
            }
            audioBufferRef.current.push(sum / Math.max(1, endIdx - startIdx));
          }
        }

        // Limit max buffer to 6 seconds @ 16kHz
        if (audioBufferRef.current.length > 16000 * 6) {
          audioBufferRef.current = audioBufferRef.current.slice(-16000 * 6);
        }
      };

      // Connect primary stream (activeStream)
      const primarySource = ctx.createMediaStreamSource(activeStream);
      primarySource.connect(processor);

      // Connect secondary stream if available (e.g. local mic while remote is connected)
      let secondarySource = null;
      if (secondaryStream && secondaryStream !== activeStream) {
        try {
          secondarySource = ctx.createMediaStreamSource(secondaryStream);
          secondarySource.connect(processor);
        } catch (e) {
          console.warn('[useAASISTAnalyzer] Secondary stream connect skipped:', e);
        }
      }

      // Connect to destination via silent gain to ensure audio pipeline stays active in browser
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      console.log(`[useAASISTAnalyzer] Web Audio attached: inRate=${inRate}Hz -> target=16000Hz. ActiveStream tracks:`, activeStream.getAudioTracks().length);

      // Trigger rolling analysis every 1.5 seconds for responsive 2.5s detection
      analysisIntervalRef.current = setInterval(() => {
        if (sendBufferRef.current) {
          sendBufferRef.current();
        }
      }, 1500);

      // Initial analysis after 1.4 seconds of speech collection
      const initialTimer = setTimeout(() => {
        if (sendBufferRef.current) {
          sendBufferRef.current();
        }
      }, 1400);

      return () => {
        clearTimeout(initialTimer);
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current);
          analysisIntervalRef.current = null;
        }
        processor.disconnect();
        try { primarySource.disconnect(); } catch (e) {}
        if (secondarySource) {
          try { secondarySource.disconnect(); } catch (e) {}
        }
      };
    } catch (err) {
      console.warn('[useAASISTAnalyzer] Failed to setup Web Audio listener:', err);
      setIsUnavailable(true);
    }
  }, [isConnected, activeStream, secondaryStream]);

  // Native Client-Side SpeechRecognition for instant zero-latency keyword catching
  useEffect(() => {
    if (!isConnected) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition = null;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      const CLIENT_FRAUD_KEYWORDS = [
        'otp', 'one time password', 'password', 'urgent', 'emergency',
        'transfer', 'money', 'upi', 'bank', 'police', 'arrest', 'digital arrest',
        'cbi', 'card', 'cvv', 'pin', 'code', 'account', 'verify', 'verification',
        'customs', 'parcel', 'court', 'warrant', 'kyc', 'aadhaar', 'pan card'
      ];

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          const matched = CLIENT_FRAUD_KEYWORDS.filter((kw) => transcript.includes(kw));
          if (matched.length > 0) {
            setDetectedKeywords((prev) => Array.from(new Set([...prev, ...matched])));
            setShowFraudAlert(true);
            playBuzzerSound();
          }
        }
      };

      recognition.onerror = () => { };
      recognition.onend = () => {
        if (isConnected && recognition) {
          try { recognition.start(); } catch (e) { }
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('[useAASISTAnalyzer] Native SpeechRecognition bypassed:', e);
    }

    return () => {
      if (recognition) {
        recognition.onend = null;
        try { recognition.stop(); } catch (e) { }
      }
    };
  }, [isConnected]);

  // Demo evaluation sample trigger with instant locking
  const runDemoSample = useCallback(async (sampleType = 'clone') => {
    try {
      setIsDemoRunning(true);
      setIsAnalyzing(true);
      const res = await fetch(`${AI_SERVICE_URL}/api/analyze/sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_type: sampleType }),
      });

      if (!res.ok) throw new Error('Sample evaluation failed');

      const data = await res.json();
      setIsUnavailable(false);

      // Lock directly on sample verdict
      isLockedRef.current = true;
      setIsLocked(true);
      setListeningProgress(100);
      setVoicedSeconds(LOCK_THRESHOLD_SECONDS);

      const isFake = data.sample_type === 'CLONED_VOICE' || data.spoof_score >= 0.65;
      const finalScore = data.spoof_score;

      setSpoofScore(finalScore);
      setBonafideScore(1.0 - finalScore);
      setInferenceTimeMs(data.inference_time_ms);
      setLastAnalyzedTime(new Date().toLocaleTimeString());

      // NEW: Neural Speaker Verification Check
      if (data.is_impersonator) {
        setLockedDecision('CLONED');
        setRiskLevel('CRITICAL');
        setVerdict('IDENTITY MISMATCH (Impersonator)');
        setAction('BLOCK');
        setDetectedKeywords(['IMPERSONATOR', 'UNAUTHORIZED ACCESS', 'OTP']);
        setShowFraudAlert(true);
        playBuzzerSound();
      } else if (isFake) {
        setLockedDecision('CLONED');
        setRiskLevel('HIGH');
        setVerdict('CLONED / AI VOICE DETECTED (LOCKED)');
        setAction('BLOCK');
        setDetectedKeywords(['OTP', 'URGENT TRANSFER', 'DIGITAL ARREST']);
        setShowFraudAlert(true);
        playBuzzerSound();
      } else {
        setLockedDecision('REAL');
        setRiskLevel('LOW');
        setVerdict('VERIFIED GENUINE VOICE (LOCKED)');
        setAction('ALLOW');
        setShowFraudAlert(false);
      }

      setAnalysisHistory((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          spoofScore: finalScore,
          riskLevel: isFake ? 'HIGH' : 'LOW',
          verdict: `🔒 [DEMO LOCKED: ${data.sample_type}] ${isFake ? 'CLONED' : 'REAL'}`,
        },
        ...prev.slice(0, 7),
      ]);
    } catch (err) {
      console.error('[useAASISTAnalyzer] Demo test error:', err);
      setIsUnavailable(true);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsDemoRunning(false);
    }
  }, []);

  const reportFalseNegative = useCallback(async () => {
    if (audioBufferRef.current.length < 16000) {
      alert("Not enough audio captured yet. Please speak or play the AI voice for a few seconds before reporting.");
      return;
    }
    try {
      setIsReporting(true);
      const samplesToReport = audioBufferRef.current.slice(-16000 * 6); // Up to 6 seconds
      const wavBlob = floatTo16BitWav(samplesToReport, 16000);
      const formData = new FormData();
      formData.append('file', wavBlob, 'report.wav');

      const res = await fetch(`${AI_SERVICE_URL}/api/train/report_sample`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        alert("AI Voice successfully reported and sent to Brain 2 for training! It is learning its pattern right now.");
      } else {
        alert("Failed to report the sample.");
      }
    } catch (err) {
      console.error("[useAASISTAnalyzer] Error reporting false negative", err);
      alert("Error connecting to AI service for reporting.");
    } finally {
      setIsReporting(false);
    }
  }, []);

  return {
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
    lockThresholdSeconds: LOCK_THRESHOLD_SECONDS,
    speechDetected,
    unlockAndRescan,
    detectedKeywords,
    showFraudAlert,
    triggerKeywordAlert,
    dismissFraudAlert,
    playBuzzerSound,
    // Biometric Voiceprint Verification
    voiceprintEnrolled,
    voiceprintStatus,
    speakerSimilarity,
    isImpersonator,
    targetUsername: username,
    reportFalseNegative,
    isReporting,
  };
}
