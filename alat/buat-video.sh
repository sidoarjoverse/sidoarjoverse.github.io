#!/bin/bash
# Buat video lengkap dari video/<nama>/naskah.json  →  video/<nama>/<nama>.mp4 + cover.jpg
# Pakai (dari folder repo): bash alat/buat-video.sh video/<nama>
set -e
DIR=${1%/}; NAMA=$(basename "$DIR")
cd "$(dirname "$0")/.."
# naskah "tanpaSuara": true → video sinematik tanpa VO (timeline.json & vo_track.wav sunyi dibuat sendiri)
if grep -q '"tanpaSuara": true' "$DIR/naskah.json"; then :; elif [ -f "$DIR/baris.json" ]; then python3 alat/rekaman.py "$DIR"; else python3 alat/suara.py "$DIR" ${SUARA_OPSI:-}; fi
pgrep -f "http.server 8080" >/dev/null || (timeout 3600 python3 -m http.server 8080 >/dev/null 2>&1 &); sleep 1
node alat/render.js "$DIR"
python3 alat/audio.py "$DIR"
ffmpeg -v error -y -framerate 30 -i "$DIR/frames/f%05d.jpg" -i "$DIR/audio_final.wav" -c:v libx264 -preset medium -crf 19 \
  -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 192k -shortest "$DIR/SidoarjoVerse-$NAMA.mp4"
DUR=$(python3 -c "import json;print(json.load(open('$DIR/timeline.json'))['segmen'][1]['start']+1.2)")
ffmpeg -v error -y -ss "$DUR" -i "$DIR/SidoarjoVerse-$NAMA.mp4" -frames:v 1 -q:v 2 "$DIR/cover.jpg"
# Cover otomatis: isi "sampul": {"t": detik_latar, "badge": "EPISODE 14", "chips": [...], "judul": "..."} di naskah.json
if python3 -c "import json,sys;sys.exit(0 if json.load(open('$DIR/naskah.json')).get('sampul') else 1)"; then
  Q=$(python3 -c "
import json;s=json.load(open('$DIR/naskah.json'))['sampul']
s.setdefault('badgeAtas','SIDOARJOVERSE');s['bg']='sampul-latar.jpg';print(json.dumps({k:v for k,v in s.items() if k!='t'}))")
  T=$(python3 -c "import json;print(json.load(open('$DIR/naskah.json'))['sampul'].get('t',$DUR))")
  ffmpeg -v error -y -ss "$T" -i "$DIR/SidoarjoVerse-$NAMA.mp4" -frames:v 1 -q:v 2 "$DIR/sampul-latar.jpg"
  node alat/sampul.js "$DIR" "$Q"
  # Versi YouTube Shorts: cover tampil 1 detik di awal (Shorts tidak bisa pasang thumbnail sendiri)
  ffmpeg -v error -y -loop 1 -t 1 -i "$DIR/sampul.jpg" -f lavfi -t 1 -i anullsrc=r=48000:cl=stereo -i "$DIR/SidoarjoVerse-$NAMA.mp4" \
    -filter_complex "[0:v]scale=1080:1920,fps=30,format=yuv420p,setsar=1[c];[2:v]setsar=1[v];[c][1:a][v][2:a]concat=n=2:v=1:a=1[ov][oa]" \
    -map "[ov]" -map "[oa]" -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$DIR/SidoarjoVerse-$NAMA-shorts.mp4"
  echo "SAMPUL: $DIR/sampul.jpg  |  SHORTS: $DIR/SidoarjoVerse-$NAMA-shorts.mp4"
fi
# Versi ringan 720p untuk dikirim ke pemilik
ffmpeg -v error -y -i "$DIR/SidoarjoVerse-$NAMA.mp4" -vf scale=720:-2 -c:v libx264 -crf 27 -maxrate 3M -bufsize 6M -c:a aac -b:a 128k -movflags +faststart "$DIR/SidoarjoVerse-$NAMA-kecil.mp4"
echo "SELESAI: $DIR/SidoarjoVerse-$NAMA.mp4"
