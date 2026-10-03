import sys
import time
from pathlib import Path
from fastapi.testclient import TestClient

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.append(str(CURRENT_DIR))

from main import app

def run_tests():
    print("--- Testing Integrated VoiceGuard AASIST AI Service ---")
    
    with TestClient(app) as client:
        # 1. Test Health Endpoint
        res = client.get("/health")
        assert res.status_code == 200, f"Healthcheck failed: {res.text}"
        data = res.json()
        print(f"[PASS] Healthcheck OK: Model = {data['model']}, Sample Rate = {data['sample_rate']}")
        
        # 2. Test Audio Chunk Endpoint with Real WAV Audio
        sample_real_path = CURRENT_DIR / "data" / "eval" / "real_01.wav"
        if not sample_real_path.exists():
            sample_real_path = CURRENT_DIR / "data" / "real_01.mpeg"
            
        with open(sample_real_path, "rb") as f:
            audio_bytes = f.read()[:64600 * 2]  # ~4 seconds of 16-bit PCM/WAV
            
        files = {"file": ("chunk.wav", audio_bytes, "audio/wav")}
        res = client.post("/api/analyze/chunk", files=files)
        assert res.status_code == 200, f"Chunk analysis failed: {res.text}"
        chunk_data = res.json()
        print(f"[PASS] Real Audio Chunk Analysis:")
        print(f"       Risk Level: {chunk_data['risk_level']}")
        print(f"       Verdict:    {chunk_data['verdict']}")
        print(f"       Spoof %:    {chunk_data['spoof_percentage']}%")
        print(f"       Inference:  {chunk_data['inference_time_ms']} ms")
        assert chunk_data["risk_level"] == "LOW", f"Expected LOW risk for real audio, got {chunk_data['risk_level']}"
        
        # 3. Test Audio Chunk Endpoint with Cloned/Fake Audio
        sample_fake_path = CURRENT_DIR / "data" / "eval" / "fake_011.wav"
        with open(sample_fake_path, "rb") as f:
            fake_bytes = f.read()[:64600 * 2]
            
        files_fake = {"file": ("chunk.wav", fake_bytes, "audio/wav")}
        res_fake = client.post("/api/analyze/chunk", files=files_fake)
        assert res_fake.status_code == 200, f"Fake chunk analysis failed: {res_fake.text}"
        fake_data = res_fake.json()
        print(f"[PASS] Cloned Audio Chunk Analysis:")
        print(f"       Risk Level: {fake_data['risk_level']}")
        print(f"       Verdict:    {fake_data['verdict']}")
        print(f"       Spoof %:    {fake_data['spoof_percentage']}%")
        print(f"       Inference:  {fake_data['inference_time_ms']} ms")
        assert fake_data["risk_level"] == "HIGH", f"Expected HIGH risk for fake audio, got {fake_data['risk_level']}"
        
        # 4. Multi-Platform AI Voice Detection Verification Tests
        test_cases = [
            ("Google Translate Voice", list((CURRENT_DIR / "data" / "synthetic" / "google_translate").glob("*.wav"))),
            ("Google Voice Mic Recording", list((CURRENT_DIR / "data" / "synthetic" / "google_voice_mic").glob("*.wav"))),
            ("Acoustic Replayed Voice", list((CURRENT_DIR / "data" / "synthetic" / "replayed_acoustic").glob("*.wav"))),
            ("ElevenLabs / ChatGPT Voice", list((CURRENT_DIR / "data" / "synthetic" / "elevenlabs_chatgpt").glob("*.wav"))),
            ("Microsoft Edge / Azure Voice", list((CURRENT_DIR / "data" / "synthetic" / "edge_azure").glob("*.wav"))),
            ("RVC Voice Cloner Voice", list((CURRENT_DIR / "data" / "synthetic" / "rvc_voice_cloner").glob("*.wav"))),
            ("ASVspoof 2021 DF Codec Voice", list((CURRENT_DIR / "data" / "synthetic" / "asvspoof2021_df").glob("*.wav"))),
        ]

        for platform_name, file_list in test_cases:
            if file_list:
                sample_file = file_list[0]
                with open(sample_file, "rb") as f:
                    voice_bytes = f.read()[:64600 * 2]
                res_voice = client.post("/api/analyze/chunk", files={"file": ("voice.wav", voice_bytes, "audio/wav")})
                assert res_voice.status_code == 200
                v_data = res_voice.json()
                threshold = 0.60 if "Acoustic" in platform_name else 0.65
                assert v_data["spoof_score"] >= threshold, f"Expected {platform_name} to be detected as spoof (>= {threshold}), got {v_data['spoof_score']}"

        # 5. Test Sample Evaluation Endpoint (Demo Mode)
        res_demo_real = client.post("/api/analyze/sample", json={"sample_type": "real"})
        assert res_demo_real.status_code == 200
        print(f"[PASS] Demo Real Sample Evaluation: {res_demo_real.json()['verdict']} (Spoof Score: {res_demo_real.json()['spoof_score']})")
        
        res_demo_fake = client.post("/api/analyze/sample", json={"sample_type": "clone"})
        assert res_demo_fake.status_code == 200
        print(f"[PASS] Demo Cloned Sample Evaluation: {res_demo_fake.json()['verdict']} (Spoof Score: {res_demo_fake.json()['spoof_score']})")
        
    print("\n============================================================")
    print("[SUCCESS] ALL AASIST AI INTEGRATION API TESTS PASSED PERFECTLY!")
    print("============================================================\n")


if __name__ == "__main__":
    run_tests()
