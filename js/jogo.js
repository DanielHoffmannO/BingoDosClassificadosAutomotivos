// Game data (filled from dados/*.json at startup): cliché id -> card text, and every ad.
// An ad with real: true was saved from Facebook Marketplace; the others are invented.
let PH = {}, ANUNCIOS = [];

// each level sets the clock (0 = no clock), the wrong-click penalty and the win rule
const LV = {
  facil: { name: "Fácil", time: 300, miss: 1, win: "any", hint: true, next: "medio" },
  medio: { name: "Médio", time: 240, miss: 3, win: "any", next: "dificil" },
  dificil: { name: "Difícil", time: 180, miss: 5, win: "full", gain: true, hard: true, next: null }
};
// lines = how many of LINES count (the first 6 are rows and columns, the last 2 diagonals); need = lines to win
const WIN = { row: { lines: 6, need: 1 }, any: { lines: 8, need: 1 }, two: { lines: 8, need: 2 }, full: { lines: 8, need: Infinity } };
const CUSTOM_KEYS = { time: "c-time", win: "c-win", miss: "c-miss", ads: "c-ads", hint: "c-hint" };
function readCustom() {
  const c = {};
  for (const k in CUSTOM_KEYS) { const el = $(CUSTOM_KEYS[k]); c[k] = el.type === "checkbox" ? el.checked : k === "win" ? el.value : +el.value; }
  return c;
}
function levelCfg(lv) { return lv === "custom" ? { name: "Personalizada", next: null, ...readCustom() } : LV[lv]; }
function hasWon() {
  const w = WIN[S.L.win];
  return [...S.lines].filter(li => li < w.lines).length >= w.need;
}
const PTS = { 1: 10, 2: 20, 3: 30 };
// levels with gain: true put seconds back on the clock for each new card phrase, more for the hidden ones
const GAIN = { 1: 10, 2: 15, 3: 20 };
const TIER = { 1: "certinha", 2: "com erro", 3: "disfarçada" };
const PER_GAME = 24; // ads per game when the level doesn't say
// tier of each cliché occurrence: the {id~N:...} mark wins, then the ad's own n, then 1
function tierOf(p, a) { return p.n || a.n || 1; }
// true when the ad has at least one phrase written with a typo, slang or in disguise
function isHard(a) { return [...parse(a.d), ...parse(a.t)].some(p => p.id && tierOf(p, a) >= 2); }
// with hard on (Difícil), up to half of the ads drawn are ones with hard phrases
function draw(pool, n, hard) {
  if (!hard) return shuffle(pool).slice(0, n);
  const h = shuffle(pool.filter(isHard)).slice(0, Math.ceil(n / 2));
  return h.concat(shuffle(pool.filter(a => !h.includes(a))).slice(0, n - h.length));
}
// "reais" / "inventados" take only that kind; "misturados" takes half of each
function pickAds(src, per, hard) {
  const real = ANUNCIOS.filter(a => a.real), fake = ANUNCIOS.filter(a => !a.real);
  const n = per || (src === "inventados" ? fake.length : PER_GAME);
  if (src === "inventados") return draw(fake, n, hard);
  if (src === "reais") return draw(real, n, hard);
  return draw(fake, Math.ceil(n / 2), hard).concat(draw(real, Math.floor(n / 2), hard));
}
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const $ = id => document.getElementById(id);
let S;

function parse(d) {
  const parts = []; const re = /\{(\w+)(?:~(\d))?:([^}]+)\}/g; let m, last = 0;
  while ((m = re.exec(d))) {
    if (m.index > last) parts.push({ s: d.slice(last, m.index) });
    parts.push({ id: m[1], n: m[2] ? +m[2] : 0, s: m[3] }); last = re.lastIndex;
  }
  if (last < d.length) parts.push({ s: d.slice(last) });
  return parts;
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// localStorage can be missing or blocked (private window), so every access goes through these
function load(k) { try { return localStorage.getItem(k); } catch { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch {} }
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function newGame(lv) {
  clearInterval(S && S.tick);
  const src = $("src").value;
  const L = levelCfg(lv);
  const ads = shuffle(pickAds(src, L.ads, L.hard)).map(a => {
    const parts = parse(a.d), tparts = parse(a.t);
    // ids = the card phrases this ad holds; "dedo" is the finger over the plate in the photo
    const ids = [...new Set([...parts, ...tparts].filter(p => p.id).map(p => p.id).concat(a.dedo ? ["dedo"] : []))];
    return { ...a, parts, tparts, ids, plain: tparts.map(p => p.s).join("") };
  });
  // the card only asks for phrases that show up in this game's ads
  const present = [...new Set(ads.flatMap(a => a.ids))];
  // Difícil puts up to 6 phrases on the card that only show up with a typo, slang or in disguise
  let first = [];
  if (L.hard) {
    const top = {};
    ads.forEach(a => a.parts.concat(a.tparts).forEach(p => { if (p.id) top[p.id] = Math.max(top[p.id] || 0, tierOf(p, a)); }));
    first = shuffle(present.filter(id => top[id] >= 2)).slice(0, 6);
  }
  const card = shuffle(first.concat(shuffle(present.filter(id => !first.includes(id))))
    .slice(0, 9).concat(shuffle(Object.keys(PH).filter(k => !present.includes(k)))).slice(0, 9));
  S = { lv, ads, card, marked: new Set(), found: new Set(), lines: new Set(),
        L, score: 0, time: L.time, running: false, paused: false, over: false, open: -1, seen: new Set(), tick: null };
  document.querySelectorAll(".levels button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lv === lv));
  $("custom").hidden = lv !== "custom";
  document.body.classList.remove("reveal", "paused");
  $("reveal").textContent = "Mostrar o que faltou";
  $("pause").textContent = "Pausar"; $("pause").disabled = true;
  $("end").hidden = true;
  toast("Abra um anúncio para começar. O relógio só anda depois disso.");
  renderSeen(); renderSummary();
  renderCard(); renderList(); renderStats();
}

function carSvg(color) {
  return `<svg viewBox="0 0 240 90" aria-hidden="true">
    <path d="M18 62 L26 44 Q30 38 40 37 L78 35 L104 16 Q110 12 120 12 L168 12 Q178 12 184 18 L204 36 Q222 38 228 48 L230 62 Z" fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    <path d="M90 35 L110 19 L142 19 L142 35 Z M150 35 L150 19 L174 19 Q178 19 181 22 L194 35 Z" fill="rgba(20,30,45,.55)"/>
    <circle cx="62" cy="64" r="16" fill="#1c1f24"/><circle cx="62" cy="64" r="7" fill="#9aa1a8"/>
    <circle cx="186" cy="64" r="16" fill="#1c1f24"/><circle cx="186" cy="64" r="7" fill="#9aa1a8"/>
  </svg>`;
}

// a card phrase the player never marked; "Mostrar o que faltou" only points at these
function isMissed(id) { return S.card.includes(id) && !S.marked.has(id); }
function missedIn(i) { return S.ads[i].ids.filter(isMissed); }
// classes for one clickable occurrence of a cliché (key k) in the text or on the plate
function occClasses(id, k) {
  const f = S.found.has(k);
  return ["occ", f && "found", f && !S.card.includes(id) && "off", isMissed(id) && "missed"].filter(Boolean).join(" ");
}

// Pixel art mode: same photo, pixelated copy in fotos-pixel/ (hides plates, faces and places)
let pixelMode = load("bcc-pixel") === "1";
function fotoSrc(f) { return pixelMode ? f.replace("fotos/", "fotos-pixel/").replace(/\.jpg$/, ".png") : f; }
function labelPixel() {
  document.documentElement.classList.toggle("pixel", pixelMode);
  const b = $("pixel-btn"); if (!b) return;
  b.setAttribute("aria-pressed", pixelMode); b.title = pixelMode ? "Voltar para foto normal" : "Ver fotos em pixel art";
}

function plateHtml(a, i) {
  if (!a.plate) return "";
  const inner = `<b>BRASIL</b><span>${a.plate}</span>${a.dedo ? '<i class="finger" aria-hidden="true"></i>' : ""}`;
  if (!a.dedo) return `<span class="w plate" tabindex="0">${inner}</span>`;
  const k = i + "-plate";
  return `<span class="${occClasses("dedo", k)}" data-id="dedo" data-k="${k}"><span class="w plate" tabindex="0">${inner}</span></span>`;
}

function foundIn(i) { return [...S.found].filter(k => k.startsWith(i + "-")).length; }

function fillTokens(desc, parts, prefix) {
  parts.forEach((p, pi) => {
    let host = desc;
    if (p.id) {
      host = document.createElement("span"); host.className = occClasses(p.id, prefix + pi);
      host.dataset.id = p.id; host.dataset.k = prefix + pi; if (p.n) host.dataset.n = p.n;
      desc.appendChild(host);
    }
    p.s.split(/(\s+)/).forEach(w => {
      if (!w) return;
      // whitespace and lone punctuation stay plain text
      if (/^[\s.,;:!?]+$/.test(w)) { host.appendChild(document.createTextNode(w)); return; }
      const m = w.match(/^(.*?)([.,;:!?]*)$/);
      const s = document.createElement("span"); s.className = "w"; s.textContent = m[1]; s.tabIndex = 0; host.appendChild(s);
      if (m[2]) host.appendChild(document.createTextNode(m[2]));
    });
  });
  return desc;
}

// The ads keep their order for the whole game. The open ad stays in its place (marked "current")
// and its full text opens in a wide panel right after the row it sits in.
function renderList() {
  const list = $("list"); list.innerHTML = "";
  S.ads.forEach((a, i) => list.appendChild(adEl(a, i, false)));
  if (S.open >= 0) { list.appendChild(adEl(S.ads[S.open], S.open, true)); placeOpen(); }
}

function placeOpen() {
  const list = $("list"), panel = list.querySelector(".item.open");
  if (!panel) return;
  const cur = list.children[S.open]; let end = cur;
  while (end.nextElementSibling && end.nextElementSibling !== panel && end.nextElementSibling.offsetTop === cur.offsetTop) end = end.nextElementSibling;
  if (end.nextElementSibling !== panel) end.after(panel);
}
addEventListener("resize", () => S && placeOpen());

function adEl(a, i, open) {
    const el = document.createElement("article");
    el.className = "item" + (open ? " open" : "") + (!open && i === S.open ? " current" : "") + (S.seen.has(i) ? " seen" : ""); el.dataset.i = i;
    if (!open) { el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", `Abrir anúncio ${a.plain}`); }
    const n = foundIn(i), miss = missedIn(i);
    el.innerHTML = `
      <div class="thumb" style="background: linear-gradient(180deg, color-mix(in srgb, ${a.c || "#8a8f96"} 22%, var(--sunk)) 0 70%, var(--line) 70% 100%)">
        ${S.L.hint && miss.length ? `<span class="hint-tag">${miss.length} da cartela</span>` : ""}
        ${miss.length ? `<span class="miss-tag">Faltou aqui: ${miss.map(id => PH[id]).join(" · ")}</span>` : ""}
        ${plateHtml(a, i)}${carSvg(a.c || "#8a8f96")}${a.foto ? `<img class="photo" data-foto="${a.foto}" src="${fotoSrc(a.foto)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
        <span class="seen-tag" ${S.seen.has(i) ? "" : "hidden"}><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Visto</span>
        <span class="badge" ${n ? "" : "hidden"}>${plural(n, "achada", "achadas")}</span>
      </div>
      <div class="info">
        <div class="price">${a.p}</div>
        <div class="title">${a.plain}</div>
        <div class="meta">${[a.y, a.km && a.km + " km"].filter(Boolean).join(" · ")}</div>
        <div class="city">${a.city}</div>
      </div>`;
    if (open) {
      const info = el.querySelector(".info");
      const title = info.querySelector(".title"); title.textContent = "";
      fillTokens(title, a.tparts, i + "-t");
      const lab = document.createElement("div"); lab.className = "desc-label"; lab.textContent = "Descrição do vendedor";
      const close = document.createElement("button"); close.className = "close"; close.textContent = "Fechar anúncio";
      close.onclick = e => { e.stopPropagation(); S.open = -1; renderList(); };
      const desc = document.createElement("p"); desc.className = "desc";
      info.append(lab, fillTokens(desc, a.parts, i + "-"), close);
    }
    return el;
}

function openAd(i) {
  S.open = i; S.seen.add(i); start(); renderList(); renderSeen();
  const el = $("list").querySelector(".item.open");
  if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
}

function renderSeen() {
  $("feed-count").textContent = `${S.seen.size} de ${S.ads.length} vistos`;
}

function renderCard() {
  $("grid").innerHTML = S.card.map((id, i) => {
    const inLine = [...S.lines].some(l => LINES[l].includes(i));
    return `<div class="sq ${S.marked.has(id) ? "on" : ""} ${inLine ? "line" : ""}">${PH[id]}</div>`;
  }).join("");
  $("card-count").textContent = `${S.marked.size} de 9`;
  renderMini();
}

// phone-only bar fixed at the bottom: a tiny 3x3 of the card, the clock and the score.
// Tapping it opens the full card above the bar, so the player doesn't scroll back to the top.
// --- party when a line closes: the squares of the line pop one after the other, confetti falls over the card
function celebrate(lines, full) {
  play(full ? "full" : "line");
  const cells = [...new Set(lines.flatMap(li => LINES[li]))];
  ["grid", "mini-sheet"].forEach(g => cells.forEach((c, k) => {
    const sq = $(g).children[c]; if (sq) { sq.style.setProperty("--k", k); sq.classList.add("pop"); }
  }));
  const card = document.querySelector(".card");
  card.classList.remove("bingo"); void card.offsetWidth; card.classList.add("bingo");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#f2c230", "#e8553f", "#3d7be0", "#2fbf71", "#ffffff"];
  for (let n = 0; n < (full ? 70 : 36); n++) {
    const p = document.createElement("i"); p.className = "confetti";
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[n % colors.length]};--dx:${(Math.random() - .5) * 120}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .25}s`;
    card.appendChild(p); setTimeout(() => p.remove(), 1700);
  }
}

// --- sounds: short tunes made with Web Audio (no sound files); can be turned off in Configurações
let actx = null;
function play(kind) {
  if (!$("snd").checked) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const t = actx.currentTime;
    const tone = (f, at, dur, type = "triangle", vol = .16) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(vol, t + at + .01); g.gain.exponentialRampToValueAtTime(.001, t + at + dur);
      o.start(t + at); o.stop(t + at + dur + .02);
    };
    if (kind === "hit") tone(880, 0, .12, "sine", .08);
    else if (kind === "miss") tone(150, 0, .2, "square", .05);
    else if (kind === "line") [523, 659, 784, 1047].forEach((f, k) => tone(f, k * .09, .28));
    else if (kind === "full") [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, k) => tone(f, k * .11, k === 6 ? .7 : .3));
  } catch {}
}

function renderMini() {
  $("mini-grid").innerHTML = S.card.map(id => `<i class="${S.marked.has(id) ? "on" : ""}"></i>`).join("");
  $("mini-sheet").innerHTML = S.card.map((id, i) => {
    const inLine = [...S.lines].some(l => LINES[l].includes(i));
    return `<div class="sq ${S.marked.has(id) ? "on" : ""} ${inLine ? "line" : ""}">${PH[id]}</div>`;
  }).join("");
  $("mini-count").textContent = `${S.marked.size} de 9`;
}

function renderSummary() {
  const L = S.L;
  $("cfg-summary").textContent = `${L.name} · ${L.time ? L.time / 60 + " min" : "sem tempo"} · ${L.miss ? "erro −" + L.miss : "sem desconto"}`;
}

function renderStats() {
  $("score").textContent = S.score; $("mini-score").textContent = `${S.score} pts`;
  const m = Math.floor(S.time / 60), s = String(S.time % 60).padStart(2, "0");
  $("timer").textContent = $("mini-time").textContent = S.L.time ? `${m}:${s}` : "Livre";
  $("mini").classList.toggle("warn", S.L.time > 0 && S.time <= 20 && !S.over);
  $("timer-box").classList.toggle("warn", S.L.time > 0 && S.time <= 20 && !S.over);
}

function tickOn() {
  clearInterval(S.tick); S.tick = null;
  if (!S.L.time || S.paused || S.over) return;
  S.tick = setInterval(() => { S.time--; renderStats(); if (S.time <= 0) end(false); }, 1000);
}

function togglePause() {
  if (!S.running || S.over) return;
  S.paused = !S.paused;
  document.body.classList.toggle("paused", S.paused);
  $("pause").textContent = S.paused ? "Retomar" : "Pausar";
  toast(S.paused ? "Pausado. E nada de ler o anúncio escondido." : "Valendo de novo!");
  tickOn();
}


function showGain(g) {
  const el = $("gain"); el.textContent = `+${g} s`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
}

function toast(msg, kind = "") { const t = $("toast"); t.textContent = msg; t.className = "toast " + kind; }

function start() {
  if (S.running || S.over) return;
  S.running = true; $("pause").disabled = false;
  tickOn();
}

function updateBadge(i) {
  const n = foundIn(i);
  $("list").querySelectorAll(`.item[data-i="${i}"] .badge`).forEach(b => { b.hidden = !n; b.textContent = plural(n, "achada", "achadas"); });
}

function hit(w) {
  if (S.over || S.paused) return;
  const occ = w.closest(".occ");
  if (!occ) {
    S.score = Math.max(0, S.score - S.L.miss);
    w.classList.remove("miss"); void w.offsetWidth; w.classList.add("miss"); play("miss");
    toast(S.L.miss ? `−${S.L.miss} · isso aí não é clichê` : "Isso aí não é clichê", "bad");
    renderStats(); return;
  }
  const k = occ.dataset.k, id = occ.dataset.id, ai = +k.split("-")[0], n = +occ.dataset.n || S.ads[ai].n;
  if (S.found.has(k)) return;
  S.found.add(k); updateBadge(ai);
  if (!S.card.includes(id)) {
    occ.classList.add("found", "off");
    toast(`"${PH[id]}" é clichê, mas não está na sua cartela.`);
  } else if (S.marked.has(id)) {
    occ.classList.add("found"); S.score += 2;
    toast(`+2 · "${PH[id]}" de novo`, "good");
  } else {
    occ.classList.add("found"); S.marked.add(id); S.score += PTS[n];
    const g = S.L.gain && S.L.time ? GAIN[n] : 0;
    if (g) { S.time += g; showGain(g); }
    toast(`+${PTS[n]} · ${PH[id]} (${TIER[n]})${g ? ` · +${g} s no relógio` : ""}`, "good");
    const fresh = [];
    LINES.forEach((l, li) => {
      if (!S.lines.has(li) && l.every(i => S.marked.has(S.card[i]))) { S.lines.add(li); fresh.push(li); S.score += 50; toast("BINGO! +50", "big"); }
    });
    renderCard();
    if (fresh.length) celebrate(fresh, S.marked.size === 9); else play("hit");
    if (S.marked.size === 9) { S.score += 150 + S.time; renderStats(); end("full"); return; }
    if (hasWon()) { S.bonus = Math.round(S.time / 5); S.score += S.bonus; renderStats(); end("win"); return; }
  }
  renderStats();
}

function end(kind) {
  const full = kind === "full", won = kind === "win" || (full && S.L.next);
  S.over = true; clearInterval(S.tick); $("pause").disabled = true; renderStats();
  const best = +load("bcc-best-" + S.lv) || 0, rec = S.score > best; if (rec) save("bcc-best-" + S.lv, S.score);
  $("end").hidden = false;
  const nx = S.L.next;
  $("next-lv").hidden = !(won && nx);
  if (won && nx) $("next-lv").textContent = `Ir para o ${LV[nx].name} →`;
  $("again").textContent = won && nx ? "Repetir este nível" : "Jogar de novo";
  $("end-title").textContent = full ? "Cartela cheia!" : won ? (nx ? `Passou do ${S.L.name}!` : "Você ganhou!") : "Acabou o tempo";
  $("share").textContent = "Compartilhar resultado";
  $("end-text").textContent = `${S.score} pontos no nível ${S.L.name}, ${S.marked.size} de 9 frases e ${plural(S.lines.size, "linha", "linhas")}. ` +
    (rec ? "Novo recorde neste nível." : `Seu recorde: ${best}.`);
  toast(full ? `+150 pela cartela${S.time ? ` e +${S.time} pelo tempo que sobrou` : ""}` : won ? `BINGO! +50, e +${S.bonus} pelo tempo que sobrou` : "Hoje não saiu negócio. Bora de novo?", full || won ? "big" : "");
}

$("list").addEventListener("click", e => {
  const w = e.target.closest(".w"); if (w) { hit(w); return; }
  const item = e.target.closest(".item"); if (item && !item.classList.contains("open")) openAd(+item.dataset.i);
});
$("list").addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.classList.contains("w")) { e.preventDefault(); hit(e.target); return; }
  if (e.target.classList.contains("item") && !e.target.classList.contains("open")) { e.preventDefault(); openAd(+e.target.dataset.i); }
});
document.querySelectorAll(".levels button").forEach(b => b.onclick = () => newGame(b.dataset.lv));
$("again").onclick = () => newGame(S.lv);
// result text with the card drawn in emoji, like the word games people post in group chats
function shareText() {
  const rows = [0, 3, 6].map(r => S.card.slice(r, r + 3).map(id => S.marked.has(id) ? "🟨" : "⬛").join("")).join("\n");
  return `Bingo dos Classificados Automotivos\n${S.score} pontos no ${S.L.name}, ${S.marked.size} de 9 frases\n${rows}\n${location.href.split("#")[0].split("?")[0]}`;
}
$("share").onclick = async () => {
  const text = shareText();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    $("share").textContent = "Copiado! Agora é só colar";
  } catch (e) {
    if (e && e.name === "AbortError") return;
    window.prompt("Copie o resultado:", text);
  }
};
$("next-lv").onclick = () => { if (S.L.next) newGame(S.L.next); };
// custom rules are remembered in this browser; changing one starts a new custom game
$("snd").checked = load("bcc-som") !== "0";
$("snd").onchange = () => save("bcc-som", $("snd").checked ? "1" : "0");
try { const c = JSON.parse(load("bcc-custom") || "{}"); for (const k in CUSTOM_KEYS) if (k in c) { const el = $(CUSTOM_KEYS[k]); if (el.type === "checkbox") el.checked = !!c[k]; else el.value = c[k]; } } catch {}
Object.values(CUSTOM_KEYS).forEach(id => $(id).addEventListener("change", () => {
  save("bcc-custom", JSON.stringify(readCustom()));
  newGame("custom");
}));
$("pause").onclick = togglePause;
$("mini-open").onclick = () => {
  const open = $("mini").classList.toggle("open");
  $("mini-open").setAttribute("aria-expanded", open);
  $("mini-open").querySelector("small").textContent = open ? "Fechar cartela" : "Ver cartela";
};
// "Como jogar" opens by itself on the first visit; the ? button opens it again
let howPaused = false;
function openHow() {
  howPaused = !!S && S.running && !S.paused && !S.over;
  if (howPaused) togglePause();
  $("how").showModal();
}
$("how-btn").onclick = openHow;
$("how").addEventListener("close", () => {
  save("bcc-howto", "1");
  if (howPaused && S.paused && !S.over) togglePause();
  howPaused = false;
});
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
function labelTheme() {
  const l = isDark() ? "Mudar para tema claro" : "Mudar para tema escuro";
  $("theme-btn").setAttribute("aria-label", l); $("theme-btn").title = l;
}
$("theme-btn").onclick = () => {
  const t = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  save("bcc-theme", t);
  labelTheme();
};
labelTheme();
$("pixel-btn").onclick = () => {
  pixelMode = !pixelMode; save("bcc-pixel", pixelMode ? "1" : "0"); labelPixel();
  document.querySelectorAll("img.photo[data-foto]").forEach(img => { img.src = fotoSrc(img.dataset.foto); });
};
labelPixel();
let autoPaused = false;
$("settings-btn").onclick = () => {
  autoPaused = !!S && S.running && !S.paused && !S.over;
  if (autoPaused) togglePause();
  $("settings").showModal();
};
$("settings").addEventListener("close", () => {
  if (autoPaused && S.paused && !S.over) togglePause();
  autoPaused = false;
});
$("src").onchange = () => S && newGame(S.lv);
$("reveal").onclick = () => {
  const on = document.body.classList.toggle("reveal");
  $("reveal").textContent = on ? "Esconder o que faltou" : "Mostrar o que faltou";
  const left = S.card.filter(isMissed);
  const where = left.filter(id => S.ads.some(a => a.ids.includes(id)));
  if (on) toast(left.length ? `Faltou: ${left.map(id => PH[id]).join(", ")}. ${where.length ? "Os anúncios onde elas estavam ficaram em vermelho." : ""}` : "Você marcou a cartela inteira!");
  renderList();
};

// the data comes from JSON files, which the browser only loads from a web server (GitHub Pages or a local one)
Promise.all(["dados/cliches.json", "dados/anuncios.json"].map(f => fetch(f).then(r => { if (!r.ok) throw r.status; return r.json(); })))
  .then(([ph, ads]) => { PH = ph; ANUNCIOS = ads; newGame("medio"); if (!load("bcc-howto")) openHow(); })
  .catch(() => {
    $("list").innerHTML = `<p class="load-error">Não deu para carregar os anúncios. Se você abriu o index.html direto do computador, rode <code>python3 -m http.server</code> nesta pasta e abra <code>http://localhost:8000</code>.</p>`;
  });
