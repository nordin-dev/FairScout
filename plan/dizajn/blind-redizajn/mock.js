/* Shared by the three mockups: invented sample players, the trio rule of the app, the cards. */

const FIRST = ['Ivan', 'Jakub', 'Andrei', 'Luka', 'Mats', 'Tomás', 'Emre', 'Nils', 'Pavel', 'Marko', 'Jonas', 'Dário', 'Milan', 'Oskar', 'Adem', 'Viktor'];
const SUR = ['Uzorak', 'Příklad', 'Exemplu', 'Primjer', 'Muster', 'Voorbeeld', 'Esempio', 'Przykład', 'Példa', 'Ejemplo', 'Örnek', 'Näide', 'Exemplo', 'Eksempel', 'Vzorec', 'Paraugs'];
const CLUBS = [['NK Primjer', 'Croatia'], ['SK Vzor', 'Czech Republic'], ['FC Model', 'Romania'], ['FK Uzorak', 'Bosnia-Herzegovina'], ['SV Muster', 'Austria'], ['IF Exempel', 'Sweden'], ['KS Wzór', 'Poland'], ['FC Minta', 'Hungary'], ['NK Zgled', 'Slovenia'], ['FK Primer', 'Serbia']];

const POS = {
  winger: ['Winger', 'wingers'],
  striker: ['Striker', 'strikers'],
  midfielder: ['Midfielder', 'midfielders'],
  defender: ['Defender', 'defenders'],
};
const DIMS = { creates: ['Creating', 'creating'], scores: ['Scoring', 'scoring'], plays: ['Playing time', 'playing'] };
const MATTERS = ['creates', 'scores', 'plays'];
const LETTERS = ['A', 'B', 'C'];
const NAME_W = [8.5, 9.5, 10.5];
const CLUB_W = [17, 19, 15];
const ROLE_TEXT = { model: "Model's pick", goals: 'Most goals', fit: 'Best fit for your brief' };

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eur(v) {
  if (v >= 1e6) return `€${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M`;
  return `€${Math.round(v / 1000)}k`;
}

/** Twenty-four invented players of one position. The same seed always gives the same players. */
function makePool(position, seedText = 'pool') {
  const h = hash(seedText + position);
  const r = rng(h);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pool = [];
  for (let i = 0; i < 24; i += 1) {
    const creating = int(18, 97);
    const scoring = int(18, 97);
    const playing = int(15, 95);
    const age = int(17, 21);
    const club = CLUBS[(i * 3 + h) % CLUBS.length];
    pool.push({
      id: `${position}-${seedText}-${i}`,
      name: `${FIRST[(i * 5 + h + Math.floor(i / 16)) % 16]} ${SUR[(i * 3 + (h >>> 4)) % 16]}`,
      club: `${club[0]} · ${club[1]}`,
      age,
      value: (2 + Math.floor(r() ** 2 * 19)) * 50000,
      creating,
      scoring,
      playing,
      goals: Math.max(0, Math.round(scoring * 0.11 + r() * 2 - 1)),
      assists: Math.round(creating * 0.07 + r() * 2),
      rating: Math.round(0.4 * creating + 0.4 * scoring + 0.2 * playing),
      minutes: Math.round((450 + playing * 22) / 10) * 10,
      score: 0.5 * creating + 0.3 * playing + 8 * (21 - age) - 0.25 * scoring + r() * 10,
    });
  }
  [...pool].sort((a, b) => b.score - a.score).forEach((p, i) => {
    p.tier = i < 4 ? 'A' : i < 11 ? 'B' : 'C';
  });
  return pool;
}

function matches(p, brief) {
  return p.age <= brief.age && p.value <= brief.budget;
}

function best(players, value) {
  return players.reduce((top, p) => (!top || value(p) > value(top) ? p : top), null);
}

/** The rule of the app: the model's top, the most goals plus assists of the rest, the best fit of the rest. */
function pickTrio(pool, brief) {
  const fit = (p) => brief.matters.reduce((s, m) => s + p[DIMS[m][1]], 0) / brief.matters.length;
  const ok = pool.filter((p) => matches(p, brief));
  const model = best(ok, (p) => p.score);
  const goals = best(ok.filter((p) => p !== model), (p) => p.goals + p.assists);
  const fitTop = best(ok.filter((p) => p !== model && p !== goals), fit);
  if (!model || !goals || !fitTop) return null;
  const order = [model, goals, fitTop];
  const next = rng(hash(JSON.stringify(brief)));
  for (let i = 2; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const roleOf = (p) => (p === model ? 'model' : p === goals ? 'goals' : 'fit');
  return { model, goals, fit: fitTop, order, roleOf };
}

function tierBadge(tier, xl = false) {
  return `<span class="tier tier-${tier.toLowerCase()}${xl ? ' xl' : ''}">${tier}</span>`;
}

/** One covered dossier. Names are not in the page until the card is opened. */
function cardHTML(p, i, brief, slotClass = '') {
  const dims = [...brief.matters, ...MATTERS.filter((m) => !brief.matters.includes(m))];
  const cells = dims
    .map((m) => {
      const v = p[DIMS[m][1]];
      return `<div class="${brief.matters.includes(m) ? '' : 'dim'}"><span class="label">${DIMS[m][0]}</span><b>${v}</b><span class="mini"><i style="width:${v}%"></i></span></div>`;
    })
    .join('');
  return `<article class="sheet dossier" data-id="${p.id}">
    <span class="picked-mark" hidden>Your pick</span>
    <div class="role">Player ${LETTERS[i]}</div>
    <div class="ident">
      <div class="ident-name"><span class="redact" style="--w:${NAME_W[i]}ch"><span class="secret"></span></span></div>
      <div class="ident-sub"><span class="redact" style="--w:${CLUB_W[i]}ch"><span class="secret"></span></span></div>
    </div>
    <div class="score">${cells}</div>
    <p class="facts">${POS[brief.pos][0]} · age ${p.age}</p>
    <div class="slot ${slotClass}"><button class="btn pick" type="button">Pick ${LETTERS[i]}</button></div>
  </article>`;
}

const cardOf = (root, p) => $(`[data-id="${p.id}"]`, root);

/** Takes the bars off one card. */
function openCard(root, p) {
  const el = cardOf(root, p);
  const [name, club] = $$('.redact', el);
  $('.secret', name).textContent = p.name;
  $('.secret', club).textContent = p.club;
  name.classList.add('is-open');
  club.classList.add('is-open');
}

/** Turns the top strip of each card into its role: the model's pick, the most goals, the best fit. */
function stampRoles(root, trio) {
  trio.order.forEach((p, i) => {
    const role = trio.roleOf(p);
    const strip = $('.role', cardOf(root, p));
    strip.className = `role ${role}`;
    strip.textContent = `${LETTERS[i]} · ${ROLE_TEXT[role]}`;
  });
}

function markPicked(root, p) {
  const el = cardOf(root, p);
  el.classList.add('picked');
  $('.picked-mark', el).hidden = false;
}

/** Price, goals and outlook in place of the pick button. */
function showAfter(root, trio) {
  trio.order.forEach((p) => {
    $('.slot', cardOf(root, p)).innerHTML = `<div class="after">
      <div><span class="label">Price</span><b>${eur(p.value)}</b></div>
      <div><span class="label">Goals</span><b>${p.goals}</b></div>
      <div><span class="label">Outlook</span>${tierBadge(p.tier, true)}</div>
    </div>`;
  });
}

function clearButtons(root) {
  $$('.slot', root).forEach((s) => {
    s.innerHTML = '';
  });
}

/** The headline changes in place, with a short fade. */
function setHead(text) {
  const h1 = $('h1');
  if (reducedMotion) {
    h1.textContent = text;
    return;
  }
  h1.classList.add('swap');
  setTimeout(() => {
    h1.textContent = text;
    h1.classList.remove('swap');
  }, 180);
}

/** Runs the steps one after another; all at once when motion is reduced. */
function beats(steps, gap = 850) {
  steps.forEach((step, i) => setTimeout(step, reducedMotion ? 0 : i * gap));
}

const TIER_GOOD = { A: 1, B: 0.66, C: 0.33 };

/** The five rows between the two cards. A longer bar is the better side of that row. */
function tapeHTML(scout, model, scoutLetter, modelLetter) {
  const rows = [
    ['Outlook', TIER_GOOD[scout.tier], TIER_GOOD[model.tier], tierBadge(scout.tier), tierBadge(model.tier)],
    ['Rating', scout.rating / 100, model.rating / 100, scout.rating, model.rating],
    ['Price', Math.min(scout.value, model.value) / scout.value, Math.min(scout.value, model.value) / model.value, eur(scout.value), eur(model.value)],
    ['Age', (24 - scout.age) / 7, (24 - model.age) / 7, scout.age, model.age],
    ['Minutes', scout.minutes / 2600, model.minutes / 2600, scout.minutes.toLocaleString('en'), model.minutes.toLocaleString('en')],
  ];
  const body = rows
    .map(([label, l, r, lText, rText]) => {
      const lw = l > r ? ' win' : '';
      const rw = r > l ? ' win' : '';
      return `<div class="tape-row">
        <span class="v${lw}">${lText}</span>
        <div class="tape-mid"><span class="label">${label}</span>
          <div class="bars"><span><i class="${lw}" data-w="${Math.round(l * 100)}"></i></span><span><i class="${rw}" data-w="${Math.round(r * 100)}"></i></span></div>
        </div>
        <span class="v r${rw}">${rText}</span>
      </div>`;
    })
    .join('');
  return `<div class="tape-head"><span>You · ${scoutLetter}</span><span>Model · ${modelLetter}</span></div><div class="tape-rows">${body}</div>`;
}

/** Lets the bars of the tape grow from the middle, one row after another. */
function growBars(root) {
  $$('.bars i', root).forEach((bar, i) => {
    setTimeout(() => {
      bar.style.width = `${bar.dataset.w}%`;
    }, reducedMotion ? 0 : 80 + Math.floor(i / 2) * 110);
  });
}
