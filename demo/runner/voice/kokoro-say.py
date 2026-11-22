"""Speak stdin into a WAV with Kokoro (kokoro-onnx). Called by demo/runner/tts.mjs.

    kokoro-say.py <model.onnx> <voices.bin> <voice> <speed> <out.wav>  < text

Writes 16-bit mono at Kokoro's own rate (24 kHz); the runner resamples to 48 kHz.
"""
import sys
import wave

import numpy as np
from kokoro_onnx import Kokoro

model, voices, voice, speed, out = sys.argv[1:6]
text = sys.stdin.read().strip()
samples, rate = Kokoro(model, voices).create(text, voice=voice, speed=float(speed), lang="en-us")
pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
with wave.open(out, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes(pcm)
