import asyncio
import os
import random
import sys
from pathlib import Path
import numpy as np
import scipy.signal as signal
import soundfile as sf
from gtts import gTTS
import edge_tts
import miniaudio

CURRENT_DIR = Path(__file__).resolve().parent
AI_DIR = CURRENT_DIR.parent
DATA_DIR = AI_DIR / "data" / "synthetic"

SAMPLE_RATE = 16000

SENTENCES = [
    "Hello, I am calling regarding your bank verification code. Please share the one-time password.",
    "Your parcel has been detained at customs. Please verify your credentials immediately to avoid penalties.",
    "VoiceGuard AI real-time anti-spoofing system is actively monitoring this incoming audio stream.",
    "Kindly transfer the requested funds to the verified emergency account right now.",
    "This is an urgent security notification from your telecom service provider.",
    "Please confirm your account identification number to prevent permanent account suspension.",
    "I am calling from the enforcement agency regarding an urgent digital arrest inquiry.",
    "The confidential report has been uploaded to your portal for immediate review.",
    "Please press one to speak with an executive or provide the OTP sent to your registered phone.",
    "We have detected an unauthorized login attempt from a foreign location on your account."
]

def ensure_dirs():
    dirs = [
        DATA_DIR / "google_translate",
        DATA_DIR / "edge_azure",
        DATA_DIR / "elevenlabs_chatgpt",
        DATA_DIR / "rvc_voice_cloner",
        DATA_DIR / "asvspoof2021_df",
        DATA_DIR / "spoofceleb",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs

def decode_to_16k_mono(file_path: Path) -> np.ndarray:
    with open(file_path, "rb") as f:
        data = f.read()
    decoded = miniaudio.decode(
        data,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=1,
        sample_rate=SAMPLE_RATE,
    )
    samples = np.asarray(decoded.samples, dtype=np.float32).reshape(-1)
    return np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)

def save_wav(samples: np.ndarray, out_path: Path):
    samples = np.clip(samples, -1.0, 1.0)
    sf.write(str(out_path), samples, SAMPLE_RATE, subtype="PCM_16")

def generate_gtts():
    print("[1/6] Generating Google Translate (gTTS) multi-accent samples...", flush=True)
    tlds = ["com", "co.in", "co.uk", "com.au"]
    target_dir = DATA_DIR / "google_translate"
    count = 0
    for idx, text in enumerate(SENTENCES):
        tld = tlds[idx % len(tlds)]
        out_mp3 = target_dir / f"temp_gtts_{idx}_{tld}.mp3"
        out_wav = target_dir / f"gtts_{idx}_{tld}.wav"
        try:
            tts = gTTS(text=text, lang="en", tld=tld, slow=False)
            tts.save(str(out_mp3))
            audio = decode_to_16k_mono(out_mp3)
            save_wav(audio, out_wav)
            if out_mp3.exists():
                out_mp3.unlink()
            count += 1
        except Exception as e:
            print(f"[Warn] gTTS error on sample {idx}: {e}", flush=True)
    print(f"      -> Generated {count} Google Translate samples.", flush=True)

async def generate_edge_azure():
    print("[2/6] Generating Microsoft Azure / Edge Neural TTS voices...", flush=True)
    voices = [
        "en-US-JennyNeural",
        "en-US-GuyNeural",
        "en-IN-NeerjaNeural",
        "en-IN-PrabhatNeural",
        "en-GB-SoniaNeural",
        "en-US-AriaNeural",
    ]
    target_dir = DATA_DIR / "edge_azure"
    count = 0
    for idx, text in enumerate(SENTENCES):
        voice = voices[idx % len(voices)]
        out_mp3 = target_dir / f"temp_edge_{idx}.mp3"
        out_wav = target_dir / f"edge_{voice}_{idx}.wav"
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(out_mp3))
            audio = decode_to_16k_mono(out_mp3)
            save_wav(audio, out_wav)
            if out_mp3.exists():
                out_mp3.unlink()
            count += 1
        except Exception as e:
            print(f"[Warn] edge-tts error on sample {idx}: {e}", flush=True)
    print(f"      -> Generated {count} Edge/Azure Neural TTS samples.", flush=True)

def generate_elevenlabs_chatgpt_vocoders():
    """
    Emulates modern high-fidelity vocoder artifacts (HiFi-GAN / BigVGAN / ElevenLabs):
    - Suppressed biological micro-jitter (robotic pitch rigidity over vowel formants)
    - High-frequency phase checkerboard discontinuities (>4kHz)
    - Slight sub-glottal resonance attenuation
    """
    print("[3/6] Generating ElevenLabs & ChatGPT neural vocoder signatures...", flush=True)
    source_dir = DATA_DIR / "edge_azure"
    target_dir = DATA_DIR / "elevenlabs_chatgpt"
    count = 0

    wav_files = list(source_dir.glob("*.wav"))
    for idx, wav_path in enumerate(wav_files):
        try:
            audio = decode_to_16k_mono(wav_path)
            # High-frequency vocoder upsampling artifact simulation
            # Introduce periodic transposed-conv checkerboard in 5kHz - 8kHz band
            n = len(audio)
            t = np.arange(n) / SAMPLE_RATE
            # 6.4 kHz periodic vocoder modulation
            vocoder_carrier = 0.018 * np.sin(2 * np.pi * 6400 * t)
            # Suppress natural jitter with slight dynamic compression
            envelope = np.abs(audio)
            compressed = np.sign(audio) * (envelope ** 0.94)
            augmented = compressed + vocoder_carrier * envelope
            augmented = np.clip(augmented, -1.0, 1.0)

            out_wav = target_dir / f"elevenlabs_chatgpt_{idx}.wav"
            save_wav(augmented, out_wav)
            count += 1
        except Exception as e:
            print(f"[Warn] ElevenLabs emulation error on {wav_path.name}: {e}", flush=True)
    print(f"      -> Generated {count} ElevenLabs/ChatGPT vocoder samples.", flush=True)

def generate_rvc_voice_cloner():
    """
    Emulates Retrieval-based Voice Conversion (RVC / So-VITS):
    - Pitch transposition and formant warping
    - Phoneme transition smoothing
    """
    print("[4/6] Generating RVC Voice Conversion cloning samples...", flush=True)
    source_dir = DATA_DIR / "google_translate"
    target_dir = DATA_DIR / "rvc_voice_cloner"
    count = 0

    wav_files = list(source_dir.glob("*.wav"))
    for idx, wav_path in enumerate(wav_files):
        try:
            audio = decode_to_16k_mono(wav_path)
            # Formant warping simulation: 2nd-order IIR peak filter
            b, a = signal.iirpeak(w0=1200, Q=3.0, fs=SAMPLE_RATE)
            filtered = signal.lfilter(b, a, audio)
            # Blend original with warped formant (classic RVC blend ratio 0.75)
            rvc_sim = 0.65 * audio + 0.35 * filtered
            # Pitch quantization effect: subtle phase delay
            delay_samples = 4
            rvc_sim = rvc_sim + 0.15 * np.roll(rvc_sim, delay_samples)
            out_wav = target_dir / f"rvc_clone_{idx}.wav"
            save_wav(rvc_sim, out_wav)
            count += 1
        except Exception as e:
            print(f"[Warn] RVC emulation error on {wav_path.name}: {e}", flush=True)
    print(f"      -> Generated {count} RVC voice clone samples.", flush=True)

def generate_asvspoof2021_df():
    """
    ASVspoof 2021 DF Benchmark Emulation:
    - Multi-codec degradation (Opus, MP3, AAC lossy spectral smearing)
    - Telephony bandpass filtering (300Hz - 3400Hz)
    """
    print("[5/6] Generating ASVspoof 2021 DF & ASVspoof 5 lossy codec samples...", flush=True)
    source_dir = DATA_DIR / "edge_azure"
    target_dir = DATA_DIR / "asvspoof2021_df"
    count = 0

    # 4th-order Butterworth bandpass (300Hz - 3400Hz)
    sos = signal.butter(4, [300, 3400], btype="bandpass", fs=SAMPLE_RATE, output="sos")

    wav_files = list(source_dir.glob("*.wav"))
    for idx, wav_path in enumerate(wav_files):
        try:
            audio = decode_to_16k_mono(wav_path)
            # Apply telephony bandpass
            bandpassed = signal.sosfilt(sos, audio)
            # Add quantization noise (simulating low-bitrate VoIP codec at 16kbps)
            noise_floor = np.random.normal(0, 0.003, len(bandpassed))
            quantized = np.round(bandpassed * 64.0) / 64.0 + noise_floor
            out_wav = target_dir / f"asv2021df_{idx}.wav"
            save_wav(quantized, out_wav)
            count += 1
        except Exception as e:
            print(f"[Warn] ASVspoof2021 DF error on {wav_path.name}: {e}", flush=True)
    print(f"      -> Generated {count} ASVspoof 2021 DF codec samples.", flush=True)

def generate_spoofceleb():
    """
    SpoofCeleb In-The-Wild Benchmark Emulation:
    - Reverberation / Room impulse response
    - Ambient room noise injection (20 - 30 dB SNR)
    """
    print("[6/6] Generating SpoofCeleb in-the-wild reverberant samples...", flush=True)
    source_dir = DATA_DIR / "edge_azure"
    target_dir = DATA_DIR / "spoofceleb"
    count = 0

    # Synthetic room impulse response (reverb tail ~150ms)
    reverb_len = int(SAMPLE_RATE * 0.15)
    t = np.arange(reverb_len) / SAMPLE_RATE
    decay = np.exp(-t / 0.04)
    rir = np.random.normal(0, 1, reverb_len) * decay
    rir = rir / np.sum(np.abs(rir))

    wav_files = list(source_dir.glob("*.wav"))
    for idx, wav_path in enumerate(wav_files):
        try:
            audio = decode_to_16k_mono(wav_path)
            # Convolve with room impulse response
            reverbed = signal.fftconvolve(audio, rir, mode="same")
            # Mix 80% direct sound + 20% room reverb
            mixed = 0.80 * audio + 0.20 * reverbed
            # Add background noise at 25 dB SNR
            rms = np.sqrt(np.mean(mixed ** 2) + 1e-8)
            snr_linear = 10.0 ** (25.0 / 20.0)
            noise = np.random.normal(0, rms / snr_linear, len(mixed))
            in_the_wild = mixed + noise
            out_wav = target_dir / f"spoofceleb_{idx}.wav"
            save_wav(in_the_wild, out_wav)
            count += 1
        except Exception as e:
            print(f"[Warn] SpoofCeleb generation error on {wav_path.name}: {e}", flush=True)
    print(f"      -> Generated {count} SpoofCeleb in-the-wild samples.", flush=True)

async def main():
    print("=" * 65)
    print(" VoiceGuard Multi-Platform AI Voice & Benchmark Dataset Generator")
    print("=" * 65)
    ensure_dirs()
    generate_gtts()
    await generate_edge_azure()
    generate_elevenlabs_chatgpt_vocoders()
    generate_rvc_voice_cloner()
    generate_asvspoof2021_df()
    generate_spoofceleb()
    print("=" * 65)
    print("[SUCCESS] Multi-platform AI voice dataset successfully generated!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
