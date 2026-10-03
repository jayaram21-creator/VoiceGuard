import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { socket } from '../services/socket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAASISTAnalyzer } from '../hooks/useAASISTAnalyzer';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user } = useAuth();
  const remoteAudioRef = useRef(null);

  const [callState, setCallState] = useState('idle');
  // 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'failed'
  const [currentCall, setCurrentCall] = useState(null);
  // { callId, peer: { id, username, email }, isIncoming: boolean }
  const [errorMessage, setErrorMessage] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  const {
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
    cleanup: cleanupWebRTC,
  } = useWebRTC(remoteAudioRef);

  // Monitor the remote caller audio during a call, or local mic when testing
  const activeAudioStream = remoteStream || localStream;
  // Keep analysis stream clean: do not mix both local mic and remote caller into a single processor
  const secondaryAudioStream = null;
  const activeStreamSource = remoteStream ? 'REMOTE_CALLER' : 'LOCAL_MIC';
  
  // Target identity: When in a call listening to remote audio, verify against the remote peer's identity.
  // When testing local mic, verify against own username.
  const targetUsername = remoteStream 
    ? (currentCall?.peer?.username || null)
    : (user?.username || null);

  const aasistAnalyzer = useAASISTAnalyzer(
    activeAudioStream, 
    callState === 'connected', 
    targetUsername,
    secondaryAudioStream
  );


  // Keep track of currentCall in ref to prevent stale closures in socket events
  const currentCallRef = useRef(null);
  currentCallRef.current = currentCall;

  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  // Active call duration timer
  useEffect(() => {
    let timer = null;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Auto-dismiss terminal call states after 3.5 seconds
  useEffect(() => {
    let timeout = null;
    if (callState === 'ended' || callState === 'rejected' || callState === 'failed') {
      timeout = setTimeout(() => {
        setCallState('idle');
        setCurrentCall(null);
        setErrorMessage(null);
      }, 3500);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [callState]);

  const handleCallFailure = useCallback(
    (reason) => {
      console.warn('[CallContext] Call failure:', reason);
      cleanupWebRTC();
      setErrorMessage(reason || 'Call failed');
      setCallState('failed');
    },
    [cleanupWebRTC]
  );

  // Initiate call to contact
  const initiateCall = useCallback(
    (contact) => {
      if (!contact || !contact.id) return;
      if (callState !== 'idle') return;

      console.log('[CallContext] Initiating call to:', contact);
      setErrorMessage(null);
      setCurrentCall({
        callId: null,
        peer: contact,
        isIncoming: false,
      });
      setCallState('calling');

      socket.emit('call:initiate', { toUserId: contact.id });
    },
    [callState]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!currentCallRef.current) return;
    const { callId, peer } = currentCallRef.current;

    console.log('[CallContext] Accepting call from:', peer);
    setCallState('connecting');

    socket.emit('call:accept', {
      callId,
      toUserId: peer.id,
    });
  }, []);

  // Reject incoming call
  const rejectCall = useCallback((reason = 'Call declined') => {
    if (!currentCallRef.current) return;
    const { callId, peer } = currentCallRef.current;

    console.log('[CallContext] Rejecting call from:', peer);
    socket.emit('call:reject', {
      callId,
      toUserId: peer.id,
      reason,
    });

    cleanupWebRTC();
    setCallState('idle');
    setCurrentCall(null);
  }, [cleanupWebRTC]);

  // Cancel outgoing call
  const cancelCall = useCallback(() => {
    if (!currentCallRef.current) return;
    const { callId, peer } = currentCallRef.current;

    console.log('[CallContext] Cancelling call to:', peer);
    socket.emit('call:cancel', {
      callId,
      toUserId: peer.id,
    });

    cleanupWebRTC();
    setCallState('idle');
    setCurrentCall(null);
  }, [cleanupWebRTC]);

  // End active call
  const endCall = useCallback(() => {
    if (!currentCallRef.current) return;
    const { callId, peer } = currentCallRef.current;

    console.log('[CallContext] Ending call with:', peer);
    socket.emit('call:end', {
      callId,
      toUserId: peer.id,
      reason: 'Call ended',
    });

    cleanupWebRTC();
    setErrorMessage('Call ended');
    setCallState('ended');
  }, [cleanupWebRTC]);

  const dismissCall = useCallback(() => {
    cleanupWebRTC();
    setCallState('idle');
    setCurrentCall(null);
    setErrorMessage(null);
  }, [cleanupWebRTC]);

  // Register all Socket.IO signaling event handlers
  useEffect(() => {
    if (!user) return;

    function handlePresenceInitial({ onlineUserIds: ids }) {
      setOnlineUserIds(new Set(ids.map(Number)));
    }

    function handlePresenceUpdate({ userId, isOnline }) {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(Number(userId));
        } else {
          next.delete(Number(userId));
        }
        return next;
      });
    }

    function handleIncomingCall({ callId, fromUser }) {
      console.log('[CallContext] Received incoming call:', fromUser);
      if (callStateRef.current !== 'idle') {
        socket.emit('call:busy', {
          toUserId: fromUser.id,
          reason: 'User is busy in another call',
        });
        return;
      }

      setCurrentCall({
        callId,
        peer: fromUser,
        isIncoming: true,
      });
      setCallState('ringing');
    }

    function handleCallRinging({ callId }) {
      if (currentCallRef.current) {
        setCurrentCall((prev) => ({ ...prev, callId }));
      }
    }

    async function handleCallAccepted({ callId, byUserId }) {
      console.log('[CallContext] Call accepted by peer:', byUserId);
      setCallState('connecting');

      try {
        await createAndSendOffer(
          byUserId,
          () => {
            console.log('[CallContext] WebRTC connection established (Caller)!');
            setCallState('connected');
          },
          (err) => handleCallFailure(err)
        );
      } catch (err) {
        handleCallFailure(err.message);
      }
    }

    function handleCallRejected({ reason }) {
      console.log('[CallContext] Call rejected:', reason);
      cleanupWebRTC();
      setErrorMessage(reason || 'Call was declined');
      setCallState('rejected');
    }

    function handleCallCancelled() {
      console.log('[CallContext] Call cancelled by caller');
      cleanupWebRTC();
      setErrorMessage('Caller cancelled the call');
      setCallState('ended');
    }

    function handleCallEnded({ reason }) {
      console.log('[CallContext] Call ended by peer:', reason);
      cleanupWebRTC();
      setErrorMessage(reason || 'Call ended by remote user');
      setCallState('ended');
    }

    function handleCallBusy({ reason }) {
      console.log('[CallContext] Call busy:', reason);
      cleanupWebRTC();
      setErrorMessage(reason || 'User is busy');
      setCallState('failed');
    }

    function handleCallFailed({ reason }) {
      console.log('[CallContext] Call failed:', reason);
      cleanupWebRTC();
      setErrorMessage(reason || 'Call failed');
      setCallState('failed');
    }

    async function handleWebRTCOffer({ fromUserId, sdp }) {
      console.log('[CallContext] Received WebRTC offer from:', fromUserId);
      setCallState('connecting');

      try {
        await handleOfferAndSendAnswer(
          fromUserId,
          sdp,
          () => {
            console.log('[CallContext] WebRTC connection established (Callee)!');
            setCallState('connected');
          },
          (err) => handleCallFailure(err)
        );
      } catch (err) {
        handleCallFailure(err.message);
      }
    }

    async function handleWebRTCAnswer({ sdp }) {
      console.log('[CallContext] Received WebRTC answer');
      await handleRemoteAnswer(sdp);
    }

    async function handleWebRTCIceCandidate({ candidate }) {
      await handleRemoteIceCandidate(candidate);
    }

    // Attach listeners
    socket.on('presence:initial', handlePresenceInitial);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ringing', handleCallRinging);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:cancelled', handleCallCancelled);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:busy', handleCallBusy);
    socket.on('call:failed', handleCallFailed);
    socket.on('webrtc:offer', handleWebRTCOffer);
    socket.on('webrtc:answer', handleWebRTCAnswer);
    socket.on('webrtc:ice-candidate', handleWebRTCIceCandidate);

    // Request presence sync
    socket.emit('presence:sync');

    return () => {
      socket.off('presence:initial', handlePresenceInitial);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ringing', handleCallRinging);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:cancelled', handleCallCancelled);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:busy', handleCallBusy);
      socket.off('call:failed', handleCallFailed);
      socket.off('webrtc:offer', handleWebRTCOffer);
      socket.off('webrtc:answer', handleWebRTCAnswer);
      socket.off('webrtc:ice-candidate', handleWebRTCIceCandidate);
    };
  }, [
    user,
    createAndSendOffer,
    handleOfferAndSendAnswer,
    handleRemoteAnswer,
    handleRemoteIceCandidate,
    cleanupWebRTC,
    handleCallFailure,
  ]);

  return (
    <CallContext.Provider
      value={{
        callState,
        currentCall,
        errorMessage,
        callDuration,
        onlineUserIds,
        isMuted,
        localVolume,
        remoteVolume,
        connectionStatus,
        aasistAnalyzer,
        activeStreamSource,
        initiateCall,
        acceptCall,
        rejectCall,
        cancelCall,
        endCall,
        toggleMute,
        dismissCall,
      }}
    >

      {children}
      {/* Remote audio playback element with autoplay */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return ctx;
}
