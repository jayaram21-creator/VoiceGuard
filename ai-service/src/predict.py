import sys
from pathlib import Path

import miniaudio
import numpy as np
import scipy.signal as signal
import torch

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.append(str(CURRENT_DIR))

from aasist import Model
from config import AASIST_CONFIG


# ============================================================
# AASIST SETTINGS
# ============================================================

DEVICE = torch.device("cpu")

SAMPLE_RATE = 16000
AASIST_INPUT_LENGTH = 64600

# Number of overlapping windows for real-time analysis
WINDOW_SECONDS = 4.0
WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_SECONDS)

HOP_SECONDS = 2.0
HOP_SAMPLES = int(SAMPLE_RATE * HOP_SECONDS)


# ============================================================
# LOAD MODEL
# ============================================================

def load_detector(weights_path="models/AASIST.pth"):
        
    model = Model(AASIST_CONFIG)

    checkpoint = torch.load(
        weights_path,
        map_location=DEVICE
    )

    # Your checkpoint is a direct state_dict.
    # This also supports checkpoints wrapped inside "state_dict".
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        checkpoint = checkpoint["state_dict"]

    model.load_state_dict(
        checkpoint,
        strict=True
    )

    model.to(DEVICE)
    model.eval()

    return model


# ============================================================
# AUDIO DECODING
# ============================================================

def decode_audio(file_path):

    decoded = miniaudio.decode_file(
        file_path,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=1,
        sample_rate=SAMPLE_RATE
    )

    audio = np.asarray(
        decoded.samples,
        dtype=np.float32
    )

    audio = audio.reshape(-1)

    # Protect model from invalid numbers
    audio = np.nan_to_num(
        audio,
        nan=0.0,
        posinf=0.0,
        neginf=0.0
    )

    return audio


# ============================================================
# AASIST PREPROCESSING
# ============================================================

def prepare_aasist_input(audio, target_rms=0.060):

    audio = np.asarray(
        audio,
        dtype=np.float32
    ).reshape(-1)

    # Standardize nominal RMS energy: ensure quiet laptop and phone microphones
    # match the nominal energy expected by AASIST neural filterbanks.
    current_rms = float(np.sqrt(np.mean(audio ** 2) + 1e-9))
    if current_rms > 0.001:
        audio = np.clip(audio * (target_rms / current_rms), -1.0, 1.0)

    # For chunks shorter than AASIST window (64,600 samples ~ 4.04s):
    # Seamlessly tile active audio into the window with micro-faded boundaries to avoid click artifacts.
    if len(audio) < AASIST_INPUT_LENGTH and len(audio) > 0:
        if len(audio) > 64:
            fade_len = min(32, len(audio) // 8)
            fade = np.linspace(0.0, 1.0, fade_len)
            audio[:fade_len] *= fade
            audio[-fade_len:] *= fade[::-1]
        repeats = int(np.ceil(AASIST_INPUT_LENGTH / len(audio)))
        audio = np.tile(audio, repeats)[:AASIST_INPUT_LENGTH]
    elif len(audio) >= AASIST_INPUT_LENGTH:
        audio = audio[:AASIST_INPUT_LENGTH]

    tensor = torch.from_numpy(
        audio
    ).float()

    tensor = tensor.unsqueeze(0)

    return tensor.to(DEVICE)


# ============================================================
# VOICE ACTIVITY DETECTION (VAD) & ENERGY GATING
# ============================================================

def compute_voice_activity(audio, sample_rate=SAMPLE_RATE):
    """
    Computes RMS energy and frame-level voiced ratios to detect genuine speech
    versus silent pauses or low-energy ambient noise.
    """
    audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)
    rms = float(np.sqrt(np.mean(audio ** 2) + 1e-9))
    peak = float(np.max(np.abs(audio))) if len(audio) > 0 else 0.0

    frame_size = int(sample_rate * 0.025)  # 25ms frame (400 samples)
    hop_size = int(sample_rate * 0.010)    # 10ms hop (160 samples)

    if len(audio) < frame_size:
        is_speech = rms >= 0.0015
        return {
            "speech_detected": is_speech,
            "rms_energy": round(rms, 6),
            "peak_energy": round(peak, 6),
            "voiced_ratio": 1.0 if is_speech else 0.0,
            "voiced_seconds": round(len(audio) / sample_rate, 2) if is_speech else 0.0,
        }

    num_frames = (len(audio) - frame_size) // hop_size + 1
    voiced_frames = 0
    energy_thresh = 0.0018

    for i in range(num_frames):
        start = i * hop_size
        frame = audio[start : start + frame_size]
        f_rms = np.sqrt(np.mean(frame ** 2) + 1e-9)
        if f_rms > energy_thresh:
            voiced_frames += 1

    voiced_ratio = voiced_frames / max(1, num_frames)

    # Active speech is detected if overall RMS exceeds baseline room noise (0.0015)
    # and at least 8% of frames contain voiced energy.
    speech_detected = bool((rms >= 0.0015) and (voiced_ratio >= 0.08))

    # Compute realistic voiced speech duration in seconds
    voiced_seconds = round(max(0.4, voiced_ratio * (len(audio) / sample_rate)), 2) if speech_detected else 0.0

    return {
        "speech_detected": speech_detected,
        "rms_energy": round(rms, 6),
        "peak_energy": round(peak, 6),
        "voiced_ratio": round(voiced_ratio, 3),
        "voiced_seconds": voiced_seconds,
    }


# ============================================================
# SPECTRAL FLUX & PHYSICAL VOCAL TRACT FORENSICS
# ============================================================

def compute_spectral_flux(audio, sr=SAMPLE_RATE):
    """
    Computes frame-to-frame spectral flux across STFT windows.
    Informational metric reflecting dynamic speech turbulence.
    """
    try:
        f, t, Zxx = signal.stft(audio, fs=sr, nperseg=512, noverlap=256)
        mag = np.abs(Zxx)
        return float(np.mean(np.diff(mag, axis=1)**2) * 1000)
    except Exception:
        return 0.0050


# ============================================================
# SINGLE WINDOW PREDICTION
# ============================================================

def predict_window(audio, model):
    audio_flat = np.asarray(audio, dtype=np.float32).reshape(-1)
    vad = compute_voice_activity(audio_flat, SAMPLE_RATE)

    # If audio is silence or low ambient noise without active speech,
    # return neutral result to prevent wild fluctuations
    if not vad["speech_detected"]:
        return {
            "speech_detected": False,
            "rms_energy": vad["rms_energy"],
            "voiced_ratio": vad["voiced_ratio"],
            "voiced_seconds": vad["voiced_seconds"],
            "spoof_score": 0.0,
            "bonafide_score": 1.0,
            "spoof_logit": -5.0,
            "bonafide_logit": 5.0,
            "is_silence": True,
            "spectral_flux": 0.0,
        }

    x = prepare_aasist_input(audio_flat)

    with torch.inference_mode():
        last_hidden, output = model(x)
        logits = output

        # Safety check
        if not isinstance(logits, torch.Tensor):
            raise RuntimeError(
                f"AASIST classification output is not a Tensor. Got: {type(logits)}"
            )

        if logits.ndim != 2 or logits.shape[1] != 2:
            raise RuntimeError(
                f"Unexpected AASIST output shape: {tuple(logits.shape)}"
            )

        probabilities = torch.softmax(logits, dim=1)

        # AASIST checkpoint convention:
        # class 0 = BONAFIDE (Genuine Human Speech)
        # class 1 = SPOOF (Synthetic / Cloned Voice Attack)
        bonafide_score = float(probabilities[0, 0].item())
        spoof_score = float(probabilities[0, 1].item())
        bonafide_logit = float(logits[0, 0].item())
        spoof_logit = float(logits[0, 1].item())

    flux = compute_spectral_flux(audio_flat, SAMPLE_RATE)

    return {
        "speech_detected": True,
        "rms_energy": vad["rms_energy"],
        "voiced_ratio": vad["voiced_ratio"],
        "voiced_seconds": vad["voiced_seconds"],
        "spoof_score": spoof_score,
        "bonafide_score": bonafide_score,
        "spoof_logit": spoof_logit,
        "bonafide_logit": bonafide_logit,
        "is_silence": False,
        "spectral_flux": round(flux, 4),
    }


# ============================================================
# RISK CLASSIFICATION
# ============================================================

def classify_risk(spoof_score, speech_detected=True):
    if not speech_detected:
        return {
            "level": "NEUTRAL",
            "label": "WAITING FOR SPEECH",
            "action": "MONITOR",
        }

    if spoof_score < 0.40:
        return {
            "level": "LOW",
            "label": "LIKELY REAL",
            "action": "ALLOW",
        }
    elif spoof_score < 0.65:
        return {
            "level": "MEDIUM",
            "label": "SUSPICIOUS",
            "action": "CHALLENGE",
        }
    else:
        return {
            "level": "HIGH",
            "label": "LIKELY SPOOFED",
            "action": "BLOCK",
        }


# ============================================================
# FULL AUDIO ANALYSIS
# ============================================================

def predict(audio_path, model):

    audio = decode_audio(audio_path)

    duration = len(audio) / SAMPLE_RATE

    # --------------------------------------------------------
    # Short recording
    # --------------------------------------------------------

    if len(audio) <= AASIST_INPUT_LENGTH:

        result = predict_window(
            audio,
            model
        )

        spoof_score = result["spoof_score"]
        bonafide_score = result["bonafide_score"]

        risk = classify_risk(
            spoof_score,
            speech_detected=result["speech_detected"]
        )

        return {
            "verdict": risk["label"],
            "risk_level": risk["level"],
            "action": risk["action"],

            "spoof_score": spoof_score,
            "bonafide_score": bonafide_score,

            "spoof_percentage":
                spoof_score * 100,

            "bonafide_percentage":
                bonafide_score * 100,

            "duration": duration,

            "windows": 1,

            "window_results": [result]
        }

    # --------------------------------------------------------
    # Multiple overlapping windows
    # --------------------------------------------------------

    window_results = []

    start = 0

    while start < len(audio):

        end = start + AASIST_INPUT_LENGTH

        chunk = audio[start:end]

        if len(chunk) < int(SAMPLE_RATE * 1.5):
            break

        result = predict_window(
            chunk,
            model
        )

        result["start_time"] = (
            start / SAMPLE_RATE
        )

        result["end_time"] = (
            min(end, len(audio)) / SAMPLE_RATE
        )

        window_results.append(result)

        start += HOP_SAMPLES

    if not window_results:

        result = predict_window(
            audio,
            model
        )

        window_results.append(result)

    # --------------------------------------------------------
    # Aggregate windows
    # --------------------------------------------------------

    spoof_scores = np.array(
        [
            r["spoof_score"]
            for r in window_results
        ],
        dtype=np.float32
    )

    bonafide_scores = np.array(
        [
            r["bonafide_score"]
            for r in window_results
        ],
        dtype=np.float32
    )

    # Average score
    avg_spoof = float(
        np.mean(spoof_scores)
    )

    avg_bonafide = float(
        np.mean(bonafide_scores)
    )

    # Maximum spoof score is important for
    # security-sensitive detection.
    max_spoof = float(
        np.max(spoof_scores)
    )

    # Conservative security score.
    #
    # Average catches persistent spoofing.
    # Maximum catches highly suspicious segments.
    final_spoof = (
        0.70 * avg_spoof
        +
        0.30 * max_spoof
    )

    any_speech = any(r["speech_detected"] for r in window_results)

    risk = classify_risk(
        final_spoof,
        speech_detected=any_speech
    )

    return {

        "verdict": risk["label"],

        "risk_level":
            risk["level"],

        "action":
            risk["action"],

        "spoof_score":
            final_spoof,

        "bonafide_score":
            1.0 - final_spoof,

        "spoof_percentage":
            final_spoof * 100,

        "bonafide_percentage":
            (1.0 - final_spoof) * 100,

        "average_spoof_score":
            avg_spoof,

        "maximum_spoof_score":
            max_spoof,

        "duration":
            duration,

        "windows":
            len(window_results),

        "window_results":
            window_results
    }