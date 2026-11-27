// Piece tab layouts, chosen by window width only: a pill (< 200 px) and a compact tuner (200–450 px) for playing with the
// app in a small window over the sheet music, and the full view (> 450 px) with a review timeline after each take.
// The recording itself (`piece` in index.html) never lives in the view: every layout renders from the same model, so
// resizing mid-take changes nothing but what's drawn. The pure helpers at the top also run in Node for the tests.
(function (root) {
  const PieceIO = typeof module !== "undefined" && module.exports ? require("./piece.js") : root.PieceIO;
  const PILL = 200, FULL = 450, HYST = 8;

  // A window parked right on a boundary would flip back and forth as Stage Manager settles; stay put within 8 px of it
  function pickLayout(w, cur) {
    if (cur === "pill" && w < PILL + HYST) return "pill";
    if (cur === "compact" && w >= PILL - HYST && w <= FULL + HYST) return "compact";
    if (cur === "full" && w > FULL - HYST) return "full";
    return w < PILL ? "pill" : w <= FULL ? "compact" : "full";
  }
  // Same rule as colorFor in index.html
  const tone = (absC, tol) => (absC <= tol ? "good" : absC <= tol * 2 ? "near" : "bad");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Needle and tempo bar positions in % of their track: ±50¢, ±15%
  const needlePct = (cents) => 50 + clamp(cents, -50, 50);
  const DRIFT_RANGE = 15, DRIFT_OK = 4;
  const driftFill = (pct) => { const v = (clamp(pct, -DRIFT_RANGE, DRIFT_RANGE) / DRIFT_RANGE) * 50; return { left: v < 0 ? 50 + v : 50, width: Math.abs(v) }; };

  // Tempo over a saved take, as % (> 0 faster): the player's own pulse curve, or the drift against the click
  function tempoCurve(r) {
    if (r.timing && r.timing.tempoCurve && r.timing.tempoCurve.length) return r.timing.tempoCurve.map((c) => ({ t: c.t, pct: c.pct }));
    if (!r.metronome) return [];
    const beatMs = 60000 / r.metronome.bpm, q = beatMs / (r.metronome.subdivision || 1);
    const pts = r.notes.filter((n) => n.timingMs !== undefined).map((n) => ({ t: n.t * 1000, off: n.timingMs }));
    return PieceIO.clickDriftCurve(pts, q, 6 * beatMs).map((c) => ({ t: c.t / 1000, pct: c.pct }));
  }
  // One number for the whole take: against the click, the overall drift; without it, end pulse against start pulse
  function takeDrift(r) {
    const T = r.timing || {};
    if (r.metronome) {
      const q = 60000 / r.metronome.bpm / (r.metronome.subdivision || 1);
      return PieceIO.clickDrift(r.notes.filter((n) => n.timingMs !== undefined).map((n) => ({ t: n.t * 1000, off: n.timingMs })), q);
    }
    return T.startPulsePerMin && T.endPulsePerMin ? Math.round((T.endPulsePerMin / T.startPulsePerMin - 1) * 1000) / 10 : null;
  }

  // What the review timeline shows, in seconds from the start of the take
  function review(r) {
    const tol = r.toleranceCents;
    const notes = r.notes.map((n) => ({ t: n.t, dur: n.durMs / 1000, cents: n.cents, tone: n.cents === null ? null : tone(Math.abs(n.cents), tol) }));
    const last = notes[notes.length - 1];
    const dur = Math.max(r.summary.durationSec || 0, last ? last.t + last.dur : 0, 1);
    const pins = r.moments.map((m, i) => {
      const n = notes.find((x) => Math.abs(x.t - m.t) < 0.06);
      const tn = n && n.tone && n.tone !== "good" && /¢/.test(m.what) ? n.tone : "near";
      return { n: i + 1, t: m.t, at: m.at, what: m.what, tone: tn };
    });
    return { dur, notes, pins, tempo: tempoCurve(r), tol };
  }
  // A tap on the lanes picks the nearest pin within a fingertip (22 px either side), or nothing
  function nearestPin(xs, x, r = 22) {
    let best = -1, d = Infinity;
    xs.forEach((px, i) => { const e = Math.abs(px - x); if (e <= r && e < d) { d = e; best = i; } });
    return best;
  }

  // Pins closer than a fingertip apart would overlap: push them apart (left to right, then back from the right edge)
  function spreadPins(xs, gap = 44, lo = 0, hi = Infinity) {
    const out = xs.slice();
    for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], lo, i ? out[i - 1] + gap : -Infinity);
    for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], hi, i < out.length - 1 ? out[i + 1] - gap : Infinity);
    return out;
  }

  const api = { PILL, FULL, HYST, pickLayout, tone, needlePct, driftFill, tempoCurve, takeDrift, review, nearestPin, spreadPins };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---------- Browser ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const TONE_VAR = { good: "--good", near: "--near", bad: "--bad" };
  const clockOf = (ms) => PieceIO.clock(ms);
  const model = { state: "idle", since: 0, note: null, oct: null, cents: null, tol: 15, heardAt: 0, drift: null, target: "", take: null };
  let hooks = null, layout = null, tab = null, swapTimer = 0;

  // Canvases keep their bitmap at the element's size × devicePixelRatio and redraw whenever either changes
  const canvases = new Map();
  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }
  // Work happens on the next frame, not inside the observer: resizing a canvas there would report a ResizeObserver loop
  const canvasRO = typeof ResizeObserver !== "undefined" ? new ResizeObserver((es) => requestAnimationFrame(() => es.forEach((e) => { const f = canvases.get(e.target); if (f) f(); }))) : null;
  function watchCanvas(cv, draw) { if (!cv) return; canvases.set(cv, draw); canvasRO && canvasRO.observe(cv); }
  function unwatchCanvas(cv) { canvases.delete(cv); canvasRO && canvasRO.unobserve(cv); }
  // Moving the window to a screen with another pixel ratio (or zooming) changes dpr without a resize
  (function watchDpr() {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener("change", () => { canvases.forEach((f) => f()); watchDpr(); }, { once: true });
  })();

  function setLayout(next) {
    if (next === layout) return;
    const first = layout === null;
    layout = next;
    tab.dataset.layout = next;
    document.body.classList.toggle("pc-widget", tab.classList.contains("active") && next !== "full");
    if (!first && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      tab.classList.remove("pcw-swap"); void tab.offsetWidth; tab.classList.add("pcw-swap");
      clearTimeout(swapTimer); swapTimer = setTimeout(() => tab.classList.remove("pcw-swap"), 200);
    }
    render();
    if (next === "full" && hooks.redrawRoll) hooks.redrawRoll();
  }
  // The window's width, scrollbar included, so a scrollbar coming or going with the layout doesn't move the choice
  const width = () => window.innerWidth || document.documentElement.clientWidth;

  function render() {
    if (!tab) return;
    const m = model, rec = m.state === "rec" || m.state === "countin";
    tab.dataset.state = m.state;
    $$("[data-k=clock]", tab).forEach((el) => { el.textContent = m.state === "countin" ? `−${Math.ceil(-m.since / 1000)}` : clockOf(Math.max(0, m.since)); el.classList.toggle("cnt", m.state === "countin"); });
    // The dot holds through short rests and goes hollow after 1.5 s without a note
    const fresh = rec && m.cents !== null && performance.now() - m.heardAt < 1500;
    const tn = fresh ? tone(Math.abs(m.cents), m.tol) : null;
    const dir = tn && tn !== "good" ? (m.cents > 0 ? "up" : "down") : "";
    $$("[data-k=dot]", tab).forEach((el) => { el.dataset.tone = tn || ""; el.dataset.dir = dir; el.setAttribute("aria-label", !tn ? "No note" : tn === "good" ? "In tune" : m.cents > 0 ? "Sharp" : "Flat"); });
    $$("[data-k=note]", tab).forEach((el) => { el.innerHTML = fresh && m.note ? `${m.note}<sub>${m.oct}</sub>` : m.state === "analysing" ? "…" : "—"; });
    $$("[data-k=cents]", tab).forEach((el) => { const c = fresh ? Math.round(m.cents) : 0; el.textContent = fresh ? `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)}¢` : ""; el.dataset.tone = tn || ""; });
    $$("[data-k=needle]", tab).forEach((el) => { el.style.left = needlePct(fresh ? m.cents : 0) + "%"; el.dataset.tone = tn || ""; el.style.opacity = fresh ? 1 : 0; });
    $$("[data-k=zone]", tab).forEach((el) => { el.style.width = 2 * clamp(m.tol, 0, 50) + "%"; });
    $$("[data-k=target]", tab).forEach((el) => { el.textContent = m.target; });
    const d = rec ? m.drift : null;
    $$("[data-k=drift]", tab).forEach((el) => { const v = d === null ? 0 : Math.round(d.pct); el.textContent = d === null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`; el.dataset.tone = d === null ? "" : Math.abs(d.pct) <= DRIFT_OK ? "good" : "near"; });
    $$("[data-k=fill]", tab).forEach((el) => { const f = driftFill(d ? d.pct : 0); el.style.left = f.left + "%"; el.style.width = f.width + "%"; el.dataset.tone = d && Math.abs(d.pct) > DRIFT_OK ? "near" : "good"; el.dataset.side = d && d.pct < 0 ? "l" : "r"; });
    // Controls
    $$("[data-act=rec]", tab).forEach((b) => { b.dataset.on = rec ? "1" : ""; b.disabled = m.state === "analysing"; b.setAttribute("aria-label", rec ? "Stop and analyse" : "Start recording"); });
    const audio = m.take && m.take.audio;
    $$("[data-act=play]", tab).forEach((b) => { b.disabled = rec || !audio; b.dataset.on = audio && !audio.paused ? "1" : ""; b.setAttribute("aria-label", audio && !audio.paused ? "Pause" : "Play the last take"); });
    // After a take: how it went, at a glance
    const r = m.take && m.take.report;
    $$("[data-k=pct]", tab).forEach((el) => { el.textContent = r && r.summary.inTunePct !== undefined ? r.summary.inTunePct + "%" : "—"; el.dataset.tone = r && r.summary.inTunePct !== undefined ? (r.summary.inTunePct >= 80 ? "good" : r.summary.inTunePct >= 60 ? "near" : "bad") : ""; });
    const td = r ? takeDrift(r) : null;
    $$("[data-k=takeDrift]", tab).forEach((el) => { const v = Math.round(td || 0); el.textContent = td === null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`; el.dataset.tone = td === null ? "" : Math.abs(td) <= DRIFT_OK ? "good" : "near"; });
    $$("[data-k=takeFill]", tab).forEach((el) => { const f = driftFill(td || 0); el.style.left = f.left + "%"; el.style.width = f.width + "%"; el.dataset.tone = td !== null && Math.abs(td) > DRIFT_OK ? "near" : "good"; el.dataset.side = td < 0 ? "l" : "r"; });
  }

  // Every note of the last take as a tick, height by how far off it was
  function drawStrip() {
    const cv = $("#pcwStrip");
    if (!cv || !cv.clientWidth) return;
    const { g, w, h } = fitCanvas(cv);
    g.clearRect(0, 0, w, h);
    const r = model.take && model.take.report;
    g.fillStyle = css("--line"); g.fillRect(0, h / 2 - 1, w, 2);
    if (!r) return;
    const ns = r.notes.filter((n) => n.cents !== null);
    if (!ns.length) return;
    const step = w / ns.length, bw = Math.max(1, Math.min(10, step - 2));
    ns.forEach((n, i) => {
      const a = Math.abs(n.cents), bh = clamp(6 + a * 2, 6, h - 8);
      g.fillStyle = css(TONE_VAR[tone(a, r.toleranceCents)]);
      g.fillRect(Math.round(i * step + (step - bw) / 2), Math.round((h - bh) / 2), bw, Math.round(bh));
    });
  }

  // ---------- Review timeline (full layout) ----------
  const GUTTER = 48, PITCH_H = 150, GAP = 10, TEMPO_H = 80, AXIS_H = 18;
  let rev = null;
  function reviewHTML(hasAudio) {
    return `<div class="pcrev">
      <div class="pcrev-sel" id="pcRevSel" hidden><span class="pcrev-dot"></span><span class="at"></span><b class="lbl"></b>
        ${hasAudio ? `<button class="btn" id="pcRevPlay">▶ Play 3 s</button>` : `<span class="muted small">Recording not kept</span>`}<i class="pcrev-caret"></i></div>
      <div class="pcrev-pins" id="pcRevPins" aria-label="Moments to check"></div>
      <canvas id="pcRevCv" class="pcrev-cv" role="img" aria-label="Intonation and tempo over the take"></canvas>
    </div>`;
  }
  function mountReview(el, report, playFrom) {
    if (rev && rev.cv) unwatchCanvas(rev.cv);
    const v = review(report);
    rev = { v, sel: v.pins.length ? 0 : -1, playFrom, cv: $("#pcRevCv", el), pinsEl: $("#pcRevPins", el), selEl: $("#pcRevSel", el) };
    // Pins sit at % of the plot width, so they follow a resize without any work
    rev.pinsEl.innerHTML = v.pins.map((p, i) => `<button class="pcrev-pin" data-i="${i}" data-tone="${p.tone}" style="left:calc(${(100 * p.t) / v.dur}% - 22px)" aria-label="Moment ${p.n} at ${p.at}: ${p.what.replace(/"/g, "&quot;")}">${p.n}</button>`).join("");
    rev.pinsEl.onclick = (e) => { const b = e.target.closest(".pcrev-pin"); if (b) pick(+b.dataset.i, true); };
    rev.cv.onclick = (e) => {
      const box = rev.cv.getBoundingClientRect(), plotW = box.width - GUTTER - 8;
      const i = nearestPin(rev.v.pins.map((p) => GUTTER + (p.t / rev.v.dur) * plotW), e.clientX - box.left);
      if (i >= 0) pick(i, true);
    };
    const pb = $("#pcRevPlay", el);
    if (pb) pb.onclick = () => rev.sel >= 0 && rev.playFrom && rev.playFrom(rev.v.pins[rev.sel].t);
    watchCanvas(rev.cv, drawReview);
    pick(rev.sel, false);
  }
  function pick(i, play) {
    rev.sel = i;
    $$(".pcrev-pin", rev.pinsEl).forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
    const p = rev.v.pins[i];
    rev.selEl.hidden = !p;
    if (p) {
      $(".pcrev-dot", rev.selEl).dataset.tone = p.tone;
      $(".at", rev.selEl).textContent = p.at;
      $(".lbl", rev.selEl).textContent = p.what;
      $(".pcrev-caret", rev.selEl).style.left = `calc(${GUTTER}px + (100% - ${GUTTER + 8}px) * ${p.t / rev.v.dur} - 8px)`;
      if (play && rev.playFrom) rev.playFrom(p.t);
    }
    drawReview();
  }
  function drawReview() {
    if (!rev || !rev.cv.isConnected || !rev.cv.clientWidth) return;
    const { g, w, h } = fitCanvas(rev.cv);
    const v = rev.v, plotW = w - GUTTER - 8, X = (t) => GUTTER + (t / v.dur) * plotW;
    const px = spreadPins(v.pins.map((p) => (p.t / v.dur) * plotW), 44, 0, plotW);
    $$(".pcrev-pin", rev.pinsEl).forEach((b) => (b.style.left = px[+b.dataset.i] - 22 + "px"));
    const col = { ink: css("--ink"), muted: css("--muted"), line: css("--line"), p2: css("--panel-2"), good: css("--good"), near: css("--near"), bad: css("--bad"), accent: css("--accent") };
    g.clearRect(0, 0, w, h);
    const lane = (y, hh) => { g.fillStyle = col.p2; g.beginPath(); g.roundRect ? g.roundRect(GUTTER, y, plotW, hh, 8) : g.rect(GUTTER, y, plotW, hh); g.fill(); };
    g.font = "600 10px system-ui, sans-serif"; g.textBaseline = "middle";
    const label = (txt, y) => { g.fillStyle = col.muted; g.fillText(txt, 0, y); };
    // Pitch lane: ±50¢, green band at ±tol
    lane(0, PITCH_H);
    const mid = PITCH_H / 2, sc = (mid - 6) / 50, cy = (c) => mid - clamp(c, -50, 50) * sc;
    g.globalAlpha = 0.18; g.fillStyle = col.good; g.fillRect(GUTTER, cy(v.tol), plotW, 2 * v.tol * sc); g.globalAlpha = 1;
    g.fillStyle = col.good; g.globalAlpha = 0.6; g.fillRect(GUTTER, mid - 1, plotW, 2); g.globalAlpha = 1;
    label("SHARP", 8); label("PITCH", mid); label("FLAT", PITCH_H - 8);
    for (const n of v.notes) {
      const x = X(n.t), bw = Math.max(2, (n.dur / v.dur) * plotW - 1);
      if (n.cents === null) { g.fillStyle = col.line; g.fillRect(x, mid - 2, bw, 4); continue; }
      g.fillStyle = col[n.tone]; g.fillRect(x, cy(n.cents) - 3.5, bw, 7);
    }
    // Tempo lane: ±15%, green band at ±4%
    const ty = PITCH_H + GAP, tmid = ty + TEMPO_H / 2, ts = (TEMPO_H / 2 - 4) / DRIFT_RANGE, tyOf = (p) => tmid - clamp(p, -DRIFT_RANGE, DRIFT_RANGE) * ts;
    lane(ty, TEMPO_H);
    g.globalAlpha = 0.18; g.fillStyle = col.good; g.fillRect(GUTTER, tyOf(DRIFT_OK), plotW, 2 * DRIFT_OK * ts); g.globalAlpha = 1;
    g.fillStyle = col.muted; g.fillRect(GUTTER, tmid - 0.5, plotW, 1);
    label("RUSH", ty + 8); label("TEMPO", tmid); label("DRAG", ty + TEMPO_H - 8);
    if (v.tempo.length > 1) {
      g.strokeStyle = col.accent; g.lineWidth = 2.5; g.lineJoin = "round"; g.beginPath();
      v.tempo.forEach((c, i) => (i ? g.lineTo : g.moveTo).call(g, X(c.t), tyOf(c.pct)));
      g.stroke();
    } else { g.fillStyle = col.muted; g.textAlign = "center"; g.fillText(v.notes.length ? "Too few regular notes to follow the tempo" : "", GUTTER + plotW / 2, tmid - 12); g.textAlign = "start"; }
    // Time axis
    const step = v.dur > 240 ? 60 : v.dur > 90 ? 30 : v.dur > 40 ? 10 : 5;
    g.fillStyle = col.muted; g.font = "10px system-ui, sans-serif"; g.textBaseline = "top";
    for (let s = 0; s <= v.dur; s += step) g.fillText(clockOf(s * 1000), X(s), ty + TEMPO_H + 4);
    // Playhead at the selected moment
    const p = v.pins[rev.sel];
    if (p) { g.fillStyle = col.ink; g.fillRect(Math.round(X(p.t)) - 1, 0, 2, ty + TEMPO_H); }
  }

  function init(h) {
    hooks = h;
    tab = $("#tab-piece");
    $$("[data-act=rec]", tab).forEach((b) => (b.onclick = () => (hooks.isRecording() ? hooks.stop() : hooks.start())));
    $$("[data-act=play]", tab).forEach((b) => (b.onclick = () => {
      const a = model.take && model.take.audio;
      if (!a) return;
      if (a.paused) { if (a.ended) a.currentTime = 0; hooks.cancelClip && hooks.cancelClip(); a.play(); } else a.pause();
    }));
    watchCanvas($("#pcwStrip"), drawStrip);
    let queued = false;
    const relayout = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; setLayout(pickLayout(width(), layout)); }); };
    new ResizeObserver(relayout).observe(document.documentElement);
    window.addEventListener("resize", relayout);
    // Switching to and from the Piece tab shows or hides the app header in the small layouts
    new MutationObserver(() => document.body.classList.toggle("pc-widget", tab.classList.contains("active") && layout !== "full")).observe(tab, { attributes: true, attributeFilter: ["class"] });
    setLayout(pickLayout(width(), null));
  }

  root.PieceView = Object.assign(api, {
    init, watchCanvas, reviewHTML, mountReview, layout: () => layout,
    // While recording: the note just heard (cents null when there's none), the clock, and the tempo once a second
    live(o) {
      model.since = o.since;
      if (o.cents !== null) { model.note = o.note; model.oct = o.oct; model.cents = o.cents; model.heardAt = performance.now(); }
      model.tol = o.tol;
      if (model.state === "countin" && o.since >= 0) model.state = "rec";
      render();
    },
    drift(d) { model.drift = d; if (d && d.ref === "pulse" && d.perMin) model.target = `♩ ~${d.perMin}`; render(); },
    // state: countin | rec | analysing | done | idle; with a take on done
    state(s, o = {}) {
      model.state = s;
      if (o.tol) model.tol = o.tol;
      if (s === "rec" || s === "countin") { model.since = s === "countin" ? -1 : 0; model.cents = null; model.drift = null; model.take = null; model.target = o.bpm ? `♩ ${o.bpm}` : ""; }
      render(); drawStrip();
    },
    // The take the compact view summarises and plays: { report, audio }
    take(t) {
      model.take = t;
      if (t && t.audio) ["play", "pause", "ended"].forEach((ev) => t.audio.addEventListener(ev, render));
      if (t) model.tol = t.report.toleranceCents;
      render(); drawStrip();
    },
  });
})(this);
