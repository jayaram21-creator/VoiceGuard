
import { useCallback, useRef, useState } from 'react';
import { socket } from '../services/socket';

const RTC_CONFIG = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

export function useWebRTC(remoteAudioRef) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const audioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const volumeIntervalRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);


  // Start audio volume analysis using Web Audio API
  const setupAudioAnalysis = useCallback((localStream, remoteStream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }

      if (localStream) {
        const localSource = ctx.createMediaStreamSource(localStream);
        const localAnalyser = ctx.createAnalyser();
        localAnalyser.fftSize = 256;
        localSource.connect(localAnalyser);
        localAnalyserRef.current = localAnalyser;
      }

      if (remoteStream) {
        const remoteSource = ctx.createMediaStreamSource(remoteStream);
        const remoteAnalyser = ctx.createAnalyser();
        remoteAnalyser.fftSize = 256;
        remoteSource.connect(remoteAnalyser);
        remoteAnalyserRef.current = remoteAnalyser;
      }

      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }

      const localData = new Uint8Array(128);
      const remoteData = new Uint8Array(128);

      volumeIntervalRef.current = setInterval(() => {
        // Local volume calculation
        if (localAnalyserRef.current && localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack && audioTrack.enabled) {
            localAnalyserRef.current.getByteFrequencyData(localData);
            let sum = 0;
            for (let i = 0; i < localData.length; i++) {
              sum += localData[i];
            }
            const avg = sum / localData.length;
            setLocalVolume(Math.min(100, Math.round((avg / 128) * 100)));
          } else {
            setLocalVolume(0);
          }
        } else {
          setLocalVolume(0);
        }

        // Remote volume calculation
        if (remoteAnalyserRef.current) {
          remoteAnalyserRef.current.getByteFrequencyData(remoteData);
          let sum = 0;
          for (let i = 0; i < remoteData.length; i++) {
            sum += remoteData[i];
          }
          const avg = sum / remoteData.length;
          setRemoteVolume(Math.min(100, Math.round((avg / 128) * 100)));
        } else {
          setRemoteVolume(0);
        }
      }, 60);
    } catch (err) {
      console.warn('[useWebRTC] Web Audio analysis not available:', err);
    }
  }, []);

  // Acquire microphone media stream
  const getMicrophoneStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      console.log('[useWebRTC] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      return stream;

    } catch (err) {
      console.error('[useWebRTC] Failed to get microphone stream:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access to make calls.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device found on your system.');
      } else {
        throw new Error(`Microphone access error: ${err.message}`);
      }
    }
  }, []);

  // Cleanup all WebRTC and media resources
  const cleanup = useCallback(() => {
    console.log('[useWebRTC] Cleaning up WebRTC resources...');

    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[useWebRTC] Local track stopped');
      });
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
      console.log('[useWebRTC] RTCPeerConnection closed');
    }

    if (remoteAudioRef && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    iceCandidatesQueueRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setLocalVolume(0);
    setRemoteVolume(0);
    setConnectionStatus('idle');
  }, [remoteAudioRef]);

  // Create or initialize RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId, onConnectedCallback, onFailedCallback) => {
      if (pcRef.current) {
        cleanup();
      }

      console.log(`[useWebRTC] Creating RTCPeerConnection with STUN for user ${targetUserId}`);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      setConnectionStatus('connecting');

      // Relay ICE candidates to peer over Socket.IO
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[useWebRTC] Sending ICE candidate to peer');
          socket.emit('webrtc:ice-candidate', {
            toUserId: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle incoming remote audio track
      pc.ontrack = (event) => {
        console.log('[useWebRTC] Received remote audio track', event.streams[0]);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        setRemoteStream(remoteStream);
        if (remoteAudioRef && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch((playErr) => {
            console.warn('[useWebRTC] Remote audio autoplay blocked:', playErr);
          });
        }
        setupAudioAnalysis(localStreamRef.current, remoteStream);
      };


      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log(`[useWebRTC] Connection state: ${pc.connectionState}`);
        setConnectionStatus(pc.connectionState);
        if (pc.connectionState === 'connected') {
          if (onConnectedCallback) onConnectedCallback();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (onFailedCallback) onFailedCallback('WebRTC connection failed');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[useWebRTC] ICE state: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
          if (onFailedCallback) onFailedCallback('ICE negotiation failed');
        }
      };

      return pc;
    },
    [cleanup, remoteAudioRef, setupAudioAnalysis]
  );

  // Caller: Create offer and send to callee
  const createAndSendOffer = useCallback(
    async (targetUserId, onConnectedCallback, onFailedCallback) => {
      try {
        const stream = await getMicrophoneStream();
        const pc = createPeerConnection(targetUserId, onConnectedCallback, onFailedCallback);

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        setupAudioAnalysis(stream, null);

        console.log('[useWebRTC] Creating SDP offer...');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });

        await pc.setLocalDescription(offer);
        console.log('[useWebRTC] Set local description (offer), sending over Socket.IO...');

        socket.emit('webrtc:offer', {
          toUserId: targetUserId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error('[useWebRTC] createAndSendOffer error:', err);
        cleanup();
        throw err;
      }
    },
    [getMicrophoneStream, createPeerConnection, setupAudioAnalysis, cleanup]
  );

  // Callee: Receive offer, create answer, and send back
  const handleOfferAndSendAnswer = useCallback(
    async (fromUserId, sdp, onConnectedCallback, onFailedCallback) => {
      try {
        const stream = await getMicrophoneStream();
        const pc = createPeerConnection(fromUserId, onConnectedCallback, onFailedCallback);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        setupAudioAnalysis(stream, null);

        console.log('[useWebRTC] Setting remote description (offer)...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush any buffered ICE candidates
        if (iceCandidatesQueueRef.current.length > 0) {
          console.log(`[useWebRTC] Flushing ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
          for (const candidate of iceCandidatesQueueRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.warn(e));
          }
          iceCandidatesQueueRef.current = [];
        }

        console.log('[useWebRTC] Creating SDP answer...');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('[useWebRTC] Set local description (answer), sending back...');
        socket.emit('webrtc:answer', {
          toUserId: fromUserId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error('[useWebRTC] handleOfferAndSendAnswer error:', err);
        cleanup();
        throw err;
      }
    },
    [getMicrophoneStream, createPeerConnection, setupAudioAnalysis, cleanup]
  );

  // Caller: Handle received SDP answer
  const handleRemoteAnswer = useCallback(async (sdp) => {
    const pc = pcRef.current;
    if (!pc) {
      console.warn('[useWebRTC] Received answer but no RTCPeerConnection exists');
      return;
    }

    try {
      console.log('[useWebRTC] Setting remote description (answer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush queued candidates
      if (iceCandidatesQueueRef.current.length > 0) {
        console.log(`[useWebRTC] Flushing ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
        for (const candidate of iceCandidatesQueueRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.warn(e));
        }
        iceCandidatesQueueRef.current = [];
      }
    } catch (err) {
      console.error('[useWebRTC] handleRemoteAnswer error:', err);
    }
  }, []);

  // Add received ICE candidate from peer
  const handleRemoteIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      console.log('[useWebRTC] Buffering ICE candidate (remote description not ready)');
      iceCandidatesQueueRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[useWebRTC] Error adding ICE candidate:', err);
    }
  }, []);

  // Mute / Unmute local microphone
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return false;

    const tracks = localStreamRef.current.getAudioTracks();
    if (tracks.length > 0) {
      const newEnabled = !tracks[0].enabled;
      tracks.forEach((track) => {
        track.enabled = newEnabled;
      });
      const newMuted = !newEnabled;
      setIsMuted(newMuted);
      console.log(`[useWebRTC] Microphone ${newMuted ? 'muted' : 'unmuted'}`);
      return newMuted;
    }
    return false;
  }, []);

  return {
    connectionStatus,
    isMuted,
    localVolume,
    remoteVolume,
    localStream,
    remoteStream,
    createAndSendOffer,
    handleOfferAndSendAnswer,
    handleRemoteAnswer,
    handleRemoteIceCandidate,
    toggleMute,
    cleanup,
    getMicrophoneStream,
  };
}

