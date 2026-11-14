"""Generate a quiet original ambient sketch. No third-party samples."""
from array import array
from pathlib import Path
import math
import wave

rate = 22050
duration = 152
chords = [(130.8128,164.8138,195.9977,246.9417), (110,130.8128,164.8138,195.9977), (87.3071,130.8128,164.8138,220), (97.9989,146.8324,195.9977,220)]
result = array('h')
beat = 60 / 96
for i in range(rate * duration):
    t = i / rate
    chord_index = int(t // 10) % len(chords)
    chord = chords[chord_index]
    phase = t % 10
    env = min(1, phase / 0.7, (10 - phase) / 0.7)
    pad = sum(math.sin(2 * math.pi * f * t) + 0.15 * math.sin(2 * math.pi * f * 2.003 * t) for f in chord) * 0.032 * env
    step = int(t / (beat / 2))
    note = chord[[0,2,1,3,2,1,3,2][step % 8]] * 2
    note_time = t % (beat / 2)
    pluck = (math.sin(2 * math.pi * note * note_time) + 0.12 * math.sin(2 * math.pi * note * 3 * note_time)) * math.exp(-note_time * 15) * min(1, note_time / 0.006) * 0.10
    pulse = t % beat
    kick = math.sin(2 * math.pi * (48 * pulse + 2.5 * (1 - math.exp(-pulse * 20)))) * math.exp(-pulse * 20) * 0.045
    fade = min(1, t / 3, (duration - t) / 4)
    sample = (pad + pluck + kick) * max(0, fade)
    result.append(round(max(-1, min(1, sample)) * 32767))
output = Path(__file__).resolve().parents[1] / 'public/audio/draft-bed.wav'
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(rate)
    f.writeframes(result.tobytes())
print(output)
