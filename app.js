(function () {
  const D = window.WB;
  const byId = Object.fromEntries(D.patients.map(p => [p.id, p]));
  const S = {
    matched: {}, rejected: {}, accepted: {}, dismissed: {}, reasonOpen: null, outcome: {}, guide: {}, signed: {},
    open: null, filter: "today", q: "", valueConfirmed: {}, during: {}, texted: {}, notesUsed: false,
    tour: true, tourMin: false, scoreSeen: false, tasks: [],
  };
  const view = document.getElementById("view");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const bars = l => `<span class="bars l${l}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  const prov = (src, age, l) => `<span class="prov ${l === 0 ? "stale" : ""}">${src ? esc(src) + " · " : ""}${esc(age)} ${bars(l)}</span>`;
  const st = (t, lvl) => `<span class="st ${lvl}">${esc(t)}</span>`;
  const dn = (n, t) => `dn" data-n="${n}" data-t="${esc(t)}`;
  const topLevel = p => (p.reasons.some(r => r[1] === "crit") ? "crit" : p.reasons.some(r => r[1] === "warn") ? "warn" : "info");

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2600);
  }
  function setNav(k) { document.querySelectorAll(".rail-item").forEach(a => a.classList.toggle("on", a.dataset.nav === k)); }
  function addTask(id, text) { S.tasks.unshift({ id, text, who: byId[id].name, at: "Today" }); }

  /* ---------------- demo guide ---------------- */
  const steps = () => [
    { t: "Open a score to see why a member ranks where they do", done: S.scoreSeen, go: "#/today" },
    { t: "Confirm Eleanor Fitzgerald's hospital record", done: !!S.matched["M-43128"] || !!S.rejected["M-43128"], go: "#/brief/M-43128" },
    { t: "Dismiss any next best action and say why", done: Object.keys(S.dismissed).some(k => Object.keys(S.dismissed[k]).length), go: "#/brief/M-41206" },
    { t: "Call Raymond Kessler and sign the note", done: !!S.signed["M-41206"], go: "#/call/M-41206" },
    { t: "Text Kayla Moreno, who has no call minutes", done: !!S.texted["M-42390"], go: "#/call/M-42390" },
  ];
  function renderTour() {
    let el = document.getElementById("tour");
    document.body.classList.toggle("has-tour", S.tour && !S.tourMin);
    if (!S.tour) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("aside"); el.id = "tour"; el.className = "tour"; el.setAttribute("aria-label", "Demo guide"); document.body.appendChild(el); }
    const s = steps(), n = s.filter(x => x.done).length;
    el.classList.toggle("min", S.tourMin);
    el.innerHTML = `<div class="tour-h"><b>Try the demo</b><span class="faint small">${n} of ${s.length} done</span>
      <button class="iconbtn" data-tourmin aria-label="${S.tourMin ? "Expand" : "Collapse"} demo guide">${S.tourMin ? "+" : "–"}</button>
      <button class="iconbtn" data-tourclose aria-label="Close demo guide">×</button></div>
      ${S.tourMin ? "" : `<div class="tour-bar"><i style="width:${n / s.length * 100}%"></i></div>
      <ol>${s.map(x => `<li class="${x.done ? "done" : ""}"><span class="tick" aria-hidden="true"></span><a href="${x.go}">${esc(x.t)}</a></li>`).join("")}</ol>
      <p class="small faint">You are Maria, a nurse case manager, on Monday at 8:00. Refresh the page to start over. <button class="linkish small" data-notes>${document.body.classList.contains("notes") ? "Hide" : "Show"} design notes</button></p>`}`;
  }

  /* ---------------- TODAY / QUEUE ---------------- */
  function queue(filter) {
    S.filter = filter || "today";
    setNav(S.filter === "all" ? "cases" : "today");
    let list = D.patients.slice().sort((a, b) => a.rank - b.rank);
    if (S.filter === "confirm") list = list.filter(p => p.match && !S.matched[p.id] && !S.rejected[p.id]);
    if (S.filter === "unreached") list = list.filter(p => p.id === "M-42017" && !S.signed[p.id]);
    if (S.q) list = list.filter(p => (p.name + " " + p.id + " " + p.routes.map(r => r.who).join(" ")).toLowerCase().includes(S.q.toLowerCase()));
    const pending = D.patients.filter(p => p.match && !S.matched[p.id] && !S.rejected[p.id]).length;
    const tab = (k, label, n) => `<button class="tab ${S.filter === k ? "on" : ""}" data-filter="${k}" role="tab" aria-selected="${S.filter === k}">${label}<b>${n}</b></button>`;
    const doneCount = D.plan.filter(x => planDone(x)).length;

    const rows = list.map(p => {
      const reasons = p.reasons.map(([t, l]) => (p.match && S.matched[p.id] && t.startsWith("Confirm")) ? st("Record confirmed", "ok") : st(t, l)).join("");
      const open = S.open === p.id;
      const prog = progressLine(p);
      const ex = open ? `<div class="explain" data-stop>
          <table>${p.signals.map(i => `<tr><td>${esc(D.rules[i][0])}</td><td>+${D.rules[i][1]}</td></tr>`).join("")}
          <tr><td><b>Priority score</b></td><td>${p.score}</td></tr></table>
          ${p.modelNote ? `<div class="model">${esc(p.modelNote)}</div>` : ""}
          <div class="small faint" style="margin-top:6px">Rules are visible and editable by the clinical lead. You can always re-order.</div></div>` : "";
      return `<div class="qrow item ${topLevel(p)} ${S.signed[p.id] ? "isdone" : ""}" data-go="#/brief/${p.id}" tabindex="0" role="link" aria-label="Open ${esc(p.name)}">
        <div class="rank">${p.rank}</div>
        <div class="who"><b>${esc(p.name)}, ${p.age}</b><span>${esc(p.program)}</span></div>
        <div class="why"><b>${esc(p.whyNow)}</b><div class="reasons">${reasons}</div>${prog ? `<div class="prog">${prog}</div>` : ""}</div>
        <div class="act"><b>${esc(p.actAt.time)}</b><span>${esc(p.actAt.route)}</span></div>
        <div><button class="scorebtn" data-score="${p.id}" aria-expanded="${open}" aria-label="Why priority ${p.score}">${p.score}</button></div>
        ${ex}
      </div>`;
    }).join("");

    const empty = S.q ? `<div class="qfoot">No member matches "${esc(S.q)}" in today's list. Try a surname, member ID or phone number.</div>`
      : S.filter === "confirm" ? `<div class="qfoot">Nothing is waiting for your confirmation.</div>`
      : `<div class="qfoot">Everyone in this view has been contacted today.</div>`;

    view.innerHTML = `
      <div class="topline">
        <div><h1>Good morning, Maria</h1>
        <p class="lede">${D.now}. ${D.summary.newEvents} new events since Friday (${D.summary.rawAlerts} alerts after removing duplicates). ${D.summary.critical} are time-critical today.</p></div>
        <div class="right"><input class="search" id="search" placeholder="Search name, member ID or phone" aria-label="Search members" value="${esc(S.q)}"></div>
      </div>
      <div class="qgrid">
        <section class="pane">
          <div class="tabs ${dn(4, "Record matches below 95% and facts the assistant read from faxes wait here. Nothing is merged automatically.")}" role="tablist">
            ${tab("today", "Needs you today", 5)}${tab("confirm", "Awaiting your confirmation", pending)}${tab("unreached", "Unreached", S.signed["M-42017"] ? 0 : 1)}${tab("all", "All cases", D.nurse.active)}
          </div>
          <div class="qrow qhead"><div>Rank</div><div>Member</div><div class="${dn(1, "Each row leads with a conclusion in plain words, then the 2–4 reasons behind it. Reasons come from combining several data sources. The coloured edge shows the most urgent reason.")}">Why now</div><div class="${dn(3, "Rank decides the order of work; this column decides when the call happens. Fitzgerald is #2 but is called at 12:30, when her daughter can talk.")}">Act at</div><div class="${dn(2, "Click a score to see the rule breakdown. The model's risk score is shown but does not rank.")}">Score</div></div>
          <div class="qlist">${rows || empty}</div>
          ${!S.q && (S.filter === "today" || S.filter === "all") ? `<div class="qfoot">${S.filter === "all" ? "43 more cases have no new signal today. 7 routine follow-ups are due this week." : "43 other cases have no new signal today."}</div>` : ""}
          <div class="feedback ${dn(8, "Every re-order or dismissal asks one question. Rules dismissed often get re-tuned (less alert fatigue). 'Data is wrong' goes back to the data platform as a correction.")}">
            <b>When you re-order or dismiss, we ask why.</b> Already handled, not clinically relevant, or the data is wrong. Frequently dismissed rules get re-tuned by your clinical lead; data problems go back to the data team as corrections.
          </div>
        </section>
        <aside class="side">
          <section class="pane day">
            <div class="pane-h"><h2>Your day</h2><span class="aside">${doneCount} of ${D.plan.length} done</span></div>
            <ul>${D.plan.map(x => `<li class="${planDone(x) ? "done" : ""}"><time>${x.t}</time><a href="#/${x.why.includes("confirm") ? "brief" : x.why.includes("text") || x.why.includes("call") || x.why.includes("number") ? "call" : "brief"}/${x.id}"><b>${esc(x.what)}</b><span class="muted"> – ${esc(x.why)}</span></a></li>`).join("")}</ul>
          </section>
          <section class="pane assist ${dn(6, "Provider-side voice AI (HiLabs Intelligent Outreach) calls offices, pharmacies and vendors – never members. Results land on the case for review.")}">
            <div class="pane-h"><h2>Calls the assistant is making</h2></div>
            <ul>${D.assistant.map(a => `<li><span class="to">${esc(a.to)}</span><div class="row"><span class="muted">${esc(a.task)}</span>${st(S.during["M-41206:Book"] && a.to.startsWith("Northfield") ? "Booked 12 Nov" : a.status, a.level === "ok" || (S.during["M-41206:Book"] && a.to.startsWith("Northfield")) ? "ok" : "info")}</div></li>`).join("")}</ul>
            <div class="pad small faint" style="padding-top:8px">Offices and vendors only. Never members.</div>
          </section>
          <section class="pane ${dn(7, "Caseload against capacity on the nurse's own screen, so spikes are visible before they hurt.")}">
            <div class="pane-h"><h2>Caseload</h2><span class="aside">${D.nurse.active} of ${D.nurse.capacity}</span></div>
            <div class="pad"><div class="capbar"><i style="width:${D.nurse.active / D.nurse.capacity * 100}%"></i></div><span class="small muted">2 new assignments expected today.</span></div>
          </section>
        </aside>
      </div>`;
    const sb = document.getElementById("search");
    sb.addEventListener("input", e => { S.q = e.target.value; const pos = e.target.selectionStart; queue(S.filter); const n = document.getElementById("search"); n.focus(); n.setSelectionRange(pos, pos); });
  }
  function planDone(x) {
    if (x.why.includes("confirm")) return !!S.matched[x.id] || !!S.rejected[x.id];
    if (x.why.includes("text")) return !!S.texted[x.id];
    return !!S.signed[x.id];
  }
  function progressLine(p) {
    const bits = [];
    if (S.signed[p.id]) bits.push(st(`Contacted, note signed ${S.signed[p.id]}`, "ok"));
    else if (S.texted[p.id]) bits.push(st("Text sent 09:02, reply received", "ok"));
    else if (S.outcome[p.id]) bits.push(st(`Last attempt: ${S.outcome[p.id]}`, "info"));
    const n = Object.keys(S.accepted[p.id] || {}).length;
    if (n) bits.push(`<span class="small muted">${n} action${n > 1 ? "s" : ""} accepted</span>`);
    return bits.join(" ");
  }

  /* ---------------- TASKS ---------------- */
  function tasks() {
    setNav("tasks");
    const base = [
      { who: "Darnell Whitaker", text: "Retry new number 555-0261", at: "Today 11:00" },
      { who: "Luis Ortega", text: "Call in Spanish after 17:00", at: "Today 17:15" },
      { who: "Eleanor Fitzgerald", text: "Home-safety evaluation (opened 2 Oct)", at: "Overdue 38 days", lvl: "crit" },
    ];
    const all = S.tasks.concat(base);
    view.innerHTML = `<div class="topline"><div><h1>Tasks</h1><p class="lede">Tasks created from accepted actions appear here automatically, with the member they belong to.</p></div></div>
      <section class="pane list" style="max-width:860px"><div class="pane-h"><h2>Open tasks</h2><span class="aside">${all.length}</span></div>
      <ul>${all.map(t => `<li><span><span class="when">${esc(t.who)}</span>${esc(t.text)}</span>${st(t.at, t.lvl || (t.at === "Today" ? "ok" : "info"))}</li>`).join("")}</ul></section>`;
  }

  /* ---------------- MEMBER BRIEF ---------------- */
  function brief(id) {
    const p = byId[id]; if (!p) return queue();
    setNav("cases");
    const acc = S.accepted[id] || {}, dis = S.dismissed[id] || {};
    const matchPending = p.match && !S.matched[id] && !S.rejected[id];
    const changes = (p.match && S.matched[id] ? p.unlocked.map(c => ({ ...c, isNew: true })) : []).concat(p.changes);
    const medHead = p.medCols.map((c, i) => `<th>${esc(c)}<span class="thprov">${prov("", p.medAges[i][0], p.medAges[i][1])}</span></th>`).join("");
    const medsVisible = !(p.match && !S.matched[id]);
    const medRows = p.meds.filter((m, i) => medsVisible || i > 0).map(m => `<tr class="${m.level}"><td><b>${esc(m.drug)}</b></td>${m.v.map(v => `<td>${esc(v)}</td>`).join("")}<td>${m.flag ? st(m.flag, m.level) : st("Agrees", "ok")}</td></tr>`).join("");
    const isText = p.channel === "text";

    const actions = p.actions.map((a, i) => {
      let body;
      if (a.accept === "Review match" && (S.matched[id] || S.rejected[id])) body = `<div class="done">${st(S.matched[id] ? "Done: record confirmed and linked" : "Done: kept separate", "ok")}</div>`;
      else if (acc[i]) body = `<div class="done">${st("Done: " + a.accept, "ok")}</div>`;
      else if (dis[i]) body = `<div class="dismissed">Dismissed: ${esc(dis[i])}. ${dis[i] === "data is wrong" ? "Sent to the data team as a correction." : "Logged for rule tuning."}</div>`;
      else body = `<div class="row"><button class="btn primary sm" data-accept="${i}">${esc(a.accept)}</button><button class="btn quiet sm" data-dismiss="${i}">Dismiss</button></div>
        ${S.reasonOpen === id + ":" + i ? `<div class="reasonbox"><p>Why are you dismissing this?</p><div class="row">
          <button class="btn sm" data-reason="${i}|already handled">Already handled</button><button class="btn sm" data-reason="${i}|not clinically relevant">Not relevant</button><button class="btn sm" data-reason="${i}|data is wrong">Data is wrong</button></div></div>` : ""}`;
      return `<div class="a"><h3>${esc(a.title)}</h3><p>${esc(a.why)}</p>${body}</div>`;
    }).join("");

    view.innerHTML = `
      <div class="crumb"><a href="#/today">Today</a> / ${esc(p.name)}</div>
      <section class="pane ph">
        <div><h1>${esc(p.name)}, ${p.age}</h1><div class="meta">${p.id} · ${esc(p.plan)} · ${esc(p.lang)}</div><div class="meta">Primary care: ${esc(p.pcp)}</div></div>
        <dl><dt>Best contact</dt><dd>${esc(p.contact)}</dd><dt>Program</dt><dd>${esc(p.program)}</dd></dl>
        <div class="clocks ${dn(7, "Deadlines that matter sit at the top: the follow-up window, the CMS prior-authorization clock, quality-measure dates.")}">${p.deadlines.map(d => `<div class="clock ${d.level}"><div class="l">${esc(d.label)}</div><div class="v">${esc(d.value)}</div><div class="s">${esc(d.sub)}</div></div>`).join("")}</div>
      </section>
      ${matchPending ? `<section class="match ${dn(4, "A hospital record matched at 82%. Below 95% the system only suggests – the nurse confirms in seconds, and the fix goes back to the data platform.")}" id="match">
        <div><h2>A ${esc(p.match.hospital)} record may belong to ${esc(p.first)}</h2>
        <p>${p.match.score}% match. ${esc(p.match.note)} Nothing from this record is shown or merged until you confirm.</p>
        <div class="row" style="display:flex;gap:8px"><button class="btn primary" data-confirm="${id}">Confirm, it's her</button><button class="btn" data-reject="${id}">Not the same person</button></div></div>
        <table><tr><th></th><th>Plan record</th><th>${esc(p.match.hospital)}</th></tr>${p.match.rows.map(r => `<tr class="${r[1] !== r[2] && r[2] !== "Same" && !r[2].startsWith(r[1].split(" ")[0]) ? "diff" : ""}"><td class="muted">${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table>
      </section>` : p.match && S.matched[id] ? `<div class="banner ok">Record confirmed and linked. The new facts are highlighted below, and the correction was sent to the data platform.</div>`
        : p.match && S.rejected[id] ? `<div class="banner">Kept separate. The Mercy Valley record will not be linked to ${esc(p.first)}, and the hospital's data team has been asked to review it.</div>` : ""}
      <div class="bgrid">
        <div class="stack">
          <section class="pane changes ${dn(1, "Above everything else: what changed since the last contact. Drafted by the assistant; every line links to its record.")}">
            <div class="pane-h"><h2>What changed since your last contact</h2><span class="aside">${esc(p.lastContact)}. Drafted from ${changes.length} records – check before acting.</span></div>
            <ul>${changes.map((c, i) => `<li class="${c.isNew ? "new" : ""}"><span>${c.lock ? '<span class="lock" aria-hidden="true"></span>' : ""}${c.isNew ? "<b>New from linked record. </b>" : ""}${esc(c.text)}${c.confirm ? (S.valueConfirmed[id] ? ` ${st("Confirmed by you", "ok")}` : ` <button class="linkish small" data-confirmvalue="${id}">Confirm value</button>`) : ""}</span><span class="${i === 0 ? dn(2, "Every fact carries its source and age. Bars fill with freshness; amber means stale or untrusted for recency.") : ""}">${prov(c.src, c.age, c.lvl)}</span></li>`).join("")}</ul>
            <div class="legend">Bars show how fresh each source is: ${bars(4)} today ${bars(3)} this week ${bars(1)} older ${bars(0)} stale or untrusted for recency</div>
          </section>
          <section class="pane ${dn(3, "Medications side by side by source. Conflicts are flagged, never resolved automatically – the nurse confirms the true list on the call.")}">
            <div class="pane-h"><h2>${esc(p.medsTitle)}</h2><span class="aside">${p.meds.filter(m => m.level === "crit" || m.level === "warn").length} need attention</span></div>
            <table class="meds"><tr><th>Drug</th>${medHead}<th></th></tr>${medRows}</table>
            <div class="pad small muted" style="padding-top:10px">${esc(p.medNote)}</div>
          </section>
          <div class="trio">
            <section class="pane list"><div class="pane-h"><h2>Timeline</h2></div><ul>${p.timeline.map(t => `<li><span><span class="when">${esc(t[0])}</span>${esc(S.matched[id] ? t[1].replace(" (record not yet linked)", " – fall, wrist fracture") : t[1])}</span><span class="faint small">${esc(t[2])}</span></li>`).join("")}</ul></section>
            <section class="pane list ${dn(5, "No booking from a practice that doesn't share schedules shows as unknown, never as none – and becomes a task for the assistant.")}"><div class="pane-h"><h2>Services and appointments</h2></div><ul>${p.services.map(s => `<li><span>${esc(s[0])}</span>${(id === "M-41206" && s[0].startsWith("Cardiology") && S.during["M-41206:Book"]) ? st("Booked 12 Nov, 10:30", "ok") : st(s[1], s[2])}</li>`).join("")}</ul></section>
            <section class="pane list ${dn(6, "Slow sources are labelled. Claims never decide what is recent; a risk score older than the latest event is flagged.")}"><div class="pane-h"><h2>Data sources</h2></div><ul>${p.sources.map(s => { const linked = S.matched[id] && s[1] === "Unmatched record pending"; return `<li><span>${esc(s[0])}</span>${linked ? prov("", "Linked today", 4) : prov("", s[1], s[2])}</li>`; }).join("")}</ul></section>
          </div>
        </div>
        <aside class="sticky">
          <section class="pane actions ${dn(8, "At most four next best actions. Accept does the admin. Dismiss asks one question, which tunes the rules or sends a data correction.")}">
            <div class="pane-h"><h2>Next best actions</h2><span class="aside">Up to 4</span></div>
            ${actions}
            <div class="cta"><a class="btn primary" href="#/call/${id}">${isText ? "Text " + esc(p.first) : "Start call"}</a><span class="small faint">${esc(p.actAt.time)}: ${esc(p.actAt.route)}</span></div>
          </section>
        </aside>
      </div>`;
  }

  /* ---------------- CALL / TEXT & DOCUMENTATION ---------------- */
  function call(id) {
    const p = byId[id]; if (!p) return queue();
    setNav("cases");
    const g = S.guide[id] || (S.guide[id] = new Set());
    const out = S.outcome[id];
    const outcomes = ["Connected", "Voicemail", "No answer", "Wrong number", "Text sent", "Interpreter"];
    const d = p.draft;
    const signed = S.signed[id];
    const isText = p.channel === "text";
    const texted = S.texted[id];

    const reach = `<section class="pane ${dn(1, "Ranked routes instead of one phone field: valid number first, authorized representative shown, dead numbers greyed but kept, numbers from other sources marked unverified.")}">
        <div class="pane-h"><h2>How to reach ${esc(p.first)}</h2></div>
        ${p.routes.map(r => `<div class="route ${r.state}"><b>${esc(r.who)}</b><span>${esc(r.detail)}</span>${r.unverified ? `<div class="uv">${out === "Connected" ? "Verified on this call" : "Not yet verified – confirm on the call"}</div>` : ""}</div>`).join("")}
        ${isText ? "" : `<div class="pane-h" style="padding-top:8px"><h2>Outcome</h2><span class="aside">Logged automatically</span></div>
        <div class="outcomes ${dn(2, "One tap logs the attempt. Outcomes teach the best time and channel for this member; 'wrong number' becomes a data correction.")}">${outcomes.map(o => `<button class="btn sm" data-outcome="${o}" aria-pressed="${out === o}">${o}</button>`).join("")}</div>`}
      </section>
      <section class="pane kv"><div class="pane-h"><h2>Learned for this member</h2></div><ul>${p.learned.map(k => `<li><span class="muted">${esc(k[0])}</span><span>${esc(k[1])}</span></li>`).join("")}</ul></section>`;

    const textPane = isText ? `<section class="pane ${dn(11, "Channel choice is real: Kayla's prepaid phone can't take calls, so outreach starts as a drafted text Maria edits and sends herself. No automated messaging.")}">
        <div class="pane-h"><h2>Text message</h2><span class="aside">Sent by you, from the plan's secure texting line</span></div>
        <div class="thread">
          ${texted ? `<div class="bubble me">${esc(S.texted[id])}<span>09:02</span></div><div class="bubble them">${esc(p.textReply)}<span>09:04</span></div>`
            : `<label class="small muted" for="sms">Drafted from her brief. Edit before sending.</label><textarea id="sms" rows="4">${esc(p.textDraft)}</textarea><div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn primary" data-sendtext="${id}">Send text</button><span class="small faint">Plain language, no clinical details over SMS.</span></div>`}
        </div>
      </section>` : "";

    const guideOn = !isText || texted;
    const guide = guideOn ? `<section class="pane guide ${dn(3, "The guide is built from the actions accepted on the brief, so the conversation is spent on judgment, not navigation. Tick a question to record the answer.")}">
        <div class="pane-h"><h2>${isText ? "Follow-up once she replies" : "Call guide"}</h2><span class="aside">${isText ? "Call or text back" : "From accepted actions. Transcript is opt-in."}</span></div>
        <ul>${p.guide.map((q, i) => `<li class="${g.has(i) ? "on" : ""}" data-q="${i}" tabindex="0" role="checkbox" aria-checked="${g.has(i)}"><span class="box"></span><div><div class="q">${esc(q.q)}</div><div class="a">${esc(q.a)}${st(q.tag[0], q.tag[1])}</div></div></li>`).join("")}</ul>
      </section>` : "";

    const during = p.during.length ? `<section class="during ${dn(9, "While Maria is on the phone, the provider-side assistant reports back – here, a verified in-network cardiology slot she can book with the member on the line.")}"><div class="h">Arrived during the call <span>– from the assistant's calls to offices</span></div>${p.during.map(x => { const k = id + ":" + x.cta; return `<div class="it"><span><b>${esc(x.from)}.</b> ${esc(x.text)}</span>${S.during[k] ? st(x.cta === "Book" ? "Booked" : "Done", "ok") : `<button class="btn sm" data-during="${esc(x.cta)}">${esc(x.cta)}</button>`}</div>`; }).join("")}</section>` : "";

    const ready = !isText || texted;
    const doc = `<section class="pane ${dn(5, "The assessment is pre-filled from existing data, each field with its source. Fields the assistant couldn't fill are highlighted.")}">
        <div class="pane-h"><h2>Draft documentation</h2><span class="aside">${esc(d.form)}</span></div>
        <div class="pad small muted" style="padding-bottom:8px">${d.filled} of ${d.total} fields filled from existing records. ${d.fields.filter(f => !f[1]).length} need you.</div>
        ${d.fields.map(f => f[1] ? `<div class="field"><span class="muted">${esc(f[0])}</span><span>${esc(f[1])}<span class="src">${esc(f[2])}</span></span></div>` : `<div class="field need"><span>${esc(f[0])}</span><span>Needs you</span></div>`).join("")}
        <div class="subh ${dn(4, "Capture once: answers in the conversation flow into the summary, care plan, tasks and audit fields.")}">Summary (draft)</div>
        <div class="summary">${ready ? esc(d.summary) : "The summary is drafted once the conversation starts."}</div>
        <div class="subh ${dn(7, "Quality measures close as a by-product of documenting the contact – no extra form.")}">This will also update</div>
        ${d.updates.map(u => `<div class="field"><span>${esc(u[0])}</span>${st(u[1] === "closed" ? "Closed" : "Ready", "ok")}</div>`).join("")}
        <div class="subh ${dn(10, "Corrections made during the contact go back to the data platform, so the next nurse – and every other HiLabs product – sees cleaner data.")}">Corrections sent back to the data platform</div>
        ${d.corrections.map(c => `<div class="field"><span>${esc(c[0])}</span><span class="muted">${esc(c[1])}</span></div>`).join("")}
        ${signed ? `<div class="signed">${st(`Signed at ${signed}. Written to the care-management system.`, "ok")} <a class="linkish small" href="#/today">Back to today</a></div>`
          : `<div class="signrow ${dn(6, "Nothing reaches the plan's care-management system until the nurse signs. Audit-ready for NCQA.")}"><button class="btn primary" data-sign="${id}" ${ready ? "" : "disabled"}>Review and sign</button><span class="small faint">Nothing is saved to the record until you sign.</span></div>`}
      </section>`;

    view.innerHTML = `
      <div class="crumb"><a href="#/today">Today</a> / <a href="#/brief/${id}">${esc(p.name)}</a> / ${isText ? "Text" : "Call"}</div>
      <div class="topline" style="margin-bottom:0"><div><h1>${isText ? "Reach" : "Call with"} ${esc(p.first)}</h1><p class="lede">${isText ? (texted ? "Text sent at 09:02. Kayla replied at 09:04." : "Kayla's phone has no call minutes until the 1st. Start with a text.") : out ? `Outcome: ${esc(out)}.` : "Choose the route, then record the outcome with one tap."}</p></div></div>
      <div class="cgrid">
        <div class="stack">${reach}</div>
        <div class="stack">${textPane}${guide}${during}</div>
        ${doc}
      </div>`;
  }

  /* ---------------- ROUTER & EVENTS ---------------- */
  function route() {
    const h = location.hash || "#/today";
    const [path, qs] = h.slice(1).split("?");
    const parts = path.split("/").filter(Boolean);
    const f = new URLSearchParams(qs || "").get("f");
    if (parts[0] === "brief") brief(parts[1]);
    else if (parts[0] === "call") { if (!S.tourAutoMin) { S.tourMin = true; S.tourAutoMin = true; } call(parts[1]); }
    else if (parts[0] === "tasks") tasks();
    else queue(f);
    renderTour();
    view.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", () => { S.reasonOpen = null; route(); window.scrollTo(0, 0); });
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

  view.addEventListener("click", e => {
    const t = e.target.closest("button, [data-go], li[data-q]");
    if (!t) return;
    const id = (location.hash.split("/")[2] || "").split("?")[0];
    if (t.dataset.filter) { location.hash = t.dataset.filter === "today" ? "#/today" : "#/today?f=" + t.dataset.filter; return; }
    if (t.dataset.score) { e.stopPropagation(); S.open = S.open === t.dataset.score ? null : t.dataset.score; S.scoreSeen = true; rerender(); return; }
    if (e.target.closest("[data-stop]")) return;
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.dataset.confirm) { S.matched[t.dataset.confirm] = true; toast("Record linked. Correction sent to the data platform."); rerender(); return; }
    if (t.dataset.reject) { S.rejected[t.dataset.reject] = true; toast("Kept separate. Hospital record flagged for review."); rerender(); return; }
    if (t.dataset.confirmvalue) { S.valueConfirmed[t.dataset.confirmvalue] = true; toast("A1c 8.9% confirmed. It now counts in his trend and care gaps."); rerender(); return; }
    if (t.dataset.accept !== undefined) {
      const a = byId[id].actions[t.dataset.accept];
      if (a.accept === "Review match") { const m = document.getElementById("match"); if (m) { m.scrollIntoView({ behavior: "smooth", block: "center" }); m.classList.add("pulse"); setTimeout(() => m.classList.remove("pulse"), 1400); } else toast("This record has already been reviewed."); return; }
      (S.accepted[id] = S.accepted[id] || {})[t.dataset.accept] = true; addTask(id, a.title); toast("Done: " + a.accept + ". Added to your tasks."); rerender(); return;
    }
    if (t.dataset.dismiss !== undefined) { S.reasonOpen = id + ":" + t.dataset.dismiss; rerender(); return; }
    if (t.dataset.reason) { const [i, r] = t.dataset.reason.split("|"); (S.dismissed[id] = S.dismissed[id] || {})[i] = r; S.reasonOpen = null; toast("Dismissed. Thanks – this tunes your queue."); rerender(); return; }
    if (t.dataset.outcome) { S.outcome[id] = t.dataset.outcome; toast(t.dataset.outcome === "Wrong number" ? "Logged. Number flagged as wrong and sent as a correction." : "Logged: " + t.dataset.outcome); rerender(); return; }
    if (t.dataset.q !== undefined) { const g = S.guide[id]; const i = +t.dataset.q; g.has(i) ? g.delete(i) : g.add(i); rerender(); return; }
    if (t.dataset.during) { S.during[id + ":" + t.dataset.during] = true; toast(t.dataset.during === "Book" ? "Booked: cardiology, Thursday 12 Nov, 10:30." : "Added to the call guide."); rerender(); return; }
    if (t.dataset.sendtext) { const ta = document.getElementById("sms"); S.texted[id] = ta ? ta.value : byId[id].textDraft; toast("Text sent. Kayla replied two minutes later."); rerender(); return; }
    if (t.dataset.sign) { if (!S.outcome[id] && byId[id].channel !== "text") S.outcome[id] = "Connected"; S.signed[id] = id === "M-41206" ? "08:31" : "10:05"; toast("Signed and written to the care-management system."); rerender(); return; }
  });
  view.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target.closest("[data-go], li[data-q]");
    if (t) { e.preventDefault(); t.click(); }
  });
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tourmin],[data-tourclose],[data-notes]");
    if (!t) return;
    if (t.dataset.tourmin !== undefined) { S.tourMin = !S.tourMin; renderTour(); }
    if (t.dataset.tourclose !== undefined) { S.tour = false; renderTour(); toast("Demo guide closed. Refresh the page to bring it back."); }
    if (t.dataset.notes !== undefined) document.getElementById("notesToggle").click();
  });
  document.getElementById("notesToggle").addEventListener("click", e => {
    const on = document.body.classList.toggle("notes");
    e.currentTarget.setAttribute("aria-pressed", on);
    e.currentTarget.textContent = on ? "Hide design notes" : "Show design notes";
    renderTour();
  });
  document.querySelector('.rail-item[data-nav="tasks"]').setAttribute("href", "#/tasks");

  const qp = new URLSearchParams(location.search);
  if (qp.get("notes") === "1") document.getElementById("notesToggle").click();
  if (qp.get("tour") === "0") S.tour = false;
  const demo = qp.get("demo");
  if (demo) {
    D.patients.forEach(p => { S.guide[p.id] = new Set(p.guide.map((_, i) => i)); });
    S.outcome["M-41206"] = "Connected";
    if (demo === "open") { S.open = "M-41206"; S.scoreSeen = true; }
  }
  route();
})();
