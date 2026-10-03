import React, { useState, useRef } from 'react';
import { loginUser } from '../services/api';
import './VoiceprintRegistration.css';

const AI_SERVICE_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000';

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitWav(float32Array, sampleRate) {
  const buffer = new ArrayBuffer(44 + float32Array.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + float32Array.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, float32Array.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function VoiceprintRegistration({ user, onComplete }) {
  const [password, setPassword] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, recording, registering, success, error
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    if (!password.trim()) {
      setErrorMsg('Please enter your account password to confirm your identity.');
      return;
    }

    try {
      // Verify password by attempting to login against the Node backend
      await loginUser({ email: user.email, password });
    } catch (err) {
      setErrorMsg('Incorrect password. Identity verification failed.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      // Create processor (buffer size 4096, 1 input channel, 1 output channel)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      const recordedSamples = [];

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        recordedSamples.push(new Float32Array(channelData));
      };

      // Connect nodes
      source.connect(processor);

      // Must connect to destination for onaudioprocess to fire, but we mute it
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      setIsRecording(true);
      setStatus('recording');
      setErrorMsg('');

      // Stop after 10 seconds
      setTimeout(() => {
        processor.disconnect();
        source.disconnect();
        silentGain.disconnect();
        stream.getTracks().forEach(t => t.stop());

        // Flatten
        const totalLen = recordedSamples.reduce((acc, arr) => acc + arr.length, 0);
        const flatArray = new Float32Array(totalLen);
        let offset = 0;
        for (let arr of recordedSamples) {
          flatArray.set(arr, offset);
          offset += arr.length;
        }

        // Convert to WAV
        const wavBlob = floatTo16BitWav(flatArray, 16000);
        registerVoiceprint(wavBlob);
      }, 10000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setErrorMsg('Microphone access denied or unavailable.');
    }
  };

  const registerVoiceprint = async (audioBlob) => {
    setStatus('registering');
    const formData = new FormData();
    formData.append('file', audioBlob, 'voiceprint.wav');

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/verify/register?username=${encodeURIComponent(user.username.trim())}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      setStatus('success');
      setTimeout(() => {
        if (onComplete) onComplete(user.username.trim());
      }, 2000);

    } catch (err) {
      console.error('Registration failed:', err);
      setStatus('error');
      setErrorMsg('Failed to register voiceprint. Please try again.');
    }
  };

  return (
    <div className="voiceprint-registration">
      <h2>Biometric Voiceprint Registration</h2>
      <p>Register your unique voice signature so we can verify your identity on calls.</p>

      <div className="registration-form">
        <div className="user-locked-badge">Registering Voiceprint for: <strong>{user?.username}</strong></div>
        <input
          type="password"
          placeholder="Confirm your password to begin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isRecording || status === 'registering' || status === 'success'}
          style={{ marginTop: '10px' }}
        />

        {status === 'idle' || status === 'error' ? (
          <button onClick={startRecording} className="record-btn">
            🎤 Start Registration (10s)
          </button>
        ) : status === 'recording' ? (
          <div className="recording-status">
            <span className="pulse-dot"></span>
            Recording... Please read the sentence below:
            <blockquote className="reading-prompt">
              "I am registering my biometric voiceprint to secure my identity against AI cloning attacks."
            </blockquote>
          </div>
        ) : status === 'registering' ? (
          <div className="registering-status">
            Extracting Neural Embedding...
          </div>
        ) : status === 'success' ? (
          <div className="success-status">
            ✅ Voiceprint Registered Successfully!
          </div>
        ) : null}

        {errorMsg && <div className="error-message">{errorMsg}</div>}
      </div>
    </div>
  );
}
