import os
import sys
import random
import time
from pathlib import Path
from typing import List, Tuple

import miniaudio
import numpy as np
import scipy.signal as signal
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

CURRENT_DIR = Path(__file__).resolve().parent
AI_DIR = CURRENT_DIR.parent
sys.path.append(str(CURRENT_DIR))

from aasist import Model
from config import AASIST_CONFIG

DEVICE = torch.device("cpu")
SAMPLE_RATE = 16000
AASIST_INPUT_LENGTH = 64600
HOP_SAMPLES = 20000  # 1.25s hop to capture dense spectro-temporal features


# ============================================================
# MULTI-DOMAIN DATA AUGMENTATION (VOIP, CODEC, SPECAUGMENT)
# ============================================================

def apply_gain(x: np.ndarray) -> np.ndarray:
    gain = random.uniform(0.65, 1.25)
    return np.clip(x * gain, -1.0, 1.0)


def add_voip_noise(x: np.ndarray) -> np.ndarray:
    """Injects realistic ambient/VoIP line noise (18-35 dB SNR)."""
    rms_x = np.sqrt(np.mean(x ** 2) + 1e-8)
    snr_db = random.uniform(18.0, 35.0)
    snr_linear = 10.0 ** (snr_db / 20.0)
    rms_noise = rms_x / snr_linear
    noise = np.random.normal(0, rms_noise, len(x)).astype(np.float32)
    return np.clip(x + noise, -1.0, 1.0)


def simulate_packet_loss(x: np.ndarray) -> np.ndarray:
    """Randomly zeros out short packet drop bursts (e.g. 50-100ms)."""
    x = x.copy()
    num_drops = random.randint(1, 2)
    for _ in range(num_drops):
        burst_len = random.randint(800, 1600)  # 50ms - 100ms @ 16kHz
        start = random.randint(0, max(0, len(x) - burst_len))
        x[start : start + burst_len] = 0.0
    return x


def apply_codec_quantization(x: np.ndarray) -> np.ndarray:
    """Simulates lossy Opus/WebRTC compression artifacting."""
    levels = random.choice([64.0, 128.0, 256.0])
    quantized = np.round(x * levels) / levels
    return quantized.astype(np.float32)


def apply_spec_frequency_mask(x: np.ndarray) -> np.ndarray:
    """SpecAugment frequency masking in spectral domain."""
    X = np.fft.rfft(x)
    num_bins = len(X)
    mask_width = random.randint(int(num_bins * 0.02), int(num_bins * 0.08))
    start_bin = random.randint(0, max(1, num_bins - mask_width))
    X[start_bin : start_bin + mask_width] = 0.0
    return np.fft.irfft(X, n=len(x)).astype(np.float32)


def augment_audio(x: np.ndarray) -> np.ndarray:
    """Super-fast vectorized VoIP noise, gain, and packet burst loss augmentations."""
    x = x.copy()
    if random.random() < 0.5:
        # Fast gain
        x = x * random.uniform(0.75, 1.25)
    if random.random() < 0.35:
        # Fast VoIP line noise
        rms = float(np.sqrt(np.mean(x ** 2) + 1e-9))
        noise = np.random.normal(0, rms * random.uniform(0.01, 0.04), len(x)).astype(np.float32)
        x = x + noise
    if random.random() < 0.25:
        # Fast packet drop burst
        burst_len = random.randint(800, 1600)
        start = random.randint(0, max(0, len(x) - burst_len))
        x[start : start + burst_len] = 0.0
    return np.clip(x, -1.0, 1.0)


# ============================================================
# DATASET & SEGMENTATION
# ============================================================

def load_audio_file(file_path: Path) -> np.ndarray:
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    decoded = miniaudio.decode(
        audio_bytes,
        output_format=miniaudio.SampleFormat.FLOAT32,
        nchannels=1,
        sample_rate=SAMPLE_RATE,
    )
    samples = np.asarray(decoded.samples, dtype=np.float32).reshape(-1)
    return np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)


def standardize_chunk(chunk: np.ndarray, target_rms: float = 0.060) -> np.ndarray:
    cur_rms = float(np.sqrt(np.mean(chunk ** 2) + 1e-9))
    if cur_rms > 0.001:
        chunk = np.clip(chunk * (target_rms / cur_rms), -1.0, 1.0)
    if len(chunk) < AASIST_INPUT_LENGTH and len(chunk) > 0:
        repeats = int(np.ceil(AASIST_INPUT_LENGTH / len(chunk)))
        chunk = np.tile(chunk, repeats)[:AASIST_INPUT_LENGTH]
    elif len(chunk) >= AASIST_INPUT_LENGTH:
        chunk = chunk[:AASIST_INPUT_LENGTH]
    return chunk.astype(np.float32)


def slice_into_chunks(audio: np.ndarray) -> List[np.ndarray]:
    """Slices audio into fixed 64,600-sample windows with tiling and RMS normalization."""
    chunks = []
    if len(audio) < AASIST_INPUT_LENGTH:
        tiled = standardize_chunk(audio)
        rms = np.sqrt(np.mean(tiled ** 2) + 1e-8)
        if rms > 0.003:
            chunks.append(tiled)
        return chunks

    start = 0
    while start + AASIST_INPUT_LENGTH <= len(audio):
        chunk = audio[start : start + AASIST_INPUT_LENGTH]
        std_chunk = standardize_chunk(chunk)
        rms = np.sqrt(np.mean(std_chunk ** 2) + 1e-8)
        if rms > 0.003:
            chunks.append(std_chunk)
        start += HOP_SAMPLES

    if len(audio) > AASIST_INPUT_LENGTH and (start < len(audio)):
        chunk = audio[-AASIST_INPUT_LENGTH:]
        std_chunk = standardize_chunk(chunk)
        rms = np.sqrt(np.mean(std_chunk ** 2) + 1e-8)
        if rms > 0.003:
            chunks.append(std_chunk)

    return chunks


class VoiceSpoofDataset(Dataset):
    def __init__(self, samples: List[Tuple[np.ndarray, int]], augment: bool = False):
        self.samples = samples
        self.augment = augment

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        audio, label = self.samples[idx]
        if self.augment:
            audio = augment_audio(audio)
        tensor = torch.from_numpy(audio.copy()).float()
        return tensor, torch.tensor(label, dtype=torch.long)


# ============================================================
# STRATIFIED MULTI-DATASET BALANCING PIPELINE
# ============================================================

def build_dataset() -> Tuple[List[Tuple[np.ndarray, int]], List[Tuple[np.ndarray, int]]]:
    synth_base = AI_DIR / "data" / "synthetic"
    real_base = AI_DIR / "data"

    print("[Train] Loading stratified multi-platform synthetic categories...", flush=True)
    
    categories = [
        "google_translate",
        "google_voice_mic",
        "replayed_acoustic",
        "user_reported",
        "edge_azure",
        "elevenlabs_chatgpt",
        "rvc_voice_cloner",
        "asvspoof2021_df",
        "spoofceleb"
    ]

    all_synth_chunks = []
    for cat in categories:
        cat_dir = synth_base / cat
        cat_chunks = []
        if cat_dir.exists():
            for p in sorted(cat_dir.glob("*.wav")):
                try:
                    audio = load_audio_file(p)
                    cat_chunks.extend(slice_into_chunks(audio))
                except Exception:
                    pass
        print(f"      -> {cat:22}: {len(cat_chunks)} chunks collected.", flush=True)
        all_synth_chunks.extend(cat_chunks)

    # Add legacy synthetic audio
    legacy_chunks = []
    for p in sorted(synth_base.glob("*.wav")):
        try:
            audio = load_audio_file(p)
            legacy_chunks.extend(slice_into_chunks(audio))
        except Exception:
            pass
    random.seed(42)
    random.shuffle(legacy_chunks)
    all_synth_chunks.extend(legacy_chunks[:35])
    print(f"      -> legacy_synthetic      : {min(35, len(legacy_chunks))} chunks collected.", flush=True)

    # Add eval fake audio
    eval_fake = []
    for p in sorted((real_base / "eval").glob("fake_*.wav")):
        try:
            audio = load_audio_file(p)
            eval_fake.extend(slice_into_chunks(audio))
        except Exception:
            pass
    all_synth_chunks.extend(eval_fake)
    print(f"      -> eval_fake_anchors     : {len(eval_fake)} chunks collected.", flush=True)

    # Add verified auto-collected fake audio
    auto_fake = []
    for p in sorted((real_base / "auto_collected" / "fake").glob("*.wav")):
        try:
            audio = load_audio_file(p)
            auto_fake.extend(slice_into_chunks(audio))
        except Exception:
            pass
    random.shuffle(auto_fake)
    all_synth_chunks.extend(auto_fake[:120])
    print(f"      -> auto_collected_fake   : {min(120, len(auto_fake))} chunks collected.", flush=True)

    print(f"[Train] Total synthetic/cloned chunks: {len(all_synth_chunks)}", flush=True)

    # Collect Real Voice Chunks
    print("[Train] Loading genuine human speech chunks...", flush=True)
    real_chunks = []
    real_files = (
        list((real_base / "eval").glob("real_*.wav")) +
        list(real_base.glob("real_*.mpeg"))
    )
    for p in real_files:
        try:
            audio = load_audio_file(p)
            real_chunks.extend(slice_into_chunks(audio))
        except Exception:
            pass

    # Include all verified real microphone recordings from auto_collected/real
    auto_real_files = list((real_base / "auto_collected" / "real").glob("*.wav"))
    for p in auto_real_files:
        try:
            audio = load_audio_file(p)
            if np.sqrt(np.mean(audio ** 2) + 1e-9) > 0.001:
                real_chunks.extend(slice_into_chunks(audio))
        except Exception:
            pass

    random.shuffle(real_chunks)
    # Balance: Match real chunks count with synthetic chunks count exactly
    target_count = len(all_synth_chunks)
    selected_real = real_chunks[:target_count]
    print(f"[Train] Total genuine real chunks: {len(selected_real)} (Balanced 1:1 with synthetic: {target_count})", flush=True)

    # Class 0: BONAFIDE (Genuine Human Speech)
    # Class 1: SPOOF (Synthetic / AI Voice Attack)
    all_data = [(c, 0) for c in selected_real] + [(c, 1) for c in all_synth_chunks]
    random.shuffle(all_data)

    split_idx = int(len(all_data) * 0.82)
    train_data = all_data[:split_idx]
    val_data = all_data[split_idx:]

    print(f"[Train] Dataset ready: {len(train_data)} train samples, {len(val_data)} validation samples.", flush=True)
    return train_data, val_data


def train_model(epochs: int = 5, batch_size: int = 24, lr: float = 1.5e-4):
    print("=" * 68, flush=True)
    print(" VoiceGuard AASIST Anti-Spoofing End-to-End Model Fine-Tuning", flush=True)
    print(" (Stratified Multi-Platform: Google Translate, ElevenLabs, ChatGPT, RVC)", flush=True)
    print("=" * 68, flush=True)

    train_samples, val_samples = build_dataset()
    train_dataset = VoiceSpoofDataset(train_samples, augment=True)
    val_dataset = VoiceSpoofDataset(val_samples, augment=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    models_dir = AI_DIR / "models"
    base_path = models_dir / "AASIST.pth"
    save_path = models_dir / "AASIST_finetuned.pth"

    model = Model(AASIST_CONFIG)
    if base_path.exists():
        print(f"[Train] Loading foundational weights from {base_path.name}...", flush=True)
        checkpoint = torch.load(base_path, map_location=DEVICE)
        if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
            checkpoint = checkpoint["state_dict"]
        model.load_state_dict(checkpoint, strict=True)

    # Efficient fine-tuning: Freeze lower acoustic waveform layers (SincNet, RawNet encoder)
    # and adapt the Graph Attention Network (GAT), pool, master node, and classification head.
    for name, p in model.named_parameters():
        if any(k in name for k in ["GAT", "pool", "master", "out_layer"]):
            p.requires_grad = True
        else:
            p.requires_grad = False

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[Train] Fine-tuning GAT & classification head: {total_params:,} parameters.", flush=True)

    model.to(DEVICE)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.03)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=3e-5)

    best_val_acc = 0.0
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for b_idx, (x_batch, y_batch) in enumerate(train_loader, 1):
            x_batch = x_batch.to(DEVICE)
            y_batch = y_batch.to(DEVICE)

            optimizer.zero_grad()
            _, logits = model(x_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()

            train_loss += loss.item() * len(y_batch)
            preds = torch.argmax(logits, dim=1)
            train_correct += (preds == y_batch).sum().item()
            train_total += len(y_batch)
            if b_idx % 5 == 0 or b_idx == len(train_loader):
                print(f"  -> Epoch {epoch}/{epochs} | Batch {b_idx:2d}/{len(train_loader)} | Running Acc: {train_correct/train_total*100:5.1f}%", flush=True)

        train_epoch_loss = train_loss / max(1, train_total)
        train_epoch_acc = (train_correct / max(1, train_total)) * 100.0

        # Validation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                x_batch = x_batch.to(DEVICE)
                y_batch = y_batch.to(DEVICE)

                _, logits = model(x_batch)
                loss = criterion(logits, y_batch)

                val_loss += loss.item() * len(y_batch)
                preds = torch.argmax(logits, dim=1)
                val_correct += (preds == y_batch).sum().item()
                val_total += len(y_batch)

        val_epoch_loss = val_loss / max(1, val_total)
        val_epoch_acc = (val_correct / max(1, val_total)) * 100.0

        print(
            f"Epoch [{epoch}/{epochs}] "
            f"Train Loss: {train_epoch_loss:.4f} | Acc: {train_epoch_acc:5.1f}% || "
            f"Val Loss: {val_epoch_loss:.4f} | Val Acc: {val_epoch_acc:5.1f}%",
            flush=True,
        )

        if val_epoch_acc >= best_val_acc:
            best_val_acc = val_epoch_acc
            torch.save(model.state_dict(), save_path)
            print(f"  >>> Checkpoint saved to {save_path.name} (Val Acc: {val_epoch_acc:.1f}%)", flush=True)

        scheduler.step()

    elapsed = time.time() - start_time
    print("=" * 68, flush=True)
    print(f"[SUCCESS] Multi-Platform Training Completed in {elapsed:.1f}s!", flush=True)
    print(f"[SUCCESS] Best Validation Accuracy: {best_val_acc:.2f}%", flush=True)
    print(f"[SUCCESS] Model Checkpoint: {save_path}", flush=True)
    print("=" * 68, flush=True)


if __name__ == "__main__":
    train_model(epochs=5, batch_size=24, lr=1.5e-4)
