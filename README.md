# Case Workbench – clickable prototype

A prototype of a case-management workbench for health-plan nurses, built for the HiLabs APM caselet (2026–27).

**All data is synthetic.** Every person, member ID, phone number, provider and facility is fictional. No real patient information is used.

## What it shows

The problem: a nurse case manager with 48 cases spends most of her day finding data, deciding who to call, dialling dead numbers and re-typing notes – and has about two real conversations a day.

The prototype has three screens, built around her workflow:

1. **Today** – a ranked queue that says *why now* in plain words. Scores come from transparent, editable rules (click a score). Rank decides the order of work; "Act at" decides when the call happens.
2. **Member brief** – what changed since the last contact, medications side by side by source with conflicts flagged, and up to four next best actions. Every fact shows its source and age.
3. **Call and documentation** – ranked ways to reach the member, one-tap outcomes, a call guide built from accepted actions, and a pre-filled note that is saved only when the nurse signs.

Things to try:

- Click a **score** on the Today screen to see the rule breakdown.
- Open **Eleanor Fitzgerald** and confirm the hospital record match – three hidden facts appear.
- On a brief, **dismiss** an action – you are asked why (this tunes the rules or sends a data correction).
- Start the call for **Raymond Kessler**, tick the call guide, and **Review and sign**.
- Turn on **Show design notes** (top bar) for numbered explanations of each design decision.

## Design principles

- Answer before evidence: every card leads with the conclusion.
- Every fact carries its source and age (the small bars fill with freshness; amber means stale).
- AI drafts, the nurse decides: no automatic record merges below 95%, nothing saved until signed, and AI calls offices and vendors – never members.
- Capture once: what is said on the call fills the assessment, care plan, tasks and quality measures.
- Corrections flow back to the data platform, so the data gets cleaner as nurses work.

## Tech

Plain HTML, CSS and JavaScript – no build step, no backend, no tracking. Data lives in `data.js`. Font: IBM Plex Sans (SIL Open Font License), self-hosted.

Run locally by opening `index.html`, or serve the folder with any static server.
