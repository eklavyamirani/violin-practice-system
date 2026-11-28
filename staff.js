// The drill's notes on a treble staff, so a scale run is also sight-reading practice.
// Pitch only: noteheads without stems, since most drills have no written rhythm (rhythm drills show theirs in the lanes above).
// Accidentals: the key signature comes from the drill's key (minor keys use the natural-minor signature). A note that
// differs from it always shows its accidental; a note that goes back to the signature after an altered one on the same
// line or space gets a courtesy accidental (A melodic minor coming down: G♮ after G♯). No key → no signature, same rule.
// Works in the browser (window.Staff) and in Node (module.exports) for testing.
(function (root) {
  const LETTERS = "CDEFGAB";
  const ACC = { "": 0, "♯": 1, "♭": -1, "𝄪": 2, "𝄫": -2 };
  // Diatonic step = octave * 7 + letter (C4 = 28). The treble staff's lines run E4 (30) to F5 (38).
  const BOTTOM = 30, TOP = 38;
  // Where each sharp and flat of a key signature sits on the treble staff
  const SHARP_ORDER = [[3, 38], [0, 35], [4, 39], [1, 36], [5, 33], [2, 37], [6, 34]]; // F5 C5 G5 D5 A4 E5 B4
  const FLAT_ORDER = [[6, 34], [2, 37], [5, 33], [1, 36], [4, 32], [0, 35], [3, 31]]; // B4 E5 A4 D5 G4 C5 F4

  // Glyph outlines from the Bravura font (© Steinberg Media Technologies GmbH, SIL Open Font License 1.1),
  // converted from VexFlow 4.2.5's src/fonts/bravura_glyphs.ts. Units: 360 = one staff space; y = 0 is the note's line
  // (the G line for the clef).
  const G = {
    "clef": { w: 966, d: "M541 -598C539 -615 541 -616 550 -625C706 -770 824 -953 824 -1174C824 -1299 789 -1423 730 -1509C708 -1541 671 -1581 655 -1581C635 -1581 590 -1544 562 -1512C455 -1394 420 -1214 420 -1064C420 -981 431 -887 441 -828C444 -811 445 -808 428 -793C220 -622 0 -416 0 -125C0 125 171 363 524 363C557 363 595 360 624 354C639 351 642 350 645 367C662 464 684 589 684 657C684 870 540 896 455 896C377 896 340 873 340 854C340 844 353 840 386 829C431 816 482 778 482 694C482 615 432 547 344 547C248 547 190 624 190 713C190 806 246 948 464 948C560 948 747 904 747 660C747 577 721 441 706 351C703 334 704 336 724 327C870 269 966 147 966 -16C966 -200 831 -363 619 -363C582 -363 582 -363 577 -389ZM677 -1358C724 -1358 763 -1319 763 -1240C763 -1080 626 -950 513 -851C503 -842 497 -844 494 -863C488 -900 485 -949 485 -995C485 -1220 589 -1358 677 -1358ZM520 -377C524 -350 524 -351 498 -343C372 -300 289 -186 289 -63C289 66 357 158 455 192C467 196 484 200 494 200C505 200 511 193 511 184C511 174 500 170 490 166C429 140 386 78 386 12C386 -71 442 -132 530 -157C553 -163 556 -161 559 -145L631 284C634 300 632 300 611 304C588 308 559 311 530 311C278 311 115 171 115 -29C115 -114 130 -228 249 -363C336 -459 402 -513 469 -567C484 -579 487 -577 490 -562ZM619 -148C616 -166 618 -170 635 -168C752 -158 848 -60 848 66C848 157 793 230 713 271C696 279 693 279 690 262Z" },
    "1": { w: 359, d: "M341 -170C351 -174 359 -186 359 -194L359 -297C359 -304 354 -308 348 -308C346 -308 344 -308 341 -307C341 -307 312 -295 305 -294C295 -294 285 -301 285 -312L285 -488C285 -497 276 -504 265 -504C251 -504 242 -497 242 -488L242 -301C240 -287 236 -268 223 -259C206 -249 157 -229 132 -223C120 -223 115 -240 115 -252L115 -425C115 -433 105 -441 95 -441C81 -441 72 -433 72 -425L72 -230C72 -210 63 -196 55 -192C46 -187 17 -176 17 -176C7 -173 0 -161 0 -153L0 -50C0 -42 4 -37 13 -37L16 -39C17 -39 39 -48 50 -53L52 -55C63 -55 72 -40 72 -29L72 114C72 130 65 143 56 147C48 150 17 163 17 163C7 166 0 177 0 186L0 288C0 297 4 301 13 301L16 300C17 300 37 291 50 287C52 285 53 285 55 285C65 285 72 301 72 308L72 485C72 494 81 501 91 501C105 501 115 494 115 485L115 285C115 266 122 256 130 253L217 217C217 217 219 217 219 217L222 216C235 216 242 233 242 242L242 422C242 431 251 438 261 438C276 438 285 431 285 422L285 217C285 206 291 189 301 184C311 180 341 168 341 168C351 164 359 153 359 144L359 42C359 35 354 30 348 30C346 30 344 30 341 32L304 46C295 46 285 37 285 20L285 -114C285 -124 292 -151 304 -156ZM242 65C233 94 166 122 132 122C124 122 117 120 115 115C112 109 111 78 111 43C111 -1 112 -52 115 -63C118 -88 184 -118 220 -118C230 -118 239 -115 242 -109C245 -102 248 -66 248 -27C248 12 245 52 242 65Z" },
    "-1": { w: 325, d: "M17 245C22 251 26 252 30 252C35 252 39 249 39 249C82 225 117 186 153 161C281 72 325 -16 325 -82C325 -164 262 -216 196 -220C171 -220 137 -209 117 -196C108 -189 92 -176 85 -176C82 -176 81 -176 78 -177C68 -181 62 -192 62 -202C63 -233 72 -579 72 -608C72 -624 59 -632 45 -632C24 -632 1 -618 0 -592C0 -592 6 230 17 245ZM68 117C68 117 63 30 63 -27C63 -50 65 -68 66 -73C76 -102 134 -144 167 -144C209 -144 226 -96 226 -60C226 17 160 95 98 134C92 137 88 138 84 138C71 138 68 124 68 117Z" },
    "0": { w: 242, d: "M203 -261C200 -261 199 -259 197 -259C197 -259 105 -226 68 -226C59 -226 53 -228 53 -233L53 -474C53 -484 45 -491 36 -491L17 -491C7 -491 0 -484 0 -474L0 268C0 276 4 281 13 281L16 279C17 279 20 279 22 278C42 269 122 235 164 235C179 235 189 239 189 251L189 465C189 475 196 482 206 482L225 482C233 482 242 475 242 465L242 -258C242 -265 236 -269 230 -269C229 -269 226 -269 225 -268ZM53 -56C53 -76 141 -114 176 -114C184 -114 189 -112 189 -107L189 42C189 68 107 101 71 101C60 101 53 98 53 92Z" },
    "2": { w: 356, d: "M274 46C258 37 206 9 206 -1C206 -22 253 -43 274 -50C275 -50 276 -50 278 -50L287 -49C304 -49 331 -52 346 -63C353 -71 356 -92 356 -115C356 -174 351 -183 292 -183C266 -183 240 -180 233 -173C228 -168 226 -143 226 -117C219 -101 196 -49 179 -49C158 -49 135 -96 130 -117C130 -141 125 -167 118 -173C112 -180 89 -183 66 -183C42 -183 16 -180 7 -173C3 -170 0 -145 0 -120C0 -94 3 -68 7 -63C17 -55 43 -49 68 -49C73 -49 78 -50 82 -50C98 -42 150 -13 150 -3C150 16 104 39 84 46L69 46C43 46 16 49 7 56C3 60 0 85 0 111C0 137 3 163 7 166C17 174 40 180 65 180C86 180 109 176 118 166C127 158 130 134 130 111C130 109 131 107 132 105C141 85 158 45 177 45C196 45 220 91 226 111C226 137 228 161 233 166C243 174 266 180 291 180C346 180 356 166 356 114C356 89 351 63 346 56C338 49 312 46 288 46Z" },
    "-2": { w: 592, d: "M452 -217C426 -217 408 -207 384 -194C374 -189 363 -176 350 -176C347 -176 344 -176 343 -177C333 -180 328 -190 328 -202C328 -232 337 -579 337 -606C337 -622 324 -629 310 -629C291 -629 268 -616 265 -592C265 -592 266 -395 269 -194C248 -209 223 -217 196 -217L187 -217C160 -217 143 -207 120 -194C108 -189 98 -176 85 -176C82 -176 81 -176 78 -177C68 -180 62 -190 62 -202C62 -232 72 -579 72 -606C72 -622 59 -629 45 -629C24 -629 1 -616 0 -592C0 -592 7 232 17 245C22 251 26 252 30 252C35 252 39 249 39 249C84 226 120 186 153 161C206 124 246 85 274 50C276 158 279 240 284 245C288 251 292 252 295 252C300 252 304 249 304 249C348 226 383 186 416 163C546 72 592 -16 592 -82C592 -163 528 -216 461 -217ZM96 134C92 137 86 138 84 138C72 138 68 124 68 115C68 115 63 30 63 -26C63 -49 65 -66 66 -72C75 -101 134 -144 168 -144C212 -144 226 -95 226 -59C226 22 161 94 96 134ZM361 134C356 137 351 138 348 138C337 138 333 124 333 115C333 115 328 16 328 -39C328 -55 328 -68 330 -72C338 -101 399 -144 433 -144C448 -144 459 -140 468 -130C481 -112 490 -88 490 -59C490 22 426 94 361 134Z" },
    "head": { w: 425, d: "M140 180C268 180 425 62 425 -60C425 -134 367 -180 285 -180C127 -180 0 -63 0 60C0 135 62 180 140 180Z" },
  };

  // "F♯" / oct 5 → { letter: 3, acc: 1, step: 38 }
  function parse(it) {
    const letter = LETTERS.indexOf(it.label[0]), acc = ACC[it.label.slice(1)];
    if (letter < 0 || acc === undefined) return null;
    return { letter, acc, step: it.oct * 7 + letter };
  }

  // Signature accidental per letter (C..B), from Scales.spell(...).acc of the key's major or natural-minor form
  function signature(sigAcc) {
    const sharps = SHARP_ORDER.filter(([l]) => sigAcc[l] === 1), flats = FLAT_ORDER.filter(([l]) => sigAcc[l] === -1);
    return sharps.length ? sharps.map(([letter, step]) => ({ letter, acc: 1, step })) : flats.map(([letter, step]) => ({ letter, acc: -1, step }));
  }

  // The accidental to print in front of each note (null for none). sigAcc null → no key signature (C major's).
  function accidentals(items, sigAcc) {
    const sig = sigAcc || [0, 0, 0, 0, 0, 0, 0], last = {};
    return items.map((it) => {
      const p = parse(it);
      if (!p) return null;
      const prev = last[p.step];
      last[p.step] = p.acc;
      if (p.acc !== sig[p.letter]) return p.acc;
      return prev !== undefined && prev !== p.acc ? p.acc : null;
    });
  }

  const S = 10, K = S / 360, COL = 30, X0 = 22, HEAD_W = G.head.w * K;
  const ZOOM = 1.6; // drawn larger than the viewBox so it reads from the music stand
  const num = (v) => +v.toFixed(2);
  const glyph = (g, x, y, cls = "") => `<path${cls ? ` class="${cls}"` : ""} transform="translate(${num(x)} ${num(y)}) scale(${num(K)})" d="${G[g].d}"/>`;

  // { head: clef + key signature SVG, body: notes SVG, x: centre of note i in the body, width, height } (sizes in CSS px)
  function render(items, opts = {}) {
    const ps = items.map(parse), steps = ps.filter(Boolean).map((p) => p.step);
    const hi = Math.max(41, ...steps.map((s) => s + 2)), lo = Math.min(26, ...steps.map((s) => s - 2));
    const H = (hi - lo) * S / 2 + 8, y = (step) => 4 + (hi - step) * S / 2;
    const lines = (w) => [BOTTOM, 32, 34, 36, TOP].map((s) => `<line class="sl" x1="0" x2="${w}" y1="${y(s)}" y2="${y(s)}"/>`).join("");

    const sig = opts.sigAcc ? signature(opts.sigAcc) : [];
    const hw = 40 + sig.length * 9 + 4;
    const head = `<svg class="sh" viewBox="0 0 ${hw} ${H}" width="${hw * ZOOM}" height="${H * ZOOM}" aria-hidden="true">${lines(hw)}${glyph("clef", 6, y(32))}${sig.map((a, i) => glyph(a.acc, 40 + i * 9, y(a.step))).join("")}</svg>`;

    const accs = accidentals(items, opts.sigAcc || null);
    const W = X0 + items.length * COL + 8;
    const notes = items.map((it, i) => {
      const p = ps[i], hx = X0 + i * COL;
      let g = `<rect class="col" x="${hx - COL / 2 + HEAD_W / 2}" y="0" width="${COL}" height="${H}" rx="4"/>`;
      if (!p) return `<g class="sn" data-i="${i}">${g}</g>`;
      for (let s = BOTTOM - 2; s >= p.step; s -= 2) g += `<line class="ll" x1="${num(hx - 4)}" x2="${num(hx + HEAD_W + 4)}" y1="${y(s)}" y2="${y(s)}"/>`;
      for (let s = TOP + 2; s <= p.step; s += 2) g += `<line class="ll" x1="${num(hx - 4)}" x2="${num(hx + HEAD_W + 4)}" y1="${y(s)}" y2="${y(s)}"/>`;
      if (accs[i] !== null) g += glyph(accs[i], hx - G[accs[i]].w * K - 2, y(p.step));
      g += glyph("head", hx, y(p.step));
      return `<g class="sn" data-i="${i}">${g}</g>`;
    }).join("");
    const body = `<svg class="sb" viewBox="0 0 ${W} ${H}" width="${W * ZOOM}" height="${H * ZOOM}" role="img" aria-label="The drill's notes on a treble staff">${lines(W)}${notes}</svg>`;
    return { head, body, x: (i) => (X0 + i * COL + HEAD_W / 2) * ZOOM, width: W * ZOOM, height: H * ZOOM };
  }

  const api = { parse, signature, accidentals, render };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Staff = api;
})(typeof window !== "undefined" ? window : globalThis);
