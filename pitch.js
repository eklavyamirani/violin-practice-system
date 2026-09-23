// McLeod Pitch Method (MPM) pitch detector, tuned for violin notes on the A and E strings.
// Works in the browser (window.PitchDetector) and in Node (module.exports) for testing.
(function (root) {
  function detectPitch(buf, sampleRate, opts) {
    const o = Object.assign({ minFreq: 500, maxFreq: 1800, minRms: 0.01, minClarity: 0.8, k: 0.9 }, opts);
    const n = buf.length;

    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < o.minRms) return { freq: 0, clarity: 0, rms };

    const minTau = Math.max(2, Math.floor(sampleRate / o.maxFreq));
    const maxTau = Math.min(n - 1, Math.ceil(sampleRate / o.minFreq));

    // Normalized square difference function for lags 0..maxTau+1
    const nsdf = new Float32Array(maxTau + 2);
    for (let tau = 0; tau < maxTau + 2; tau++) {
      let acf = 0, m = 0;
      for (let i = 0; i < n - tau; i++) {
        const a = buf[i], b = buf[i + tau];
        acf += a * b;
        m += a * a + b * b;
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }

    // Key maxima: the highest point between each positive-going and negative-going zero crossing
    const peaks = [];
    let tau = 1;
    while (tau < maxTau + 1 && nsdf[tau] > 0) tau++; // skip the lobe around lag 0
    while (tau < maxTau + 1) {
      while (tau < maxTau + 1 && nsdf[tau] <= 0) tau++;
      let best = -1;
      while (tau < maxTau + 1 && nsdf[tau] > 0) {
        if (best < 0 || nsdf[tau] > nsdf[best]) best = tau;
        tau++;
      }
      if (best > 0) peaks.push(best);
    }
    if (!peaks.length) return { freq: 0, clarity: 0, rms };

    let globalMax = 0;
    for (const p of peaks) if (nsdf[p] > globalMax) globalMax = nsdf[p];
    const threshold = o.k * globalMax;
    const chosen = peaks.find((p) => nsdf[p] >= threshold && p >= minTau);
    if (chosen === undefined) return { freq: 0, clarity: 0, rms };

    // Parabolic interpolation around the chosen peak
    const a = nsdf[chosen - 1], b = nsdf[chosen], c = nsdf[chosen + 1];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const period = chosen + shift;
    const clarity = b - 0.25 * (a - c) * shift;
    if (clarity < o.minClarity) return { freq: 0, clarity, rms };
    return { freq: sampleRate / period, clarity, rms };
  }

  const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const api = { detectPitch, freqToMidi, midiToFreq };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PitchDetector = api;
})(this);
