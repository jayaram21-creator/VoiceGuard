import os
import sys
import random
import time
from pathlib import Path
from typing import List, Tuple

import miniaudio
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

CURRENT_DIR = Path(__file__).resolve().parent
AI_DIR = CURRENT_DIR.parent
sys.path.append(str(CURRENT_DIR))

from aasist import Model
from config import AASIST_CONFIG

DEVICE = torch.device("cpu")
SAMPLE_RATE = 16000
AASIST_INPUT_LENGTH = 64600
HOP_SAMPLES = 20000

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

def slice_into_chunks(audio: np.ndarray) -> List[np.ndarray]:
    chunks = []
    if len(audio) < AASIST_INPUT_LENGTH:
        padded = np.pad(audio, (0, AASIST_INPUT_LENGTH - len(audio)), mode="constant")
        rms = np.sqrt(np.mean(padded ** 2) + 1e-8)
        if rms > 0.003:
            chunks.append(padded)
        return chunks

    start = 0
    while start + AASIST_INPUT_LENGTH <= len(audio):
        chunk = audio[start : start + AASIST_INPUT_LENGTH]
        rms = np.sqrt(np.mean(chunk ** 2) + 1e-8)
        if rms > 0.003:
            chunks.append(chunk)
        start += HOP_SAMPLES
    return chunks

class SimpleDataset(Dataset):
    def __init__(self, samples: List[Tuple[np.ndarray, int]]):
        self.samples = samples
    def __len__(self):
        return len(self.samples)
    def __getitem__(self, idx):
        audio, label = self.samples[idx]
        return torch.from_numpy(audio.copy()).float(), torch.tensor(label, dtype=torch.long)

def run():
    print("=== Training with Full Model Adaptability & Stratified Synthetic Datasets ===")
    synth_dir = AI_DIR / "data" / "synthetic"
    real_dir = AI_DIR / "data"

    # 1. Collect all chunks categorized
    categories = {}
    for sub in synth_dir.iterdir():
        if sub.is_dir():
            categories[sub.name] = []
            for f in sub.glob("*.wav"):
                chunks = slice_into_chunks(load_audio_file(f))
                categories[sub.name].extend(chunks)
            print(f"Loaded {len(categories[sub.name])} chunks for {sub.name}")

    # Collect legacy synthetic
    legacy_synth = []
    for f in synth_dir.glob("*.wav"):
        chunks = slice_into_chunks(load_audio_file(f))
        legacy_synth.extend(chunks)
    print(f"Loaded {len(legacy_synth)} legacy synthetic chunks")

    # Collect real chunks
    real_chunks = []
    for f in list(real_dir.glob("real_*.mpeg")) + list(real_dir.glob("eval/real_*.wav")) + list(real_dir.glob("auto_collected/real/*.wav")):
        try:
            chunks = slice_into_chunks(load_audio_file(f))
            real_chunks.extend(chunks)
        except Exception:
            pass
    print(f"Loaded {len(real_chunks)} real chunks")

    # Balance: Take all from each modern synthetic category (e.g. ~30 from each = ~180 chunks)
    all_synth = []
    for cat_name, c_list in categories.items():
        all_synth.extend(c_list)
    # Add some legacy
    random.seed(42)
    random.shuffle(legacy_synth)
    all_synth.extend(legacy_synth[:30])

    print(f"Total modern & legacy synthetic chunks for training: {len(all_synth)}")

    random.shuffle(real_chunks)
    selected_real = real_chunks[:len(all_synth)]
    print(f"Total balanced real chunks: {len(selected_real)}")

    # Class 0: REAL / BONAFIDE, Class 1: SPOOF / FAKE
    all_data = [(c, 0) for c in selected_real] + [(c, 1) for c in all_synth]
    random.shuffle(all_data)

    split = int(len(all_data) * 0.8)
    train_data = all_data[:split]
    val_data = all_data[split:]

    train_loader = DataLoader(SimpleDataset(train_data), batch_size=8, shuffle=True)
    val_loader = DataLoader(SimpleDataset(val_data), batch_size=8, shuffle=False)

    model = Model(AASIST_CONFIG)
    base_path = AI_DIR / "models" / "AASIST.pth"
    checkpoint = torch.load(base_path, map_location=DEVICE)
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        checkpoint = checkpoint["state_dict"]
    model.load_state_dict(checkpoint, strict=True)

    # DO NOT FREEZE THE ENCODER! Train the full network end-to-end!
    # All 297k parameters can adapt to modern AI vocoders!
    for param in model.parameters():
        param.requires_grad = True

    model.to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)

    for epoch in range(1, 6):
        model.train()
        train_loss, train_corr, total = 0.0, 0, 0
        for x, y in train_loader:
            optimizer.zero_grad()
            _, logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()

            train_loss += loss.item() * len(y)
            preds = torch.argmax(logits, dim=1)
            train_corr += (preds == y).sum().item()
            total += len(y)

        # Eval
        model.eval()
        val_loss, val_corr, val_total = 0.0, 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                _, logits = model(x)
                loss = criterion(logits, y)
                val_loss += loss.item() * len(y)
                preds = torch.argmax(logits, dim=1)
                val_corr += (preds == y).sum().item()
                val_total += len(y)

        print(f"Epoch {epoch}/5: Train Loss: {train_loss/total:.4f}, Acc: {train_corr/total*100:.1f}% | Val Loss: {val_loss/val_total:.4f}, Acc: {val_corr/val_total*100:.1f}%")

    # Save to test checkpoint
    save_path = AI_DIR / "models" / "AASIST_finetuned.pth"
    torch.save(model.state_dict(), save_path)
    print("Saved updated weights to AASIST_finetuned.pth!")

    # Now verify Google Translate right now!
    model.eval()
    print("=== IMMEDIATE VERIFICATION ON GOOGLE TRANSLATE ===")
    gtts_files = sorted(list((synth_dir / "google_translate").glob("*.wav")))
    for f in gtts_files:
        x = torch.from_numpy(slice_into_chunks(load_audio_file(f))[0]).float().unsqueeze(0)
        with torch.no_grad():
            _, logits = model(x)
            probs = torch.softmax(logits, dim=1)
            print(f"{f.name:25} -> Spoof prob (c1): {probs[0,1].item():.4f}")

    print("=== IMMEDIATE VERIFICATION ON REAL VOICE ===")
    for f in sorted(list((real_dir / "eval").glob("real_*.wav"))):
        x = torch.from_numpy(slice_into_chunks(load_audio_file(f))[0]).float().unsqueeze(0)
        with torch.no_grad():
            _, logits = model(x)
            probs = torch.softmax(logits, dim=1)
            print(f"{f.name:25} -> Spoof prob (c1): {probs[0,1].item():.4f} (Real prob c0: {probs[0,0].item():.4f})")

if __name__ == "__main__":
    run()
