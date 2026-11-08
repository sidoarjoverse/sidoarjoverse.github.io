# Transkrip rekaman + waktu per kata (faster-whisper). Pakai: python3 -I alat/transkrip.py <folder-model> video/<nama>/vo_semua.wav [naskah.txt]
import sys, json
from faster_whisper import WhisperModel
M = WhisperModel(sys.argv[1], device='cpu', compute_type='int8', cpu_threads=8)
prompt = open(sys.argv[3]).read()[:800] if len(sys.argv) > 3 else None
import subprocess, numpy as np
pcm = subprocess.run(['ffmpeg','-v','error','-i',sys.argv[2],'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
segs, info = M.transcribe(audio, language='id', word_timestamps=True, initial_prompt=prompt, beam_size=5, vad_filter=False)
out = []
for s in segs:
    out.append({'a': round(s.start, 2), 'b': round(s.end, 2), 't': s.text.strip(), 'w': [[round(w.start, 2), round(w.end, 2), w.word] for w in s.words]})
    print(f'{s.start:6.2f}-{s.end:6.2f} {s.text.strip()}', flush=True)
json.dump(out, open(sys.argv[2].rsplit('.', 1)[0] + '.stt.json', 'w'), ensure_ascii=False, indent=0)
