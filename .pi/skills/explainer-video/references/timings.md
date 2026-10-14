# Word timings

Target format (`words.json`): `[{ "t": "word,", "s": 0.14, "e": 0.30 }, ...]` (seconds, punctuation kept on the word).

## ElevenLabs (default)
`scripts/tts.mjs` calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`
and converts the character alignment (`characters`, `character_start_times_seconds`,
`character_end_times_seconds`) into words. Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps

## Local faster-whisper (any audio file)
```bash
pip install faster-whisper
python3 - <<'PY'
import json
from faster_whisper import WhisperModel
m = WhisperModel("small.en", compute_type="int8")
segs, _ = m.transcribe("public/vo.mp3", word_timestamps=True)
out = [{"t": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
json.dump(out, open("public/words.json", "w"))
PY
```
Whisper may spell numbers differently from your script; when anchoring visuals with `at()`, use words that appear verbatim.
