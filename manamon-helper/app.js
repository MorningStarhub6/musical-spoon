/* Manamon 2 Helper.  Plain JavaScript, no libraries, works from a local file. */
"use strict";

(function () {
  const D = window.MANAMON_DATA;
  if (!D) {
    document.getElementById("main").innerHTML =
      "<p>The data file data/manamon-data.js is missing. Keep the data folder next to index.html.</p>";
    return;
  }
  const TYPES = D.types;
  const CHART = D.chart;
  const STORE_KEY = "manamonHelper.v1";
  const MONS = D.manamon;
  const MON_BY_ID = new Map(MONS.map(m => [String(m.id), m]));
  const STEPS = D.steps;

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const clone = o => JSON.parse(JSON.stringify(o));
  const listWords = arr => {
    const a = arr.filter(Boolean);
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  };
  const typesText = types => (types && types.length ? listWords(types) : "unknown type");
  let uidCounter = Date.now();
  const newUid = () => "u" + (uidCounter++).toString(36);

  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  let announceTimer = null;
  function announce(text) {
    const box = $("announcer");
    box.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { box.textContent = text; }, 120);
  }

  function fmtNum(x) {
    if (x === 0.5) return "half";
    if (x === 0.25) return "a quarter";
    if (x === 0.125) return "an eighth";
    return String(Math.round(x * 100) / 100);
  }

  // Words for an attack's type effect.
  function effectWords(m) {
    if (m === 0) return "no effect";
    if (m >= 8) return "extremely effective, " + fmtNum(m) + " times";
    if (m >= 4) return "super effective, " + fmtNum(m) + " times";
    if (m >= 2) return "very effective, " + fmtNum(m) + " times";
    if (m > 1) return "a bit effective, " + fmtNum(m) + " times";
    if (m === 1) return "normal";
    if (m >= 0.5) return "not very effective, half";
    if (m >= 0.25) return "very weak, a quarter";
    return "almost nothing, " + fmtNum(m);
  }
  // Words for damage a Manamon takes.
  function takesWords(m) {
    if (m === 0) return "takes no damage";
    if (m === 1) return "takes normal damage";
    if (m < 1) return "takes " + fmtNum(m) + " damage";
    return "takes " + fmtNum(m) + " times damage";
  }

  // ------------------------------------------------------------------
  // Saved state
  // ------------------------------------------------------------------
  const DEFAULT_SETTINGS = {
    stab: 1.5, dualMode: "multiply", weakBelow: 40, normalBelow: 60, goodUpTo: 90,
    starter: "Grekko", upcoming: 5
  };

  function startingTeam() {
    return (window.MANAMON_START_TEAM || []).map(m => fixMember(clone(m)));
  }

  function fixMember(m) {
    m.uid = m.uid || newUid();
    m.name = m.name || "New Manamon";
    m.types = (m.types || []).filter(t => TYPES.includes(t));
    m.active = m.active !== false;
    m.moves = (m.moves || []).map(mv => ({
      name: mv.name || "",
      types: (mv.types || []).filter(t => TYPES.includes(t)),
      power: Number(mv.power) || 0,
      category: ["Physical", "Special", "Status"].includes(mv.category) ? mv.category : "Physical",
      accuracy: mv.accuracy == null || mv.accuracy === "" ? null : Number(mv.accuracy),
      crit: mv.crit == null || mv.crit === "" ? null : Number(mv.crit),
      superVs: TYPES.includes(mv.superVs) ? mv.superVs : "",
      description: mv.description || ""
    }));
    return m;
  }

  function freshState() {
    return {
      version: 1, team: startingTeam(), settings: clone(DEFAULT_SETTINGS), progress: null,
      tools: {}, got: {}, sideReach: {}, typeFix: {}, opponent: null, itemsFilter: "now", hideGot: false
    };
  }

  let storageWorks = true;
  function loadState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (e) {
      storageWorks = false;
    }
    const s = freshState();
    if (saved && typeof saved === "object") {
      Object.assign(s, saved);
      s.settings = Object.assign(clone(DEFAULT_SETTINGS), saved.settings || {});
      s.team = Array.isArray(saved.team) ? saved.team.map(fixMember) : startingTeam();
      for (const k of ["tools", "got", "sideReach", "typeFix"]) s[k] = saved[k] || {};
    }
    return s;
  }

  let state = loadState();
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageWorks = true;
    } catch (e) {
      storageWorks = false;
    }
  }
  const S = () => state.settings;

  // ------------------------------------------------------------------
  // Manamon data access
  // ------------------------------------------------------------------
  function monTypes(mon) {
    if (!mon) return [];
    const fix = state.typeFix[String(mon.id)];
    return fix ? fix.slice() : mon.types.slice();
  }
  function monUnsure(mon) {
    if (!mon) return "";
    if (state.typeFix[String(mon.id)]) return "";
    return mon.uncertain || "";
  }
  function findMonByName(name) {
    const k = norm(name);
    if (!k) return null;
    for (const m of MONS) {
      if (norm(m.name) === k || (m.aliases || []).some(a => norm(a) === k)) return m;
    }
    return null;
  }

  function searchMons(query, extraFilter) {
    const q = norm(query);
    const out = [];
    for (const m of MONS) {
      if (extraFilter && !extraFilter(m)) continue;
      if (!q) { out.push({ m, rank: 0 }); continue; }
      if (/^\d+$/.test(q)) {
        if (String(m.id) === q) out.push({ m, rank: 0 });
        else if (String(m.id).startsWith(q)) out.push({ m, rank: 1 });
        continue;
      }
      let best = Infinity;
      for (const nm of [m.name].concat(m.aliases || [])) {
        const k = norm(nm);
        if (k === q) best = Math.min(best, 0);
        else if (k.startsWith(q)) best = Math.min(best, 1);
        else if (k.includes(q)) best = Math.min(best, 2);
        else if (q.length >= 3) {
          const d = Math.min(editDistance(q, k), editDistance(q, k.slice(0, q.length)) + 1);
          const allowed = q.length <= 4 ? 1 : Math.floor(q.length / 3);
          if (d <= allowed) best = Math.min(best, 3 + d);
        }
      }
      if (best < Infinity) out.push({ m, rank: best });
    }
    out.sort((a, b) => a.rank - b.rank || idOrder(a.m) - idOrder(b.m));
    return out.map(x => x.m);
  }
  function idOrder(m) {
    const n = parseInt(String(m.id), 10);
    return n + (String(m.id).match(/[a-z]/) ? 0.5 : 0);
  }
  function monLabel(m) {
    const unsure = monUnsure(m) ? ", types not sure" : "";
    return `${m.name}, ID ${m.id}, ${typesText(monTypes(m))}${unsure}`;
  }

  // ------------------------------------------------------------------
  // Damage maths
  // ------------------------------------------------------------------
  // Type effect of one attack type against a set of defender types.
  function attackTypeVs(atk, defTypes, move, spiritSight) {
    let f = 1;
    let usedSpirit = false;
    for (const d of defTypes) {
      let x = CHART[atk][d];
      if (move && move.superVs && d === move.superVs) x = 2;
      if (x === 0 && spiritSight && d === "Ghost" && (atk === "Standard" || atk === "Fighting")) {
        x = 1;
        usedSpirit = true;
      }
      f *= x;
    }
    return { f, usedSpirit };
  }

  function knowsSpiritSight(member) {
    return !!member && member.moves.some(mv => /spirit\s*sight/i.test(mv.name));
  }

  function moveEffect(move, member, defTypes) {
    const types = move.types.length ? move.types : ["Standard"];
    const spirit = knowsSpiritSight(member);
    const parts = types.map(t => attackTypeVs(t, defTypes, move, spirit));
    let mult;
    if (S().dualMode === "best") mult = Math.max(...parts.map(p => p.f));
    else mult = parts.reduce((acc, p) => acc * p.f, 1);
    return { mult, usedSpirit: parts.some(p => p.usedSpirit) };
  }

  function sameTypeBonus(move, member) {
    return move.types.some(t => member.types.includes(t)) ? Number(S().stab) || 1 : 1;
  }

  function powerWord(p) {
    const s = S();
    if (p < s.weakBelow) return "terrible";
    if (p < s.normalBelow) return "normal";
    if (p <= s.goodUpTo) return "good";
    return "really great";
  }

  function activeTeam() {
    return state.team.filter(m => m.active);
  }

  // Every attacking move of the active team against these types, best first.
  function rankMoves(defTypes) {
    const rows = [];
    for (const mon of activeTeam()) {
      for (const mv of mon.moves) {
        if (mv.category === "Status" || !mv.name) continue;
        const eff = moveEffect(mv, mon, defTypes);
        const stab = sameTypeBonus(mv, mon);
        const varies = !(mv.power > 0);
        const score = varies ? null : Math.round(mv.power * eff.mult * stab);
        rows.push({ mon, mv, mult: eff.mult, usedSpirit: eff.usedSpirit, stab, score, varies });
      }
    }
    rows.sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score) || b.mult - a.mult);
    return rows;
  }

  // How much damage a member takes from each attack type.
  function incoming(member, atkTypes) {
    const per = atkTypes.map(t => ({
      type: t,
      mult: member.types.reduce((acc, d) => acc * CHART[t][d], 1)
    }));
    const worst = per.length ? Math.max(...per.map(p => p.mult)) : 1;
    const avg = per.length ? per.reduce((a, p) => a + p.mult, 0) / per.length : 1;
    return { per, worst, avg };
  }

  function rankDefenders(atkTypes) {
    return activeTeam()
      .map(mon => Object.assign({ mon }, incoming(mon, atkTypes)))
      .sort((a, b) => a.worst - b.worst || a.avg - b.avg);
  }

  function bestPerMember(defTypes, atkTypes) {
    const moves = rankMoves(defTypes);
    return activeTeam().map(mon => {
      const mine = moves.filter(r => r.mon === mon && r.score != null);
      const best = mine[0] || null;
      const varies = moves.filter(r => r.mon === mon && r.varies);
      const inc = incoming(mon, atkTypes);
      return { mon, best, varies, inc };
    });
  }

  // The pick: strongest attacker that does not take extra damage.
  function overallPick(defTypes, atkTypes) {
    const rows = bestPerMember(defTypes, atkTypes).filter(r => r.best);
    if (!rows.length) return null;
    const safe = rows.filter(r => r.inc.worst <= 1);
    const pool = safe.length ? safe : rows;
    pool.sort((a, b) => b.best.score - a.best.score || a.inc.worst - b.inc.worst);
    return { row: pool[0], safe: safe.length > 0 };
  }

  function moveTypeText(mv) {
    return mv.types.length ? listWords(mv.types) : "no type";
  }

  function describeMoveRow(r, withMon) {
    const who = withMon ? `${r.mon.name}'s ` : "";
    if (r.varies) {
      return `${who}${r.mv.name} (${moveTypeText(r.mv)}, power changes): ${effectWords(r.mult)}`;
    }
    return `${who}${r.mv.name} (${moveTypeText(r.mv)}, ${r.mv.power} effect points, ${powerWord(r.mv.power)}): ` +
      `${effectWords(r.mult)}, estimated power ${r.score}`;
  }

  // ------------------------------------------------------------------
  // Type selects (up to 4 types)
  // ------------------------------------------------------------------
  function typeOptions(selected, noneLabel) {
    let h = `<option value="">${esc(noneLabel || "None")}</option>`;
    for (const t of TYPES) h += `<option value="${t}"${t === selected ? " selected" : ""}>${t}</option>`;
    return h;
  }

  function renderTypeSelects(container, prefix, values, labelFor) {
    let h = "";
    for (let i = 0; i < 4; i++) {
      const id = `${prefix}-${i}`;
      h += `<div class="field"><label for="${id}">${esc(labelFor(i))}</label>` +
        `<select id="${id}" data-type-index="${i}">${typeOptions(values[i] || "")}</select></div>`;
    }
    container.innerHTML = h;
  }
  function readTypeSelects(container) {
    const out = [];
    container.querySelectorAll("select").forEach(s => {
      if (s.value && !out.includes(s.value)) out.push(s.value);
    });
    return out;
  }
  const ordinal = i => ["First", "Second", "Third", "Fourth"][i];

  // ------------------------------------------------------------------
  // Router
  // ------------------------------------------------------------------
  const VIEWS = ["battle", "next", "items", "team", "manamon", "types", "settings", "help"];
  const renderers = {};
  let currentView = null;

  function showView(name, focusHeading) {
    if (!VIEWS.includes(name)) name = "battle";
    for (const v of VIEWS) $("view-" + v).hidden = v !== name;
    document.querySelectorAll("nav a").forEach(a => {
      if (a.getAttribute("href") === "#" + name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    currentView = name;
    if (renderers[name]) renderers[name]();
    const titles = {
      battle: "Battle helper", next: "What's next", items: "Items in game order", team: "My team",
      manamon: "Manamon list", types: "Type chart", settings: "Settings", help: "Help"
    };
    document.title = `${titles[name]} - Manamon 2 Helper`;
    if (focusHeading) $("h-" + name).focus();
  }
  window.addEventListener("hashchange", () => showView(location.hash.slice(1), true));

  // ------------------------------------------------------------------
  // Battle helper
  // ------------------------------------------------------------------
  let oppMatches = [];

  function fillOppList() {
    const q = $("opp-search").value;
    oppMatches = searchMons(q).slice(0, 60);
    const list = $("opp-list");
    list.innerHTML = oppMatches.map((m, i) =>
      `<option value="${esc(m.id)}"${i === 0 ? " selected" : ""}>${esc(monLabel(m))}</option>`).join("");
    const total = q ? searchMons(q).length : MONS.length;
    clearTimeout(countTimer);
    countTimer = setTimeout(() => {
      $("opp-count").textContent = q
        ? (total ? `${total} match${total === 1 ? "" : "es"}. Best match: ${oppMatches[0].name}.` : "No matches.")
        : "";
    }, 500);
  }
  let countTimer = null;

  function setOpponentFromMon(mon, speak) {
    state.opponent = { id: String(mon.id), name: mon.name, types: monTypes(mon), extra: [] };
    save();
    renderOppTypes();
    renderBattle(speak);
  }

  function renderOppTypes() {
    const types = state.opponent ? state.opponent.types : [];
    renderTypeSelects($("opp-types"), "opp-type", types, i => `${ordinal(i)} type`);
    const extra = state.opponent ? state.opponent.extra || [] : [];
    $("opp-extra").innerHTML = TYPES.map(t =>
      `<label><input type="checkbox" value="${t}"${extra.includes(t) ? " checked" : ""}> ${t}</label>`).join("");
  }

  function oppFromInputs() {
    const types = readTypeSelects($("opp-types"));
    const extra = [];
    $("opp-extra").querySelectorAll("input:checked").forEach(c => extra.push(c.value));
    if (!state.opponent) state.opponent = { id: null, name: "", types: [], extra: [] };
    const mon = state.opponent.id ? MON_BY_ID.get(state.opponent.id) : null;
    // If the types no longer match the chosen Manamon, it becomes a custom opponent.
    if (mon && types.join() !== monTypes(mon).join()) {
      state.opponent.name = `${mon.name} (your types)`;
    } else if (mon) {
      state.opponent.name = mon.name;
    } else {
      state.opponent.name = "";
    }
    state.opponent.types = types;
    state.opponent.extra = extra;
    save();
  }

  function renderBattle(speak) {
    const out = $("battle-output");
    const opp = state.opponent;
    if (!opp || (!opp.types.length && !opp.id)) {
      out.innerHTML = "<p>Choose an opponent Manamon, or set its types, to see results.</p>";
      return;
    }
    const mon = opp.id ? MON_BY_ID.get(opp.id) : null;
    const defTypes = opp.types;
    const atkTypes = defTypes.concat((opp.extra || []).filter(t => !defTypes.includes(t)));
    const name = opp.name || (defTypes.length ? `a ${typesText(defTypes)} Manamon` : "the opponent");
    const team = activeTeam();
    let h = "";

    // Opponent summary
    h += `<h4>Opponent: ${esc(name)}</h4>`;
    h += `<p>Types: ${esc(typesText(defTypes))}.`;
    if (mon) h += ` Manamon number ${esc(mon.id)}.`;
    h += `</p>`;
    if (mon && monUnsure(mon) && defTypes.join() === monTypes(mon).join()) {
      h += `<p class="warn">Types not sure: ${esc(monUnsure(mon))}</p>`;
    }
    if (!defTypes.length) {
      h += `<p class="warn">No types are set, so every attack counts as normal. Set its types above if you know them.</p>`;
    }
    if (!team.length) {
      out.innerHTML = h + `<p class="warn">No Manamon in your party. Go to My team and mark some as "in my party".</p>`;
      return;
    }

    const moves = rankMoves(defTypes);
    const scored = moves.filter(r => r.score != null);
    const per = bestPerMember(defTypes, atkTypes);
    const defenders = rankDefenders(atkTypes);
    const pick = overallPick(defTypes, atkTypes);

    // Summary box
    h += `<div class="summary-box">`;
    let spoken = `${name}, ${typesText(defTypes)}.`;
    if (scored.length) {
      const top = scored[0];
      h += `<p><strong>Strongest move:</strong> ${esc(describeMoveRow(top, true))}.</p>`;
      spoken += ` Strongest move: ${top.mon.name}, ${top.mv.name}, ${effectWords(top.mult)}.`;
      if (top.usedSpirit) h += `<p>Use Spirit Sight first, so this move can hit the Ghost type.</p>`;
    }
    if (atkTypes.length) {
      const safe = defenders[0];
      h += `<p><strong>Takes the least damage:</strong> ${esc(safe.mon.name)} (${esc(typesText(safe.mon.types))}). ` +
        `At worst it ${esc(takesWords(safe.worst))} from ${esc(listWords(safe.per.filter(p => p.mult === safe.worst).map(p => p.type)))} attacks.</p>`;
      spoken += ` Takes least damage: ${safe.mon.name}.`;
    }
    if (pick) {
      h += `<p><strong>Best all-round choice:</strong> ${esc(pick.row.mon.name)}, using ${esc(describeMoveRow(pick.row.best, false))}. ` +
        (pick.safe
          ? `It does not take extra damage from this opponent's types.`
          : `<span class="warn">Every Manamon in your party takes extra damage from this opponent, so this is just the strongest attacker.</span>`) +
        `</p>`;
      if (pick.row.mon !== (scored[0] && scored[0].mon)) spoken += ` All-round choice: ${pick.row.mon.name}.`;
    }
    const goodHits = scored.filter(r => r.mult >= 2);
    if (!goodHits.length && scored.length) {
      h += `<p class="warn">None of your moves are very effective against it.</p>`;
    }
    h += `</div>`;

    // Per member table
    h += `<h4>Your Manamon against ${esc(name)}</h4>`;
    h += `<table><caption>Each Manamon in your party: its best move, and the damage it takes</caption>` +
      `<thead><tr><th scope="col">Manamon</th><th scope="col">Best move</th><th scope="col">Type effect</th>` +
      `<th scope="col">Estimated power</th><th scope="col">Damage it takes</th></tr></thead><tbody>`;
    const perSorted = per.slice().sort((a, b) =>
      (b.best ? b.best.score : -1) - (a.best ? a.best.score : -1));
    for (const r of perSorted) {
      const takes = atkTypes.length
        ? r.inc.per.map(p => `${p.type}: ${takesWords(p.mult)}`).join("; ")
        : "unknown";
      if (r.best) {
        h += `<tr><th scope="row">${esc(r.mon.name)} (${esc(typesText(r.mon.types))})</th>` +
          `<td>${esc(r.best.mv.name)} (${esc(moveTypeText(r.best.mv))}, ${r.best.mv.power} effect points, ${esc(powerWord(r.best.mv.power))})` +
          `${r.best.stab > 1 ? ", same-type bonus" : ""}${r.best.usedSpirit ? ", needs Spirit Sight first" : ""}</td>` +
          `<td>${esc(effectWords(r.best.mult))}</td>` +
          `<td>${r.best.score}</td><td>${esc(takes)}</td></tr>`;
      } else {
        h += `<tr><th scope="row">${esc(r.mon.name)} (${esc(typesText(r.mon.types))})</th>` +
          `<td>No attacking moves</td><td></td><td></td><td>${esc(takes)}</td></tr>`;
      }
    }
    h += `</tbody></table>`;

    // Defense ranking
    if (atkTypes.length) {
      h += `<h4>Who takes the least damage</h4>`;
      h += `<p class="hint">Worked out from the opponent's attack types: ${esc(listWords(atkTypes))}. ` +
        `It may also know moves of other types.</p>`;
      h += `<ol>`;
      for (const d of defenders) {
        const bad = d.per.filter(p => p.mult > 1);
        const good = d.per.filter(p => p.mult < 1);
        let line = `${d.mon.name} (${typesText(d.mon.types)}): at worst ${takesWords(d.worst)}.`;
        if (bad.length) line += ` Weak to ${listWords(bad.map(p => `${p.type} (${fmtNum(p.mult)} times)`))}.`;
        if (good.length) line += ` Resists ${listWords(good.map(p => `${p.type} (${p.mult === 0 ? "no damage" : fmtNum(p.mult)})`))}.`;
        h += `<li class="${d.worst > 1 ? "warn" : ""}">${esc(line)}</li>`;
      }
      h += `</ol>`;
    }

    // All moves
    h += `<h4>All your moves, strongest first</h4>`;
    h += `<table><caption>Every attacking move in your party against ${esc(name)}</caption>` +
      `<thead><tr><th scope="col">Rank</th><th scope="col">Move</th><th scope="col">Manamon</th>` +
      `<th scope="col">Move type</th><th scope="col">Effect points</th><th scope="col">Type effect</th>` +
      `<th scope="col">Estimated power</th></tr></thead><tbody>`;
    let rank = 0;
    for (const r of scored) {
      rank++;
      h += `<tr><td>${rank}</td><th scope="row">${esc(r.mv.name)}</th><td>${esc(r.mon.name)}</td>` +
        `<td>${esc(moveTypeText(r.mv))}${r.stab > 1 ? ", same type as user" : ""}</td>` +
        `<td>${r.mv.power}, ${esc(powerWord(r.mv.power))}</td><td>${esc(effectWords(r.mult))}` +
        `${r.usedSpirit ? ", after Spirit Sight" : ""}</td><td>${r.score}</td></tr>`;
    }
    h += `</tbody></table>`;
    const varies = moves.filter(r => r.varies);
    if (varies.length) {
      h += `<h4>Moves whose power changes</h4><ul>`;
      for (const r of varies) h += `<li>${esc(describeMoveRow(r, true))}.</li>`;
      h += `</ul>`;
    }

    // Opponent info
    if (mon) h += monInfoHtml(mon, 4, false);

    out.innerHTML = h;
    if (speak) announce(spoken);
  }

  function useSelectedOpponent() {
    const id = $("opp-list").value || (oppMatches[0] && String(oppMatches[0].id));
    const mon = id ? MON_BY_ID.get(id) : null;
    if (!mon) {
      announce("No Manamon matches. Check the spelling, or set the types yourself.");
      return;
    }
    setOpponentFromMon(mon, true);
  }

  function setupBattle() {
    $("opp-search").addEventListener("input", fillOppList);
    $("opp-search").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (oppMatches[0]) $("opp-list").value = String(oppMatches[0].id);
        useSelectedOpponent();
      } else if (e.key === "ArrowDown" && oppMatches.length) {
        e.preventDefault();
        $("opp-list").focus();
      }
    });
    $("opp-list").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); useSelectedOpponent(); }
    });
    $("opp-list").addEventListener("dblclick", useSelectedOpponent);
    $("opp-use").addEventListener("click", useSelectedOpponent);
    $("opp-types").addEventListener("change", () => { oppFromInputs(); renderBattle(true); });
    $("opp-extra").addEventListener("change", () => { oppFromInputs(); renderBattle(false); });
    fillOppList();
    renderOppTypes();
  }
  renderers.battle = () => renderBattle(false);

  // Shared Manamon information block.
  function monInfoHtml(mon, level, withActions) {
    const H = n => `h${Math.min(6, level + n)}`;
    const types = monTypes(mon);
    let h = `<${H(0)}>About ${esc(mon.name)}</${H(0)}>`;
    h += `<p>${esc(mon.name)}, Manamon number ${esc(mon.id)}. Types: ${esc(typesText(types))}.`;
    if (state.typeFix[String(mon.id)]) h += ` (You set these types yourself.)`;
    else if (mon.confirmed) h += ` (Types confirmed by ${esc(mon.confirmed)}.)`;
    h += `</p>`;
    if (monUnsure(mon)) h += `<p class="warn">Types not sure: ${esc(monUnsure(mon))}</p>`;
    if (mon.aliases && mon.aliases.length) h += `<p>Also spelled: ${esc(listWords(mon.aliases))}.</p>`;
    const evo = [];
    for (const e of mon.evolvesFrom || []) {
      const o = MON_BY_ID.get(String(e.id));
      if (o) evo.push(`Transforms from ${o.name} (${e.how}).`);
    }
    for (const e of mon.evolvesTo || []) {
      const o = MON_BY_ID.get(String(e.id));
      if (o) evo.push(`Transforms into ${o.name} (${e.how}).`);
    }
    if (mon.formOf != null) {
      const o = MON_BY_ID.get(String(mon.formOf));
      if (o) evo.push(`A special form of ${o.name}.`);
    }
    if (evo.length) h += `<p>${esc(evo.join(" "))}</p>`;
    for (const n of mon.notes || []) h += `<p>Note: ${esc(n)}</p>`;
    if (mon.guideNotes) h += `<p>The walkthrough says: ${esc(mon.guideNotes)}</p>`;

    h += `<${H(1)}>Where to find ${esc(mon.name)}</${H(1)}>`;
    const locs = mon.locations || [];
    if (!locs.length) {
      h += `<p>The list does not say where to find it. It may come from transforming, trading or an event.</p>`;
    } else {
      const groups = [];
      for (const l of locs) {
        let g = groups.find(x => x.region === l.region);
        if (!g) { g = { region: l.region, places: [] }; groups.push(g); }
        g.places.push(l.place);
      }
      h += `<ul>`;
      for (const g of groups) {
        const region = g.region === "Tangeria" ? "Tangeria (the Manamon 1 country)" : (g.region || "Place");
        h += `<li>${esc(region)}: ${esc(g.places.join(", "))}.</li>`;
      }
      h += `</ul>`;
    }
    const seen = [];
    STEPS.forEach(st => {
      if (st.wild && st.wild.some(w => String(w.id) === String(mon.id))) seen.push(st.title);
    });
    if (seen.length) {
      h += `<p>The walkthrough lists it as a wild Manamon in: ${esc(listWords(Array.from(new Set(seen))))}.</p>`;
    }
    if (withActions) {
      h += `<div class="button-row"><button type="button" data-act="use-opp" data-id="${esc(mon.id)}">` +
        `Use ${esc(mon.name)} as the opponent in the Battle helper</button></div>`;
    }
    return h;
  }

  // ------------------------------------------------------------------
  // What's next
  // ------------------------------------------------------------------
  function progress() {
    return state.progress == null ? -1 : state.progress;
  }

  function stepLabel(st) {
    if (st.kind === "battle") return (st.major ? "Big battle: " : "Battle: ") + st.title;
    if (st.kind === "chapter") return "Section: " + st.title;
    return "Place: " + st.title;
  }

  function areaOfStep(n) {
    for (let i = n; i >= 0; i--) if (STEPS[i].kind === "area") return STEPS[i];
    return null;
  }

  function fillProgressSelect() {
    const sel = $("progress-select");
    let h = `<option value="-1">Start of the game</option>`;
    let groupOpen = false;
    let part = 1;
    let groupStart = true;
    STEPS.forEach((st, i) => {
      if (groupStart) {
        // group label: up to the next big battle
        let j = i;
        while (j < STEPS.length && !(STEPS[j].kind === "battle" && STEPS[j].major)) j++;
        const end = j < STEPS.length ? STEPS[j].title : "the end";
        if (groupOpen) h += `</optgroup>`;
        h += `<optgroup label="${esc(`Part ${part}: up to ${end}`)}">`;
        groupOpen = true;
        groupStart = false;
        part++;
      }
      h += `<option value="${i}">${esc(stepLabel(st))}</option>`;
      if (st.kind === "battle" && st.major) groupStart = true;
    });
    if (groupOpen) h += `</optgroup>`;
    sel.innerHTML = h;
    sel.value = String(progress());
  }

  function setProgress(n, speak) {
    n = Math.max(-1, Math.min(STEPS.length - 1, n));
    state.progress = n;
    save();
    $("progress-select").value = String(n);
    renderNext();
    if (speak) {
      const st = STEPS[n];
      const nb = nextBattles(1)[0];
      announce(`Now at ${st ? stepLabel(st) : "the start of the game"}.` +
        (nb ? ` Next battle: ${nb.title}.` : " No more battles in the walkthrough."));
    }
  }

  function nextBattles(count) {
    const out = [];
    for (let i = progress() + 1; i < STEPS.length && out.length < count; i++) {
      if (STEPS[i].kind === "battle") out.push(STEPS[i]);
    }
    return out;
  }

  // Same Manamon at the same level said once: "Chydon's, Blake's and Domonne's Kangard".
  function groupOpponents(list) {
    const out = [];
    for (const o of list) {
      const key = [o.name, o.level, o.equip || "", o.note || ""].join("|");
      const g = out.find(x => x.key === key);
      if (g) {
        g.times++;
        if (o.owner) g.owners.push(o.owner);
      } else {
        out.push(Object.assign({}, o, { key, times: o.count || 1, owners: o.owner ? [o.owner] : [] }));
      }
    }
    return out;
  }

  // Opponents of a battle, with Byron's starter choice worked out.
  function battleOpponents(st) {
    const list = [];
    for (const o of st.opponents || []) {
      if (o.alts) {
        const pickLine = D.starters.byronPicks[S().starter];
        const names = (D.starters.lines[pickLine] || []).map(x => norm(x.name));
        let alt = o.alts.find(a => names.includes(norm(a.name))) || o.alts[0];
        const mon = alt.id != null ? MON_BY_ID.get(String(alt.id)) : null;
        list.push({ name: mon ? mon.name : alt.name, mon, level: o.level, note: "picked to beat your starter" });
      } else {
        const mon = o.id != null ? MON_BY_ID.get(String(o.id)) : null;
        let name = mon ? mon.name : o.name;
        if (o.boss) name = o.name;
        list.push({ name, mon, level: o.level, equip: o.equip, owner: o.owner, count: o.count });
      }
    }
    return list;
  }

  function oppLine(o) {
    const types = o.mon ? monTypes(o.mon) : [];
    let s = o.name;
    if (o.owners && o.owners.length) s = `${listWords(o.owners.map(w => w + "'s"))} ${o.name}`;
    else if (o.times > 1) s = `${o.times} times ${o.name}`;
    if (o.level) s += `, level ${o.level}`;
    s += `, ${typesText(types)}`;
    if (o.mon && monUnsure(o.mon)) s += " (types not sure)";
    if (o.equip) s += `, holding ${o.equip}`;
    if (o.note) s += ` (${o.note})`;
    s += ".";
    if (!o.mon) return s;
    const pick = overallPick(types, types);
    const moves = rankMoves(types).filter(r => r.score != null);
    if (moves.length) {
      s += ` Strongest: ${describeMoveRow(moves[0], true)}.`;
      if (moves[0].usedSpirit) s += " Use Spirit Sight first.";
    }
    if (types.length) {
      const d = rankDefenders(types)[0];
      if (d) s += ` Takes least damage: ${d.mon.name} (at worst ${takesWords(d.worst)}).`;
    }
    if (pick && moves.length && pick.row.mon !== moves[0].mon) {
      s += ` All-round choice: ${pick.row.mon.name} with ${pick.row.best.mv.name}.`;
    }
    return s;
  }

  function nextBigBattle() {
    for (let i = progress() + 1; i < STEPS.length; i++) {
      if (STEPS[i].kind === "battle" && STEPS[i].major) return STEPS[i];
    }
    return null;
  }

  function prepareMessages(battles) {
    const msgs = [];
    const team = activeTeam();
    // next big battle
    let big = null, bigIndex = 0, count = 0;
    for (let i = progress() + 1; i < STEPS.length; i++) {
      if (STEPS[i].kind !== "battle") continue;
      count++;
      if (STEPS[i].major) { big = STEPS[i]; bigIndex = count; break; }
    }
    if (big) {
      const opps = battleOpponents(big).filter(o => o.mon);
      const typeCount = {};
      opps.forEach(o => monTypes(o.mon).forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1; }));
      const common = Object.keys(typeCount).sort((a, b) => typeCount[b] - typeCount[a]);
      let m = `Next big battle: ${big.title}, ` + (bigIndex === 1 ? "it is the very next battle." : `in ${bigIndex} battles.`);
      if (big.bossLevel) m += ` Level ${big.bossLevel}.`;
      if (common.length) m += ` Its Manamon use these types the most: ${listWords(common.slice(0, 4))}.`;
      if (opps.length && team.length) {
        const answers = opps.map(o => {
          const r = rankMoves(monTypes(o.mon)).find(x => x.score != null);
          return r ? `${o.name}: ${r.mon.name} with ${r.mv.name} (${effectWords(r.mult)})` : null;
        }).filter(Boolean);
        if (answers.length) m += ` Your best answers: ${answers.join("; ")}.`;
      } else if (!opps.length) {
        m += " This is a special battle with no normal Manamon list. Its guide tips are just below.";
      }
      msgs.push(m);
    }
    // gaps
    const gaps = [];
    const danger = {};
    for (const st of battles) {
      for (const o of battleOpponents(st)) {
        if (!o.mon) continue;
        const types = monTypes(o.mon);
        if (!types.length) continue;
        const best = rankMoves(types).find(x => x.score != null);
        if (team.length && (!best || best.mult < 2)) gaps.push(`${o.name} (${typesText(types)}, in ${st.title})`);
        for (const t of types) {
          const weak = team.filter(mem => incoming(mem, [t]).worst >= 2).map(mem => mem.name);
          if (team.length && weak.length >= Math.ceil(team.length / 2)) danger[t] = weak;
        }
      }
    }
    const uniqueGaps = Array.from(new Set(gaps));
    if (uniqueGaps.length) {
      msgs.push(`Nothing in your party is very effective against: ${uniqueGaps.join("; ")}.`);
    }
    for (const t of Object.keys(danger)) {
      msgs.push(`Watch out for ${t} attacks: they are very effective against ${danger[t].length} of your ` +
        `${team.length} party Manamon (${listWords(danger[t])}).`);
    }
    // levels
    const levels = team.map(m => Number(m.level)).filter(x => x > 0);
    if (levels.length) {
      let maxOpp = 0;
      battles.forEach(st => battleOpponents(st).forEach(o => { if (o.level > maxOpp) maxOpp = o.level; }));
      const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
      if (maxOpp && avg + 3 < maxOpp) {
        msgs.push(`The strongest opponent coming up is level ${maxOpp}, but your party's average level is ${avg}. Some training would help.`);
      }
    }
    // tools coming soon
    for (const t of D.tools) {
      if (t.step == null || state.tools[t.id] !== undefined) continue;
      if (t.step > progress() && t.step <= progress() + 60) {
        const later = countItemsWaitingFor(t.id);
        msgs.push(`Coming up: you get the ${t.name} (${t.what}) at ${t.where}.` +
          (later ? ` Then you can go back for ${later} item${later === 1 ? "" : "s"} that need it.` : ""));
      }
    }
    return msgs;
  }

  function renderNext() {
    const out = $("next-output");
    const p = progress();
    const n = Math.max(1, Math.min(30, Number(S().upcoming) || 5));
    $("upcoming-count").value = n;
    let h = "";
    const cur = STEPS[p];
    h += `<h3>You are here</h3>`;
    if (!cur) {
      h += `<p>Start of the game. Choose your place from the list above to get advice for what comes next.</p>`;
    } else {
      const area = areaOfStep(p);
      h += `<p>${esc(stepLabel(cur))}${area && area !== cur ? ", in " + esc(area.title) : ""}.</p>`;
    }

    const battles = nextBattles(n);
    const msgs = prepareMessages(battles);
    h += `<h3>Prepare</h3>`;
    if (msgs.length) {
      h += `<div class="summary-box"><ul>` + msgs.map(m => `<li>${esc(m)}</li>`).join("") + `</ul></div>`;
    } else {
      h += `<p>Nothing special to prepare for.</p>`;
    }
    const big = nextBigBattle();
    if (big && big.notes && big.notes.length && !battles.includes(big)) {
      h += `<details><summary>Guide tips for the next big battle, ${esc(big.title)}</summary>` +
        `<p>${esc(big.notes.join(" "))}</p></details>`;
    }

    h += `<h3>Coming battles</h3>`;
    if (!battles.length) h += `<p>No more battles in the walkthrough after this point.</p>`;
    battles.forEach((st, i) => {
      const area = areaOfStep(st.n);
      h += `<h4>${i + 1}. ${esc(st.major ? "Big battle" : "Battle")}: ${esc(st.title)}` +
        `${area ? ", " + esc(area.title) : ""}</h4>`;
      const opps = battleOpponents(st);
      if (st.bossLevel && !opps.some(o => o.level)) h += `<p>Level ${st.bossLevel}.</p>`;
      if (opps.length) {
        h += `<ul>` + groupOpponents(opps).map(o => `<li>${esc(oppLine(o))}</li>`).join("") + `</ul>`;
      } else {
        h += `<p>No normal Manamon list for this battle. Read the guide tips.</p>`;
      }
      if (st.notes && st.notes.length) {
        h += `<p><strong>Guide tips:</strong> ${esc(st.notes.join(" "))}</p>`;
      }
      if (i === 0) {
        h += `<p><button type="button" data-act="won" data-n="${st.n}">I won this battle: ${esc(st.title)}</button></p>`;
      }
    });

    // wild Manamon ahead
    const lastN = battles.length ? battles[battles.length - 1].n : STEPS.length - 1;
    const wildAreas = [];
    for (let i = Math.max(0, p); i <= lastN && i < STEPS.length; i++) {
      const st = STEPS[i];
      if (st.wild && st.wild.length) wildAreas.push(st);
    }
    if (wildAreas.length) {
      h += `<h3>Wild Manamon in the places ahead</h3><ul>`;
      for (const st of wildAreas) {
        const list = st.wild.map(w => {
          const m = w.id != null ? MON_BY_ID.get(String(w.id)) : null;
          return m ? `${m.name} (${typesText(monTypes(m))})` : w.name;
        });
        h += `<li>${esc(st.title)}: ${esc(listWords(list))}.</li>`;
      }
      h += `</ul>`;
    }

    // guide text
    h += `<h3>Walkthrough text for the next steps</h3>`;
    h += `<p class="hint">Each part opens when you press Enter on it.</p>`;
    for (let i = Math.max(0, p); i <= lastN && i < STEPS.length; i++) {
      const st = STEPS[i];
      const text = st.kind === "battle"
        ? [].concat(st.notes || [], st.after ? [st.after] : []).join("\n")
        : st.text;
      if (!text) continue;
      h += `<details><summary>${esc(stepLabel(st))}${i === p ? " (where you are)" : ""}</summary>` +
        `<div class="guide-text">${esc(text)}</div></details>`;
    }
    out.innerHTML = h;
  }

  function setupNext() {
    fillProgressSelect();
    $("progress-select").addEventListener("change", e => setProgress(Number(e.target.value), true));
    $("progress-next-step").addEventListener("click", () => setProgress(progress() + 1, true));
    $("progress-next-battle").addEventListener("click", () => {
      const nb = nextBattles(1)[0];
      if (nb) setProgress(nb.n, true);
      else announce("No more battles in the walkthrough.");
    });
    $("progress-prev-battle").addEventListener("click", () => {
      for (let i = progress(); i >= -1; i--) {
        if (i === -1 || STEPS[i].kind === "battle") {
          // go to the step just before that battle, so it is "next" again
          const target = i === -1 ? -1 : i - 1;
          setProgress(Math.max(-1, target), true);
          return;
        }
      }
    });
    const find = () => {
      const q = norm($("progress-find").value);
      if (!q) return;
      const start = progress() + 1;
      const order = [];
      for (let i = start; i < STEPS.length; i++) order.push(i);
      for (let i = 0; i < start; i++) order.push(i);
      const hit = order.find(i => norm(STEPS[i].title).includes(q));
      if (hit == null) { announce("Not found."); return; }
      setProgress(hit, true);
    };
    $("progress-find-go").addEventListener("click", find);
    $("progress-find").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); find(); } });
    $("upcoming-count").addEventListener("change", e => {
      S().upcoming = Math.max(1, Math.min(30, Number(e.target.value) || 5));
      save();
      renderNext();
    });
    $("next-output").addEventListener("click", e => {
      const b = e.target.closest("button[data-act='won']");
      if (!b) return;
      setProgress(Number(b.dataset.n), true);
      $("h-next").focus();
    });
  }
  renderers.next = () => { $("progress-select").value = String(progress()); renderNext(); };

  // ------------------------------------------------------------------
  // Items
  // ------------------------------------------------------------------
  const TOOL_BY_ID = new Map(D.tools.map(t => [t.id, t]));

  function haveTool(id) {
    if (state.tools[id] !== undefined) return !!state.tools[id];
    const t = TOOL_BY_ID.get(id);
    if (!t) return false;
    if (t.step == null) return id === "key";
    return progress() >= t.step;
  }

  function areaReached(a) {
    if (a.side) return !!state.sideReach[a.key];
    return progress() >= a.step;
  }

  function itemStatus(a, it) {
    if (!areaReached(a)) return { status: "unreached", missing: [] };
    const missing = it.needs.filter(t => !haveTool(t));
    if (it.afterStep != null && progress() < it.afterStep) {
      return { status: "later", missing, after: STEPS[it.afterStep] };
    }
    return { status: missing.length ? "later" : "now", missing };
  }

  function countItemsWaitingFor(toolId) {
    let n = 0;
    for (const a of D.itemAreas) {
      if (a.side) continue;
      for (const it of a.items) if (it.needs.includes(toolId) && !state.got[it.id]) n++;
    }
    return n;
  }

  function renderTools() {
    let h = "<ul>";
    for (const t of D.tools) {
      const id = `tool-${t.id}`;
      const auto = state.tools[t.id] === undefined;
      h += `<li class="field check"><input type="checkbox" id="${id}" data-tool="${t.id}"${haveTool(t.id) ? " checked" : ""}>` +
        `<label for="${id}">${esc(t.name)}: ${esc(t.what)}. Where: ${esc(t.where)}.` +
        `${auto ? "" : " (You set this yourself.)"}</label></li>`;
    }
    h += "</ul>";
    $("tool-list").innerHTML = h;
  }

  function renderSideAreas() {
    let h = "<ul>";
    for (const a of D.itemAreas.filter(x => x.side)) {
      const id = `side-${norm(a.key)}`;
      h += `<li class="field check"><input type="checkbox" id="${id}" data-side="${esc(a.key)}"` +
        `${state.sideReach[a.key] ? " checked" : ""}><label for="${id}">I can reach ${esc(a.title)}. ` +
        `${esc(a.side)}</label></li>`;
    }
    h += "</ul>";
    $("side-areas").innerHTML = h;
  }

  function toolNames(ids) {
    return listWords(ids.map(id => (TOOL_BY_ID.get(id) || { need: id }).need));
  }

  function renderItems() {
    const filter = state.itemsFilter || "now";
    $("items-filter").value = filter;
    $("items-hide-got").checked = !!state.hideGot;
    const cur = STEPS[progress()];
    $("items-progress-note").textContent = cur
      ? `Your place in the game: ${stepLabel(cur)}. Change it in the "What's next" section.`
      : `Your place in the game is not set, so only the start counts as reached. Set it in the "What's next" section.`;
    renderTools();
    renderSideAreas();
    const out = $("items-output");

    if (filter === "shops") {
      let h = "";
      for (const s of D.shops) {
        const reached = s.step == null || progress() >= s.step;
        h += `<h3>${esc(s.name)}</h3><p>${reached ? "You have reached this shop." :
          "You have not reached this shop yet."}${s.note ? " " + esc(s.note) : ""}</p>`;
        for (const sec of s.sections) {
          if (sec.name) h += `<h4>${esc(sec.name)}</h4>`;
          h += `<ul>` + sec.goods.map(g => `<li>${esc(g)}</li>`).join("") + `</ul>`;
        }
      }
      h += `<h3>Manapedia rewards</h3><p>Given at Alozza's Research Facility for seeing and catching Manamon.</p><ul>` +
        D.manapediaRewards.map(r => `<li>${esc(r)}</li>`).join("") + `</ul>`;
      out.innerHTML = h;
      $("items-count").textContent = `${D.shops.length} shops.`;
      return;
    }

    let h = "";
    let shown = 0;
    for (const a of D.itemAreas) {
      const rows = [];
      for (const it of a.items) {
        if (state.hideGot && state.got[it.id]) continue;
        const st = itemStatus(a, it);
        const ok = filter === "all" ||
          (filter === "now" && st.status === "now") ||
          (filter === "later" && st.status === "later") ||
          (filter === "reached" && st.status !== "unreached");
        if (!ok) continue;
        rows.push({ it, st });
      }
      if (!rows.length) continue;
      shown += rows.length;
      let where;
      if (a.side) where = areaReached(a) ? "Side area, you said you can reach it." : `Side area. ${a.side}`;
      else if (areaReached(a)) where = "You have been here.";
      else where = `You reach this place at: ${stepLabel(STEPS[a.step])}.`;
      h += `<h3>${esc(a.title)}</h3><p class="hint">${esc(where)}${a.note ? " " + esc(a.note) : ""}</p><ul class="items">`;
      for (const { it, st } of rows) {
        const id = `got-${norm(it.id)}`;
        let text = "";
        if (it.hidden) text += "Hidden item. ";
        text += it.where ? it.where : "No directions in the item guide.";
        if (!/[.!?)]$/.test(text)) text += ".";
        if (it.note) text += " " + it.note;
        if (it.needs.length) text += ` Needs: ${toolNames(it.needs)}.`;
        if (st.status === "later") {
          const parts = [];
          if (st.missing.length) parts.push(`you still need ${toolNames(st.missing)}`);
          if (st.after) parts.push(`it is only there after: ${stepLabel(st.after)}`);
          text += ` Come back later: ${parts.join(", and ")}.`;
        }
        if (st.status === "unreached") text += " You have not reached this place yet.";
        const eq = D.equipmentNotes[it.name];
        if (eq) text += ` The walkthrough says: ${eq}`;
        h += `<li><input type="checkbox" id="${id}" data-item="${esc(it.id)}"${state.got[it.id] ? " checked" : ""}>` +
          ` <label for="${id}">${esc(it.name)}</label>${state.got[it.id] ? " (picked up)" : ""}. ${esc(text)}</li>`;
      }
      h += `</ul>`;
    }
    if (!shown) {
      h = `<p>No items to show with this choice.</p>`;
    }
    out.innerHTML = h;
    $("items-count").textContent = `${shown} item${shown === 1 ? "" : "s"} shown.`;
  }

  function setupItems() {
    $("items-filter").addEventListener("change", e => { state.itemsFilter = e.target.value; save(); renderItems(); });
    $("items-hide-got").addEventListener("change", e => { state.hideGot = e.target.checked; save(); renderItems(); });
    $("tool-list").addEventListener("change", e => {
      const id = e.target.dataset.tool;
      if (!id) return;
      state.tools[id] = e.target.checked;
      save();
      renderItems();
      $(`tool-${id}`).focus();
    });
    $("tools-reset").addEventListener("click", () => {
      state.tools = {};
      save();
      renderItems();
      announce("Tools now follow your game progress.");
    });
    $("side-areas").addEventListener("change", e => {
      const key = e.target.dataset.side;
      if (!key) return;
      state.sideReach[key] = e.target.checked;
      save();
      const focusId = e.target.id;
      renderItems();
      const again = $(focusId);
      if (again) again.focus();
    });
    $("items-output").addEventListener("change", e => {
      const id = e.target.dataset.item;
      if (!id) return;
      if (e.target.checked) state.got[id] = true;
      else delete state.got[id];
      save();
      announce(e.target.checked ? "Marked as picked up." : "Marked as not picked up.");
    });
  }
  renderers.items = renderItems;

  // ------------------------------------------------------------------
  // Team editor
  // ------------------------------------------------------------------
  const openMembers = new Set();

  function memberSummary(m) {
    return `${m.name}: ${typesText(m.types)}${m.level ? ", level " + m.level : ""}. ` +
      `${m.moves.length} move${m.moves.length === 1 ? "" : "s"}. ${m.active ? "In my party." : "Not in my party."}`;
  }

  function moveSummary(mv) {
    if (mv.category === "Status") return `${mv.name}: ${moveTypeText(mv)}, status move (no damage).`;
    const p = mv.power > 0 ? `${mv.power} effect points, ${powerWord(mv.power)}` : "power changes";
    return `${mv.name}: ${moveTypeText(mv)}, ${mv.category.toLowerCase()}, ${p}.` +
      (mv.superVs ? ` Always very effective against ${mv.superVs}.` : "");
  }

  function renderTeam() {
    const list = $("team-list");
    if (!state.team.length) {
      list.innerHTML = "<p>Your team is empty. Add a Manamon, or paste the game text above.</p>";
      return;
    }
    let h = "";
    state.team.forEach((m, i) => {
      const p = `tm${i}`;
      h += `<div class="card"><h4 id="${p}-h" tabindex="-1">${esc(m.name)}</h4>`;
      h += `<p id="${p}-sum">${esc(memberSummary(m))}</p>`;
      h += `<ul>` + m.moves.map(mv => `<li>${esc(moveSummary(mv))}</li>`).join("") + `</ul>`;
      h += `<details data-uid="${m.uid}"${openMembers.has(m.uid) ? " open" : ""}>` +
        `<summary>Edit ${esc(m.name)}</summary>`;
      h += `<div class="field"><label for="${p}-name">Name</label>` +
        `<input type="text" id="${p}-name" data-i="${i}" data-f="name" value="${esc(m.name)}"></div>`;
      h += `<p><button type="button" data-act="lookup" data-i="${i}">Fill in the types from the Manamon list</button></p>`;
      h += `<div class="field check"><input type="checkbox" id="${p}-active" data-i="${i}" data-f="active"${m.active ? " checked" : ""}>` +
        `<label for="${p}-active">In my party (used by the Battle helper)</label></div>`;
      h += `<div class="field"><label for="${p}-level">Level (optional)</label>` +
        `<input type="number" min="1" max="100" id="${p}-level" data-i="${i}" data-f="level" value="${m.level || ""}"></div>`;
      h += `<fieldset><legend>Types of ${esc(m.name)}</legend><div class="type-row">`;
      for (let k = 0; k < 4; k++) {
        h += `<div class="field"><label for="${p}-t${k}">${ordinal(k)} type</label>` +
          `<select id="${p}-t${k}" data-i="${i}" data-f="type" data-k="${k}">${typeOptions(m.types[k] || "")}</select></div>`;
      }
      h += `</div></fieldset>`;
      m.moves.forEach((mv, j) => {
        const q = `${p}-m${j}`;
        h += `<fieldset class="move-box"><legend>Move ${j + 1} of ${esc(m.name)}: ${esc(mv.name || "no name")}</legend>`;
        h += `<div class="field"><label for="${q}-name">Move name</label>` +
          `<input type="text" id="${q}-name" data-i="${i}" data-j="${j}" data-f="mname" value="${esc(mv.name)}"></div>`;
        h += `<div class="field"><label for="${q}-t0">Move type</label>` +
          `<select id="${q}-t0" data-i="${i}" data-j="${j}" data-f="mtype" data-k="0">${typeOptions(mv.types[0] || "")}</select></div>`;
        h += `<div class="field"><label for="${q}-t1">Second move type, if it has two (like Ice and Fighting)</label>` +
          `<select id="${q}-t1" data-i="${i}" data-j="${j}" data-f="mtype" data-k="1">${typeOptions(mv.types[1] || "")}</select></div>`;
        h += `<div class="field"><label for="${q}-cat">Kind of move</label><select id="${q}-cat" data-i="${i}" data-j="${j}" data-f="mcat">` +
          ["Physical", "Special", "Status"].map(c => `<option value="${c}"${mv.category === c ? " selected" : ""}>` +
            `${c === "Status" ? "Status (no damage)" : c + " attack"}</option>`).join("") + `</select></div>`;
        h += `<div class="field"><label for="${q}-pow">Effect points (0 if it has none, or if its power changes)</label>` +
          `<input type="number" min="0" max="500" id="${q}-pow" data-i="${i}" data-j="${j}" data-f="mpow" value="${mv.power}"></div>`;
        h += `<div class="field"><label for="${q}-acc">Accuracy (optional)</label>` +
          `<input type="number" min="0" max="100" id="${q}-acc" data-i="${i}" data-j="${j}" data-f="macc" value="${mv.accuracy == null ? "" : mv.accuracy}"></div>`;
        h += `<div class="field"><label for="${q}-sv">Always very effective against this type (only for special moves like Hypermagnet)</label>` +
          `<select id="${q}-sv" data-i="${i}" data-j="${j}" data-f="msv">${typeOptions(mv.superVs || "", "No")}</select></div>`;
        h += `<div class="field"><label for="${q}-desc">Description (optional)</label>` +
          `<textarea id="${q}-desc" rows="2" data-i="${i}" data-j="${j}" data-f="mdesc">${esc(mv.description)}</textarea></div>`;
        h += `<p><button type="button" class="secondary" data-act="rmmove" data-i="${i}" data-j="${j}">Remove the move ${esc(mv.name || (j + 1))}</button></p>`;
        h += `</fieldset>`;
      });
      h += `<div class="button-row"><button type="button" data-act="addmove" data-i="${i}">Add a move to ${esc(m.name)}</button>`;
      if (i > 0) h += `<button type="button" class="secondary" data-act="up" data-i="${i}">Move ${esc(m.name)} up</button>`;
      if (i < state.team.length - 1) h += `<button type="button" class="secondary" data-act="down" data-i="${i}">Move ${esc(m.name)} down</button>`;
      h += `<button type="button" class="secondary" data-act="rm" data-i="${i}">Remove ${esc(m.name)} from the helper</button></div>`;
      h += `</details></div>`;
    });
    list.innerHTML = h;
  }

  function teamChanged(structure, focusId) {
    save();
    if (structure) {
      renderTeam();
      if (focusId && $(focusId)) $(focusId).focus();
    }
  }

  function setupTeam() {
    const list = $("team-list");
    list.addEventListener("toggle", e => {
      const d = e.target;
      if (d.tagName !== "DETAILS" || !d.dataset.uid) return;
      if (d.open) openMembers.add(d.dataset.uid);
      else openMembers.delete(d.dataset.uid);
    }, true);
    list.addEventListener("change", e => {
      const t = e.target;
      const i = Number(t.dataset.i);
      const m = state.team[i];
      if (!m || !t.dataset.f) return;
      const j = t.dataset.j != null ? Number(t.dataset.j) : null;
      const mv = j != null ? m.moves[j] : null;
      let rerender = false;
      switch (t.dataset.f) {
        case "name": m.name = t.value.trim() || "Manamon"; rerender = true; break;
        case "active": m.active = t.checked; break;
        case "level": m.level = Number(t.value) || null; break;
        case "type": {
          const k = Number(t.dataset.k);
          const arr = [0, 1, 2, 3].map(x => (x === k ? t.value : m.types[x] || ""));
          m.types = arr.filter((x, idx) => x && arr.indexOf(x) === idx);
          break;
        }
        case "mname": mv.name = t.value.trim(); rerender = true; break;
        case "mtype": {
          const k = Number(t.dataset.k);
          const arr = [0, 1].map(x => (x === k ? t.value : mv.types[x] || ""));
          mv.types = arr.filter((x, idx) => x && arr.indexOf(x) === idx);
          break;
        }
        case "mcat": mv.category = t.value; break;
        case "mpow": mv.power = Math.max(0, Number(t.value) || 0); break;
        case "macc": mv.accuracy = t.value === "" ? null : Number(t.value); break;
        case "msv": mv.superVs = t.value; break;
        case "mdesc": mv.description = t.value; break;
      }
      save();
      if (rerender) {
        teamChanged(true, t.id);
      } else {
        const sum = $(`tm${i}-sum`);
        if (sum) sum.textContent = memberSummary(m);
      }
    });
    list.addEventListener("click", e => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const i = Number(b.dataset.i);
      const m = state.team[i];
      if (!m) return;
      const act = b.dataset.act;
      if (act === "lookup") {
        const mon = findMonByName(m.name) || searchMons(m.name)[0];
        if (!mon) { announce(`No Manamon called ${m.name} in the list.`); return; }
        m.types = monTypes(mon);
        if (norm(mon.name) !== norm(m.name) && !(mon.aliases || []).some(a => norm(a) === norm(m.name))) {
          m.name = mon.name;
        }
        teamChanged(true, `tm${i}-t0`);
        announce(`${m.name}: ${typesText(m.types)}.${monUnsure(mon) ? " These types are not sure." : ""}`);
      } else if (act === "addmove") {
        m.moves.push({ name: "", types: [], power: 0, category: "Physical", accuracy: null, crit: null, superVs: "", description: "" });
        openMembers.add(m.uid);
        teamChanged(true, `tm${i}-m${m.moves.length - 1}-name`);
        announce("Move added. Type its name.");
      } else if (act === "rmmove") {
        const j = Number(b.dataset.j);
        const name = m.moves[j].name || `move ${j + 1}`;
        if (!confirm(`Remove ${name} from ${m.name}?`)) return;
        m.moves.splice(j, 1);
        teamChanged(true, `tm${i}-name`);
        announce(`${name} removed.`);
      } else if (act === "up" || act === "down") {
        const to = act === "up" ? i - 1 : i + 1;
        state.team.splice(i, 1);
        state.team.splice(to, 0, m);
        teamChanged(true, `tm${to}-h`);
        announce(`${m.name} is now number ${to + 1}.`);
      } else if (act === "rm") {
        if (!confirm(`Remove ${m.name} from the helper?`)) return;
        state.team.splice(i, 1);
        teamChanged(true, null);
        $("h-team").focus();
        announce(`${m.name} removed.`);
      }
    });
    $("team-add").addEventListener("click", () => {
      const m = fixMember({ name: "New Manamon", types: [], active: true, moves: [] });
      state.team.push(m);
      openMembers.add(m.uid);
      teamChanged(true, `tm${state.team.length - 1}-name`);
      announce("Manamon added. Type its name, then use the button to fill in its types.");
    });
    $("team-reset").addEventListener("click", () => {
      if (!confirm("Replace your team with the starting team?")) return;
      state.team = startingTeam();
      teamChanged(true, null);
      announce("Team reset.");
    });
    $("paste-read").addEventListener("click", readPaste);
    $("data-export").addEventListener("click", exportData);
    $("data-import-file").addEventListener("change", importData);
  }
  renderers.team = renderTeam;

  // ---- Reading NVDA text from the game ----
  function parseTypeWords(s) {
    const parts = s.replace(/\band\b/gi, ",").split(",").map(x => x.trim()).filter(Boolean);
    const out = parts.map(p => TYPES.find(t => t.toLowerCase() === p.toLowerCase()));
    return out.length && out.every(Boolean) ? out : null;
  }

  function parseGameText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l =>
      l && !/^new notification from/i.test(l) && !/^\S{18,}$/.test(l));
    const found = [];
    const byName = name => {
      let f = found.find(x => norm(x.name) === norm(name));
      if (!f) { f = { name, types: null, moves: [] }; found.push(f); }
      return f;
    };
    const stops = /^(viewing overview|view your party|select an option|party|general|abilities|moves|overview|swap manamon|cancel|train|equipment|give item|cure)\b/i;
    let cur = null, inMoves = false, block = [], firstMove = null;

    const finishMove = () => {
      const name = block[0];
      const typeLine = block[block.length - 1];
      const types = parseTypeWords(typeLine.replace(/\s*type\.?$/i, ""));
      const rest = block.slice(1, -1);
      let power = 0, category = "", accuracy = null, crit = null;
      const desc = [];
      for (const r of rest) {
        let mm;
        if ((mm = r.match(/^(\d+)\s+effect points?/i))) power = Number(mm[1]);
        else if (/^physical attack/i.test(r)) category = "Physical";
        else if (/^(special|magic) attack/i.test(r)) category = "Special";
        else if ((mm = r.match(/^(\d+)\s+accuracy/i))) accuracy = Number(mm[1]);
        else if ((mm = r.match(/^(\d+)\s+percent critical/i))) crit = Number(mm[1]);
        else if (/^the (move|attack) targets/i.test(r)) { /* status target line */ }
        else desc.push(r);
      }
      if (!category) category = power > 0 ? "Physical" : "Status";
      const description = desc.join(" ");
      const sv = description.match(/very effective damage against (?:other )?(\w+) type/i);
      cur.moves.push({
        name, types: types || [], power, category, accuracy, crit,
        superVs: sv ? (TYPES.find(t => t.toLowerCase() === sv[1].toLowerCase()) || "") : "",
        description
      });
      if (!firstMove) firstMove = name;
      block = [];
    };

    for (const line of lines) {
      let m;
      if ((m = line.match(/^viewing overview for (.+?)\.?$/i))) {
        cur = byName(m[1].trim());
        inMoves = false;
        continue;
      }
      if (!inMoves && (m = line.match(/^(.+?) is (.+?) type\.?$/i))) {
        const t = parseTypeWords(m[2]);
        if (t) { const f = byName(m[1].trim()); f.types = t; continue; }
      }
      if (/^move list$/i.test(line)) {
        if (cur) { inMoves = true; block = []; firstMove = null; cur.moves = []; }
        continue;
      }
      if (!inMoves) continue;
      if (block.length === 0 && (stops.test(line) || (firstMove && norm(line) === norm(firstMove)))) {
        inMoves = false;
        continue;
      }
      block.push(line);
      const tm = line.match(/^(.+?) type\.?$/i);
      if (block.length >= 2 && tm && parseTypeWords(tm[1])) finishMove();
      else if (block.length > 14) block = [];
    }
    // Fill types from the Manamon list when the text did not say them.
    for (const f of found) {
      const mon = findMonByName(f.name) || searchMons(f.name)[0];
      if (mon && norm(mon.name) !== norm(f.name) && !(mon.aliases || []).some(a => norm(a) === norm(f.name))) {
        f.guessedName = mon.name;
      }
      if (!f.types) {
        f.types = mon ? monTypes(mon) : [];
        f.typesFrom = mon ? "the Manamon list" : "nowhere (please set them)";
      } else {
        f.typesFrom = "the game text";
      }
    }
    return found.filter(f => f.moves.length || f.types.length);
  }

  let pasteFound = [];
  function readPaste() {
    pasteFound = parseGameText($("paste-box").value);
    const out = $("paste-result");
    if (!pasteFound.length) {
      out.innerHTML = `<p class="warn">No Manamon found. The text needs lines like "Viewing overview for Kangard." followed by "Move list" and the moves.</p>`;
      return;
    }
    let h = `<h4>Found ${pasteFound.length} Manamon</h4><ul>`;
    for (const f of pasteFound) {
      h += `<li>${esc(f.name)}: ${esc(typesText(f.types))} (types from ${esc(f.typesFrom)}). ` +
        `${f.moves.length} move${f.moves.length === 1 ? "" : "s"}: ${esc(f.moves.map(mv =>
          `${mv.name} (${moveTypeText(mv)}, ${mv.category === "Status" ? "status" : (mv.power || "power changes")})`).join("; "))}.</li>`;
    }
    h += `</ul><div class="button-row"><button type="button" id="paste-replace">Replace my whole team with these</button>` +
      `<button type="button" id="paste-merge" class="secondary">Add these, and update the ones I already have</button></div>`;
    out.innerHTML = h;
    $("paste-replace").addEventListener("click", () => applyPaste(true));
    $("paste-merge").addEventListener("click", () => applyPaste(false));
    announce(`Found ${pasteFound.length} Manamon: ${listWords(pasteFound.map(f => f.name))}. Choose replace or add.`);
  }

  function applyPaste(replace) {
    const members = pasteFound.map(f => fixMember({ name: f.name, types: f.types, active: true, moves: f.moves }));
    if (replace) {
      state.team = members;
    } else {
      for (const nm of members) {
        const old = state.team.find(x => norm(x.name) === norm(nm.name));
        if (old) {
          old.types = nm.types.length ? nm.types : old.types;
          if (nm.moves.length) old.moves = nm.moves;
          old.active = true;
        } else {
          state.team.push(nm);
        }
      }
    }
    save();
    renderTeam();
    $("paste-result").innerHTML = `<p class="ok">Done. Your team now has ${state.team.length} Manamon.</p>`;
    announce(`Team updated. ${state.team.length} Manamon.`);
  }

  // ---- Export / import ----
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "manamon-helper-data.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    announce("Saving the file manamon-helper-data.json. Check your downloads.");
  }

  function importData(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.team)) throw new Error("no team");
        const s = freshState();
        Object.assign(s, data);
        s.settings = Object.assign(clone(DEFAULT_SETTINGS), data.settings || {});
        s.team = data.team.map(fixMember);
        for (const k of ["tools", "got", "sideReach", "typeFix"]) s[k] = data[k] || {};
        state = s;
        save();
        refreshAll();
        announce(`Loaded. Your team has ${state.team.length} Manamon.`);
      } catch (err) {
        announce("That file is not a Manamon helper file.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------------
  // Manamon list
  // ------------------------------------------------------------------
  let monMatches = [];
  let monCountTimer = null;
  function fillMonList(keepSelection) {
    const t = $("mon-type-filter").value;
    const unsure = $("mon-unsure-only").checked;
    const filter = m => (!t || monTypes(m).includes(t) || (t === "none" && !monTypes(m).length)) &&
      (!unsure || !!monUnsure(m));
    monMatches = searchMons($("mon-search").value, filter);
    const list = $("mon-list");
    const prev = list.value;
    list.innerHTML = monMatches.map(m => `<option value="${esc(m.id)}">${esc(monLabel(m))}</option>`).join("");
    if (keepSelection && prev && monMatches.some(m => String(m.id) === prev)) list.value = prev;
    else if (monMatches.length) list.selectedIndex = 0;
    clearTimeout(monCountTimer);
    monCountTimer = setTimeout(() => { $("mon-count").textContent = `${monMatches.length} Manamon shown.`; }, 500);
    renderMonDetails();
  }

  function renderMonDetails() {
    const id = $("mon-list").value;
    const mon = id ? MON_BY_ID.get(id) : null;
    const box = $("mon-details");
    if (!mon) { box.innerHTML = ""; return; }
    let h = monInfoHtml(mon, 3, true);
    const types = monTypes(mon);
    h += `<h4>Fix the types of ${esc(mon.name)}</h4>`;
    h += `<p class="hint">If the game says other types, set them here. The whole helper will use your fix.</p>`;
    h += `<fieldset><legend>Types of ${esc(mon.name)}</legend><div class="type-row" id="fix-types"></div></fieldset>`;
    h += `<div class="button-row"><button type="button" data-act="fix-save" data-id="${esc(mon.id)}">Save these types</button>`;
    if (state.typeFix[String(mon.id)]) {
      h += `<button type="button" class="secondary" data-act="fix-undo" data-id="${esc(mon.id)}">Go back to the guide's types (${esc(typesText(mon.types))})</button>`;
    }
    h += `</div>`;
    box.innerHTML = h;
    renderTypeSelects($("fix-types"), "fix-type", types, i => `${ordinal(i)} type`);
  }

  function setupManamon() {
    $("mon-type-filter").innerHTML = `<option value="">All types</option><option value="none">No type known</option>` +
      TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
    $("mon-search").addEventListener("input", () => fillMonList(false));
    $("mon-search").addEventListener("keydown", e => {
      if (e.key === "ArrowDown" && monMatches.length) { e.preventDefault(); $("mon-list").focus(); }
      if (e.key === "Enter") {
        e.preventDefault();
        if (monMatches[0]) {
          $("mon-list").value = String(monMatches[0].id);
          renderMonDetails();
          announce(monLabel(monMatches[0]));
        }
      }
    });
    $("mon-type-filter").addEventListener("change", () => fillMonList(false));
    $("mon-unsure-only").addEventListener("change", () => fillMonList(false));
    $("mon-list").addEventListener("change", renderMonDetails);
    $("mon-details").addEventListener("click", e => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const mon = MON_BY_ID.get(b.dataset.id);
      if (!mon) return;
      if (b.dataset.act === "use-opp") {
        setOpponentFromMon(mon, false);
        location.hash = "#battle";
        announce(`${mon.name} is now the opponent.`);
      } else if (b.dataset.act === "fix-save") {
        const types = readTypeSelects($("fix-types"));
        if (types.join() === mon.types.join()) delete state.typeFix[String(mon.id)];
        else state.typeFix[String(mon.id)] = types;
        save();
        fillMonList(true);
        announce(`Saved. ${mon.name} is ${typesText(types)}.`);
      } else if (b.dataset.act === "fix-undo") {
        delete state.typeFix[String(mon.id)];
        save();
        fillMonList(true);
        announce(`${mon.name} is back to ${typesText(mon.types)}.`);
      }
    });
    fillMonList(false);
  }
  renderers.manamon = () => fillMonList(true);

  // ------------------------------------------------------------------
  // Type chart
  // ------------------------------------------------------------------
  function renderChartAttack() {
    const a = $("chart-attack").value;
    const groups = { 2: [], 0.5: [], 0: [] };
    for (const d of TYPES) {
      const x = CHART[a][d];
      if (groups[x]) groups[x].push(d);
    }
    let h = `<ul>`;
    h += `<li>${esc(a)} is very effective (2 times) against: ${esc(listWords(groups[2]) || "nothing")}.</li>`;
    h += `<li>${esc(a)} is not very effective (half) against: ${esc(listWords(groups[0.5]) || "nothing")}.</li>`;
    if (groups[0].length) h += `<li>${esc(a)} has no effect on: ${esc(listWords(groups[0]))}.</li>`;
    h += `<li>Everything else takes normal damage.</li></ul>`;
    $("chart-attack-out").innerHTML = h;
  }

  function renderChartDefense() {
    const def = readTypeSelects($("chart-def-types"));
    const out = $("chart-def-out");
    if (!def.length) { out.innerHTML = "<p>Choose at least one type.</p>"; return; }
    const groups = new Map();
    for (const a of TYPES) {
      const x = def.reduce((acc, d) => acc * CHART[a][d], 1);
      if (!groups.has(x)) groups.set(x, []);
      groups.get(x).push(a);
    }
    const keys = Array.from(groups.keys()).sort((p, q) => q - p);
    let h = `<p>A Manamon with the types ${esc(typesText(def))}:</p><ul>`;
    for (const k of keys) {
      if (k === 1) continue;
      h += `<li>${esc(takesWords(k))} from ${esc(listWords(groups.get(k)))}.</li>`;
    }
    h += `<li>Takes normal damage from everything else.</li></ul>`;
    out.innerHTML = h;
  }

  function setupTypes() {
    $("chart-attack").innerHTML = TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
    $("chart-attack").addEventListener("change", renderChartAttack);
    renderTypeSelects($("chart-def-types"), "chart-def", ["Air", "Magic"], i => `${ordinal(i)} type`);
    $("chart-def-types").addEventListener("change", renderChartDefense);
    renderChartAttack();
    renderChartDefense();
    if (D.chartNotes && D.chartNotes.length) {
      $("chart-notes").innerHTML = `<h3>Notes about the chart document</h3><ul>` +
        D.chartNotes.map(n => `<li>${esc(n)} The defensive list says Steel is immune to Poison, so the helper uses that.</li>`).join("") +
        `</ul>`;
    }
  }

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  function renderSettings() {
    const s = S();
    $("set-stab").value = s.stab;
    $("set-dual").value = s.dualMode;
    $("set-weak").value = s.weakBelow;
    $("set-normal").value = s.normalBelow;
    $("set-good").value = s.goodUpTo;
    $("set-starter").value = s.starter;
  }
  function setupSettings() {
    const bind = (id, key, num) => $(id).addEventListener("change", e => {
      S()[key] = num ? Number(e.target.value) : e.target.value;
      save();
      announce("Saved.");
    });
    bind("set-stab", "stab", true);
    bind("set-dual", "dualMode", false);
    bind("set-weak", "weakBelow", true);
    bind("set-normal", "normalBelow", true);
    bind("set-good", "goodUpTo", true);
    bind("set-starter", "starter", false);
    $("data-clear").addEventListener("click", () => {
      if (!confirm("Delete your team, progress, picked up items and settings from this browser?")) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      state = freshState();
      refreshAll();
      announce("Everything deleted. The starting team is back.");
    });
  }
  renderers.settings = renderSettings;

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  function refreshAll() {
    fillProgressSelect();
    renderOppTypes();
    renderTeam();
    if (currentView && renderers[currentView]) renderers[currentView]();
  }

  function setupHelp() {
    $("help-sources").innerHTML = D.builtFrom.map(s => `<li>${esc(s)}</li>`).join("") +
      `<li>Your own game screens, for your team (Mantasteel, Kangard, Friggle, Zebbabern, Groller and Greniverb).</li>`;
  }

  setupBattle();
  setupNext();
  setupItems();
  setupTeam();
  setupManamon();
  setupTypes();
  setupSettings();
  setupHelp();
  renderTeam();
  showView(location.hash.slice(1) || "battle", false);
  if (!storageWorks) {
    announce("This browser is not letting the helper save. Use 'Save all my helper data to a file' in My team.");
  }

  // For testing in a browser console.
  window.ManamonHelper = { parseGameText, rankMoves, rankDefenders, moveEffect, state: () => state };
})();
