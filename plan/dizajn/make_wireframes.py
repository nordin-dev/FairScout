#!/usr/bin/env python3
"""Build the wireframe pages under .prodready/wireframes/ from the design mockup.

Each page is the mockup opened on one screen, plus the three states the mockup
does not draw (loading, empty, error) in the same tokens. The state switch in the
bottom right corner belongs to the wireframe, not to the product.

Usage: python3 plan/dizajn/make_wireframes.py plan/dizajn/mockup.html .prodready/wireframes
"""
import json
import pathlib
import sys

CSS = """
/* ------------------------------------------------------------------ wireframe states (not part of the product) */
.wf-bar{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;gap:4px;align-items:center;background:var(--sheet);border:1px solid var(--ink);border-radius:2px;padding:6px 8px;font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.wf-bar span{padding:0 6px 0 2px}
.wf-bar button{all:unset;cursor:pointer;padding:5px 8px;border-radius:2px;color:var(--ink-2)}
.wf-bar button[aria-pressed="true"]{background:var(--ink);color:#fff}
.shot .wf-bar{display:none}
.sk{display:block;background:var(--context-track);border-radius:2px}
.sk-h1{height:44px;width:min(760px,70%);margin-bottom:14px}
.sk-lede{height:22px;width:min(520px,48%)}
.sk-line{height:14px}
.sk-choice{height:43px}
.sk-fig{height:56px;width:120px}
.state-note{font:500 12px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-top:20px}
.state-block{margin-top:28px;border-left:3px solid var(--ink);padding:28px;max-width:760px}
.state-block h2{font:600 30px/1.2 var(--sans);letter-spacing:-.02em;margin:0 0 8px}
.state-block p{font-size:19px;line-height:1.4;color:var(--ink-2)}
.state-block .file{font:400 13px var(--mono);color:var(--ink-3);margin-top:10px}
.state-block .btn{margin-top:22px}
.sk-rows{display:grid;gap:0}
.sk-rows > div{display:grid;grid-template-columns:20px 1fr 60px 60px;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--hair)}
"""


def error_block(file_name, what):
    return (
        '<div class="sheet state-block" role="alert">'
        "<h2>The data could not be loaded.</h2>"
        f"<p>{what} No numbers are shown until it loads.</p>"
        f'<p class="file">{file_name}</p>'
        '<button class="btn">Try again</button></div>'
    )


def sk(style):
    return f'<span class="sk" style="{style}"></span>'


def choices(widths):
    return "".join(f'<span class="sk sk-choice" style="width:{w}px"></span>' for w in widths)


BRIEF_ROWS_LOADING = (
    '<div class="b-row"><span class="label">Position</span><div class="choices">'
    '<button class="choice">Winger</button><button class="choice">Striker</button><button class="choice">Midfielder</button>'
    '<button class="choice">Defender</button><button class="choice">Goalkeeper</button></div></div>'
    '<div class="b-row"><span class="label">Age</span><div class="choices">'
    '<button class="choice">19 or under</button><button class="choice">21 or under</button></div></div>'
    '<div class="b-row"><span class="label">Budget</span><div class="choices">'
    '<button class="choice">Up to €250k</button><button class="choice">Up to €500k</button><button class="choice">Up to €1M</button></div></div>'
    '<div class="b-row"><span class="label">Most important<small>pick two</small></span><div class="choices">'
    '<button class="choice">Creates chances</button><button class="choice">Scores goals</button><button class="choice">Plays regularly</button></div></div>'
)

BRIEF_ROWS_EMPTY = (
    '<div class="b-row"><span class="label">Position</span><div class="choices">'
    '<button class="choice">Winger</button><button class="choice">Striker</button><button class="choice">Midfielder</button>'
    '<button class="choice">Defender</button><button class="choice on">Goalkeeper</button></div></div>'
    '<div class="b-row"><span class="label">Age</span><div class="choices">'
    '<button class="choice on">19 or under</button><button class="choice">21 or under</button></div></div>'
    '<div class="b-row"><span class="label">Budget</span><div class="choices">'
    '<button class="choice on">Up to €250k</button><button class="choice">Up to €500k</button><button class="choice">Up to €1M</button></div></div>'
    '<div class="b-row"><span class="label">Most important<small>pick two</small></span><div class="choices">'
    '<button class="choice">Creates chances</button><button class="choice">Scores goals</button><button class="choice on">Plays regularly</button></div></div>'
)

RADAR_HEAD = (
    '<thead><tr><th class="r">#</th><th>Player</th><th>Pos</th><th class="r">Age</th><th class="r">Price</th>'
    '<th class="r">Min</th><th>Rating</th><th>Outlook</th><th>Notes</th></tr></thead>'
)


def radar_rows(n):
    row = (
        "<tr><td class=\"r\">" + sk("width:12px;height:14px;margin-left:auto") + "</td>"
        "<td>" + sk("width:150px;height:14px;margin-bottom:6px") + sk("width:190px;height:11px") + "</td>"
        "<td>" + sk("width:24px;height:14px") + "</td>"
        "<td class=\"r\">" + sk("width:30px;height:14px;margin-left:auto") + "</td>"
        "<td class=\"r\">" + sk("width:46px;height:14px;margin-left:auto") + "</td>"
        "<td class=\"r\">" + sk("width:40px;height:14px;margin-left:auto") + "</td>"
        "<td>" + sk("width:100px;height:8px") + "</td>"
        "<td>" + sk("width:28px;height:28px") + "</td>"
        "<td>" + sk("width:90px;height:22px") + "</td></tr>"
    )
    return row * n


def tm_rows(n):
    return '<div class="sk-rows">' + (
        "<div>" + sk("height:12px") + "<span>" + sk("width:150px;height:14px;margin-bottom:5px") + sk("width:120px;height:10px") + "</span>"
        + sk("height:13px") + sk("height:13px") + "</div>"
    ) * n + "</div>"


PAGES = [
    {
        "file": "blind-pick.html",
        "view": "blind",
        "title": "Blind pick",
        "loading": (
            '<p class="kicker">01 — Blind pick</p><h1>What are you looking for?</h1>'
            '<section class="sheet brief" aria-busy="true">' + BRIEF_ROWS_LOADING +
            '<div class="b-foot"><p class="b-count">' + sk("width:44px;height:36px") + '<span role="status">Loading players…</span></p>'
            '<button class="btn" disabled>Show me three, no names →</button></div></section>'
        ),
        "empty": (
            '<p class="kicker">01 — Blind pick</p><h1>What are you looking for?</h1>'
            '<section class="sheet brief">' + BRIEF_ROWS_EMPTY +
            '<div class="b-foot"><p class="b-count"><b>1</b><span>player matches. Three are needed: raise the budget or the age limit.</span></p>'
            '<button class="btn" disabled>Show me three, no names →</button></div></section>'
        ),
        "error": (
            '<p class="kicker">01 — Blind pick</p><h1>What are you looking for?</h1>'
            + error_block("players.json · network error or malformed file", "The list of players did not arrive.")
        ),
    },
    {
        "file": "player-card.html",
        "view": "player",
        "title": "Player card",
        "loading": (
            '<div class="p-head"><div><button class="back">← Back to radar</button>'
            + sk("width:360px;height:44px;margin-bottom:14px") + sk("width:300px;height:22px") + "</div>"
            '<div class="tiles">'
            '<div class="tile"><span class="label">Price</span>' + sk("width:90px;height:30px") + "</div>"
            '<div class="tile"><span class="label">Contract</span>' + sk("width:110px;height:30px") + "</div>"
            '<div class="tile"><span class="label">Minutes</span>' + sk("width:80px;height:30px") + "</div></div></div>"
            '<section class="sheet" aria-busy="true"><p class="label">How we rate him</p><div class="flow">'
            '<div class="step"><span class="label">01 What he did</span><span class="sk sk-fig"></span>' + sk("width:140px;height:14px") + "</div>"
            '<div class="arrow">→</div>'
            '<div class="step"><span class="label">02 His league</span><span class="sk sk-fig"></span>' + sk("width:140px;height:14px") + "</div>"
            '<div class="arrow">→</div>'
            '<div class="step"><span class="label">03 On one scale</span><span class="sk sk-fig"></span>' + sk("width:140px;height:14px") + "</div>"
            '<div class="arrow">→</div>'
            '<div class="step final"><span class="label">04 Rating</span><span class="sk sk-fig"></span>' + sk("width:160px;height:14px") + "</div>"
            "</div></section>"
            '<div class="p-row2"><section class="sheet"><p class="label">Outlook</p>' + sk("width:150px;height:56px;margin:10px 0 18px")
            + sk("width:280px;height:22px;margin-bottom:14px") + sk("width:280px;height:22px") + "</section>"
            '<section class="sheet"><p class="label">Where he could be in three years</p>' + sk("height:230px;margin-top:12px") + "</section></div>"
            '<p class="state-note" role="status">Loading player…</p>'
        ),
        "empty": (
            '<div class="sheet state-block"><h2>This player is not in the data.</h2>'
            "<p>The link may be old, or he plays outside the 23 leagues.</p>"
            '<button class="btn" data-go="radar">Open the radar →</button></div>'
        ),
        "error": (
            '<button class="back">← Back to radar</button>'
            + error_block("players.json · network error or malformed file", "The player's numbers did not arrive.")
        ),
    },
    {
        "file": "radar.html",
        "view": "radar",
        "title": "Radar",
        "loading": (
            '<p class="kicker">02 — Radar</p><span class="sk sk-h1"></span><span class="sk sk-lede"></span>'
            '<div class="r-layout"><aside class="rail">'
            '<div><span class="label">Budget</span>' + sk("height:28px") + "</div>"
            '<div><span class="label">Position</span>' + sk("height:28px") + "</div>"
            '<div><span class="label">League</span>' + sk("height:14px;margin-bottom:10px") * 5 + "</div>"
            '<div><span class="label">Availability</span>' + sk("height:14px;margin-bottom:10px") * 2 + "</div>"
            "</aside>"
            '<div style="display:grid;gap:24px;align-content:start"><div class="seg-row">'
            + sk("width:170px;height:37px") + sk("width:190px;height:37px") + "</div>"
            '<section class="sheet" aria-busy="true" style="padding-top:12px"><table>' + RADAR_HEAD + "<tbody>" + radar_rows(7) + "</tbody></table></section>"
            '</div></div><p class="state-note" role="status">Loading players…</p>'
        ),
        "empty": (
            '<p class="kicker">02 — Radar</p><h1>No players match these filters.</h1>'
            '<p class="lede">Season 2025/26, aged 21 or younger.</p>'
            '<div class="r-layout"><aside class="rail">'
            '<div><span class="label">Budget</span><div class="slider" role="img" aria-label="Budget up to 75 thousand euros"><i style="left:0"></i></div>'
            '<div class="row"><span style="color:var(--ink);font-weight:600">≤ €75k</span><span></span><span>€1M</span></div></div>'
            '<div><span class="label">Position</span><div class="opts"><span class="opt">All</span><span class="opt">Attack</span><span class="opt">Midfield</span><span class="opt">Defence</span><span class="opt on">GK</span></div></div>'
            '<div><span class="label">League</span><div class="check on"><i></i><span>Poland</span><span class="num">0</span></div>'
            '<div class="check"><i></i><span>22 more leagues</span><span class="num">3</span></div></div>'
            "</aside>"
            '<div><div class="sheet state-block" style="margin-top:0"><h2>Nothing inside this budget.</h2>'
            "<p>Raise the budget or add leagues to see players again.</p>"
            '<button class="btn">Reset filters</button></div></div></div>'
        ),
        "error": (
            '<p class="kicker">02 — Radar</p>'
            + error_block("players.json · network error or malformed file", "The list of players did not arrive.")
        ),
    },
    {
        "file": "time-machine.html",
        "view": "time",
        "title": "Time machine",
        "loading": (
            '<p class="kicker">03 — Time machine</p><span class="sk sk-h1"></span><span class="sk sk-lede"></span>'
            '<div class="tm-bar"><div class="choices">' + choices([104, 104, 104, 104]) + "</div>" + sk("width:230px;height:43px") + "</div>"
            '<div class="tm-grid"><section class="sheet" aria-busy="true"><div class="tm-list">' + tm_rows(9) + tm_rows(9) + "</div></section>"
            '<section class="sheet">' + sk("width:120px;height:12px;margin-bottom:10px") + sk("width:200px;height:26px;margin-bottom:14px") + sk("height:230px") + "</section></div>"
            '<p class="state-note" role="status">Loading past radars…</p>'
        ),
        "empty": (
            '<p class="kicker">03 — Time machine</p><h1>No past season can be checked yet.</h1>'
            '<p class="lede">A season can be checked three years after it ends.</p>'
            '<div class="sheet state-block"><h2>No past radars in the data.</h2>'
            "<p>The model's test on past seasons is on the evidence screen.</p>"
            '<button class="btn" data-go="evidence">Open the evidence →</button></div>'
        ),
        "error": (
            '<p class="kicker">03 — Time machine</p>'
            + error_block("timemachine.json · network error or malformed file", "The past radars did not arrive.")
        ),
    },
    {
        "file": "evidence.html",
        "view": "evidence",
        "title": "Evidence",
        "loading": (
            '<p class="kicker">04 — Evidence</p><h1>Does it work? We tested it on the past.</h1>'
            '<p class="lede">"Made it" = the player\'s value doubled and passed €1M within three years.</p>'
            '<div class="e-stack"><section class="sheet" aria-busy="true"><p class="chart-title">How often does each way of picking get it right?</p>'
            '<div class="bars" style="--lab:200px">'
            + "".join(
                f'<div class="bar-row"><span>{name}</span><div class="bar-track">' + sk(f"width:{w}%;height:24px") + "</div></div>"
                for name, w in [("Fair Scout", 62), ("Most minutes", 54), ("Most goals", 46), ("Youngest", 46), ("Cheapest", 22)]
            )
            + "</div></section>"
            '<div class="e-row"><section class="sheet"><p class="label">The biggest riser of each season</p>' + sk("height:170px;margin-top:14px") + "</section>"
            '<section class="sheet"><p class="label">What it cannot see</p>' + sk("height:90px;margin-top:14px") + "</section></div></div>"
            '<p class="state-note" role="status">Loading test results…</p>'
        ),
        "empty": (
            '<p class="kicker">04 — Evidence</p><h1>Does it work? We tested it on the past.</h1>'
            '<div class="sheet state-block"><h2>The test on past seasons has not been run.</h2>'
            "<p>The data holds no test results, so no numbers are shown.</p>"
            '<p class="file">evidence.json · 0 test rows</p></div>'
        ),
        "error": (
            '<p class="kicker">04 — Evidence</p><h1>Does it work? We tested it on the past.</h1>'
            + error_block("evidence.json · network error or malformed file", "The test results did not arrive.")
        ),
    },
]

FILES = {p["view"]: p["file"] for p in PAGES}

SCRIPT = """
<script>
// ---------------------------------------------------------------- wireframe page: one screen, four states (not part of the product)
(function(){
  const WF = __WF__, FILES = __FILES__;
  const view = document.getElementById('v-' + WF.view);
  const host = document.createElement('section'); host.className = 'view'; host.id = 'wf-state'; host.hidden = true;
  view.after(host);
  const bar = document.createElement('div'); bar.className = 'wf-bar';
  bar.innerHTML = '<span>Wireframe state</span>' + [['default','Populated'],['loading','Loading'],['empty','Empty'],['error','Error']]
    .map(s => '<button data-wf="' + s[0] + '">' + s[1] + '</button>').join('');
  document.body.appendChild(bar);
  const remember = v => { try { sessionStorage.setItem('wfOrigin', v); } catch(e){} };
  const origin = () => { try { return sessionStorage.getItem('wfOrigin') || 'blind'; } catch(e){ return 'blind'; } };
  function setState(s){
    if(!['default','loading','empty','error'].includes(s)) s = 'default';
    const def = s === 'default';
    view.hidden = !def; host.hidden = def;
    host.innerHTML = def ? '' : WF[s];
    host.querySelectorAll('.back').forEach(b => b.textContent = '← Back to ' + (origin() === 'radar' ? 'radar' : 'blind pick'));
    bar.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.wf === s));
    document.documentElement.dataset.state = s;
    document.documentElement.dataset.h = document.documentElement.scrollHeight;
  }
  // links between pages follow the navigation and the calls to action of the product
  document.addEventListener('click', e => {
    const st = e.target.closest('[data-wf]'); if(st){ setState(st.dataset.wf); return; }
    const go = e.target.closest('[data-go]');
    if(go && go.dataset.go !== WF.view){ e.stopPropagation(); e.preventDefault(); if(go.dataset.go === 'player') remember(WF.view); location.href = FILES[go.dataset.go]; return; }
    if(e.target.closest('#backLink') || e.target.closest('.back')){ e.stopPropagation(); e.preventDefault(); location.href = FILES[origin() === 'radar' ? 'radar' : 'blind']; return; }
    const find = e.target.closest('.find'); if(find){ e.stopPropagation(); e.preventDefault(); location.href = FILES.time + '#time-revealed-' + find.dataset.tm.split(':')[0]; }
  }, true);
  document.querySelector('.brand span').textContent = 'wireframe · ' + WF.title;
  document.title = 'Fair Scout — wireframe — ' + WF.title;
  // the mockup opens on the blind pick unless the address names a variant of this page's screen
  if(location.hash.replace('#','').replace('-details','').split('-')[0] !== WF.view) show(WF.view);
  if(WF.view === 'player'){ const b = document.getElementById('backLink'); if(b) b.textContent = '← Back to ' + (origin() === 'radar' ? 'radar' : 'blind pick'); }
  document.querySelectorAll('.steps button').forEach(b => b.setAttribute('aria-current', b.dataset.go === (WF.view === 'player' ? origin() : WF.view)));
  setState(new URLSearchParams(location.search).get('state') || 'default');
})();
</script>
"""


def main():
    src_path, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    src = src_path.read_text(encoding="utf-8")
    assert src.count("</style>") == 1 and src.count("</body>") == 1, "unexpected mockup structure"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "prototype.html").write_text(src, encoding="utf-8")
    for page in PAGES:
        cfg = {k: page[k] for k in ("view", "title", "loading", "empty", "error")}
        script = SCRIPT.replace("__WF__", json.dumps(cfg, ensure_ascii=False).replace("</", "<\\/")).replace("__FILES__", json.dumps(FILES))
        html = src.replace("</style>", CSS + "</style>").replace("</body>", script + "</body>")
        (out_dir / page["file"]).write_text(html, encoding="utf-8")
        print("wrote", out_dir / page["file"], len(html), "bytes")
    print("wrote", out_dir / "prototype.html")


if __name__ == "__main__":
    main()
