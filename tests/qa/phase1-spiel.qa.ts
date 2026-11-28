// QA Phase 1 (qa-pruefer): Spielen wie ein Mensch – im sandboxed iframe (tests/e2e/harness), mit echter Eingabe:
// Tastatur nach Klick ins Spiel (Desktop) bzw. echte Touch-Ereignisse über CDP auf die sichtbaren Knöpfe (Handy).
// Eigene, einfache Drill-Strategie, die nur nutzt, was das HUD auch zeigt (Spannung, grüne Zone, Richtungspfeil,
// Vorwarnungen). KEIN Autopilot bei den Strategie-Fängen. Ergebnisse: docs/qa/phase-1/qa-*.json + qa-*.png.
import { test, expect, type CDPSession, type Frame, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startGame, watchConsole } from '../e2e/helpers';

const HARNESS = 'http://127.0.0.1:4174/iframe-harness.html';
const OUT = 'docs/qa/phase-1';
mkdirSync(OUT, { recursive: true });

interface W {
  rodState: string; tension: number; zone: { lo: number; hi: number } | null; behavior: string | null; pullDir: string | null;
  depthM: number; snag: { count: number; needed: number } | null; catches: number; escapes: number; coins: number;
  lastCatch: { fishId: string; points: number; value: number; grade: string } | null; lastEscape: string | null;
  drillLog: string[]; catchCardOpen: boolean; introOpen: boolean; feedback: Record<string, number>; fps: number;
  input: { mode: string; steer: number; reeling: boolean; sinking: boolean }; camera: { x: number; y: number };
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const st = (f: Frame): Promise<W> => f.evaluate(() => {
  const w = (window as unknown as { __KK: { welt: W } }).__KK.welt;
  return { ...w, hooks: undefined, drillLog: [...w.drillLog], feedback: { ...w.feedback }, input: { ...w.input } } as W;
});
const hook = (f: Frame, name: string, ...args: unknown[]) =>
  f.evaluate(([n, a]) => ((window as unknown as { __KK: { welt: { hooks: Hooks } } }).__KK.welt.hooks[n as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [name, args] as const);
const waitState = (f: Frame, states: string[], timeout = 20_000) =>
  f.waitForFunction((s) => s.includes((window as unknown as { __KK: { welt: { rodState: string } } }).__KK.welt.rodState), states, { timeout, polling: 'raf' });
const save = async (f: Frame) => {
  const txt = await f.evaluate(() => localStorage.getItem('ctd:spielstand'));
  return txt ? (JSON.parse(txt) as { profile: { coins: number; bucket: Record<string, unknown>[]; lexicon: Record<string, { state: string }> } }) : null;
};
const relevant = (e: string[]) => e.filter((x) => !/GL Driver|GPU stall/.test(x));
const sleep = (p: Page, ms: number) => p.waitForTimeout(ms);

async function openFrame(page: Page, cdp: CDPSession | null): Promise<Frame> {
  await page.goto(HARNESS);
  const el = await page.waitForSelector('#game');
  const f = await el.contentFrame();
  if (!f) throw new Error('kein iframe');
  await startGame(f, cdp);
  return f;
}
async function fresh(f: Frame): Promise<void> {
  await hook(f, 'resetSave');
  await f.waitForFunction(() => (window as unknown as { __KK?: { welt?: { rodState: string } } }).__KK?.welt?.rodState === 'Idle', null, { timeout: 30_000 });
  const go = f.locator('.intro__go');
  if (await go.isVisible().catch(() => false)) await go.click();
  await hook(f, 'setPhase', 'Tag');
  await hook(f, 'setWeather', 'Sonnig');
}

// ------------------------------------------------------------------ Eingabe-Abstraktion

interface Ctl {
  primary(down: boolean): Promise<void>;
  sink(down: boolean): Promise<void>;
  steer(dir: -1 | 0 | 1): Promise<void>;
  rodUp(): Promise<void>;
  tap(): Promise<void>;
  retrieve(): Promise<void>;
  release(): Promise<void>;
}

function keyboardCtl(page: Page): Ctl {
  const held = new Set<string>();
  const set = async (k: string, on: boolean) => {
    if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  };
  return {
    primary: (d) => set('Space', d),
    sink: (d) => set('KeyS', d),
    steer: async (d) => { await set('KeyA', d === -1); await set('KeyD', d === 1); },
    rodUp: () => page.keyboard.press('KeyW'),
    tap: async () => { await set('Space', false); await page.keyboard.press('Space'); },
    retrieve: () => page.keyboard.press('KeyR'),
    release: async () => { for (const k of [...held]) await set(k, false); },
  };
}

/** Mehrfinger-Touch über CDP: jede Nachricht enthält alle gerade gedrückten Finger. */
function touchCtl(f: Frame, cdp: CDPSession): Ctl {
  const pts = new Map<number, { x: number; y: number }>();
  // CDP kann keinen einzelnen Finger loslassen, solange andere liegen (geprüft): dann alle los und die übrigen neu drücken.
  let down = 0;
  const send = async () => {
    if (pts.size < down) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    down = pts.size;
    if (pts.size === 0) return;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...pts].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
  };
  // Knopf-Mitten zwischenspeichern (Lage ist je Modus fest); nur die Steuerknöpfe, deren Sichtbarkeit wechselt, neu messen
  const cache = new Map<string, { x: number; y: number }>();
  const center = async (sel: string) => {
    const hit = cache.get(sel);
    if (hit && (sel === '.touch__left' || sel === '.touch__right')) return hit;
    const b = await f.locator(sel).boundingBox();
    if (!b) throw new Error(`${sel} nicht sichtbar`);
    const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    cache.set(sel, p);
    return p;
  };
  const finger = async (id: number, sel: string | null) => {
    if (sel === null) { if (!pts.has(id)) return; pts.delete(id); }
    else {
      if (pts.has(id)) return;
      // Knopf kann in genau diesem Moment verschwinden (Fang → Fang-Karte): dann nichts drücken
      const pos = await center(sel).catch(() => null);
      if (!pos) return;
      pts.set(id, pos);
    }
    await send();
  };
  let steerDir = 0;
  return {
    primary: (d) => finger(1, d ? '.touch__cast' : null),
    sink: (d) => finger(1, d ? '.touch__cast' : null),
    steer: async (d) => {
      if (d === steerDir) return;
      await finger(2, null);
      steerDir = d;
      if (d !== 0) await finger(2, d === -1 ? '.touch__left' : '.touch__right');
    },
    rodUp: async () => { await finger(3, '.touch__rodup').catch(() => undefined); await finger(3, null); },
    tap: async () => { await finger(4, '.touch__cast'); await finger(4, null); },
    retrieve: async () => { await finger(5, '.touch__retrieve'); await finger(5, null); },
    release: async () => { pts.clear(); steerDir = 0; await send(); },
  };
}

// ------------------------------------------------------------------ Wurf bis Anschlag

async function castAndHook(page: Page, f: Frame, c: Ctl, o: { holdMs?: number; sinkMs?: number; strikeDelayMs?: number } = {}): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await waitState(f, ['Idle'], 15_000);
    await c.primary(true);
    await waitState(f, ['Casting'], 5_000);
    await sleep(page, o.holdMs ?? 450);
    await c.primary(false);
    await waitState(f, ['Sinking', 'Waiting']);
    await sleep(page, 600);
    if ((await st(f)).snag) { await c.retrieve(); continue; }
    if (o.sinkMs) { await c.sink(true); await sleep(page, o.sinkMs); await c.sink(false); }
    await sleep(page, 200);
    if ((await st(f)).snag) { await c.retrieve(); continue; }
    await hook(f, 'skipWait');
    await waitState(f, ['Bite'], 20_000);
    if (o.strikeDelayMs) await sleep(page, o.strikeDelayMs);
    await c.tap();
    await waitState(f, ['Reeling', 'Escaped'], 5_000);
    return (await st(f)).rodState === 'Reeling';
  }
  return false;
}

// ------------------------------------------------------------------ eigene Drill-Strategie

interface DrillReport {
  behavior: string | null; outcome: string; durationS: number; actions: string[]; telegraphs: number; rodUps: number;
  snagTaps: number; maxTension: number; shot?: string;
}

const TRACE: { ms: number; t: number; want: boolean; reeling: boolean; steerWant: number; steer: number }[] = [];
async function playDrill(page: Page, f: Frame, c: Ctl, shotName: string | null, shotOn: string[] = [], naive = false): Promise<DrillReport> {
  const t0 = Date.now();
  let idx = 0;
  let tele: string | null = null;
  let action: string | null = null;
  let snag = false;
  let lastTap = 0;
  let lastDir: string = 'left';
  const actions: string[] = [];
  let telegraphs = 0;
  let rodUps = 0;
  let snagTaps = 0;
  let maxT = 0;
  let shot: string | undefined;
  let behavior: string | null = null;
  for (;;) {
    const w = await st(f);
    if (w.rodState !== 'Reeling') break;
    if (Date.now() - t0 > 120_000) throw new Error('Drill > 120 s');
    behavior = w.behavior;
    maxT = Math.max(maxT, w.tension);
    const log = w.drillLog;
    if (log.length < idx) idx = 0;
    for (const e of log.slice(idx)) {
      if (e.startsWith('telegraph:')) {
        tele = e.slice(10); telegraphs++;
        if (tele === 'dive' && !naive) { await c.rodUp(); rodUps++; }
        if (shotName && !shot && shotOn.includes(tele)) {
          shot = `${OUT}/qa-${shotName}.png`;
          await page.screenshot({ path: shot });
        }
      } else if (e.startsWith('action:')) {
        action = e.slice(7); tele = null; actions.push(action);
        if (action === 'dive' && !naive) { await c.rodUp(); rodUps++; }
      } else if (e === 'actionEnd') action = null;
      else if (e === 'snag') { snag = true; lastTap = 0; }
      else if (e === 'snagFreed') snag = false;
    }
    idx = log.length;
    const z = w.zone ?? { lo: 0.4, hi: 0.6 };
    const mid = (z.lo + z.hi) / 2;
    let target = mid;
    const now = new Set(naive ? [] : [`t:${tele}`, `a:${action}`]);
    if (now.has('t:jump') || now.has('a:jump')) target = 0.15;
    if (now.has('t:flee') || now.has('a:fake') || now.has('a:flee')) target = z.lo * 0.7;
    if (now.has('t:inflate') || now.has('a:inflate')) target = z.lo;
    if (now.has('a:sprint') || now.has('a:dive')) target = (z.lo + mid) / 2;
    if (w.behavior === 'Hitzkopf') target = (z.lo + mid) / 2;
    const dir = w.pullDir ?? lastDir;
    lastDir = dir;
    let steer: -1 | 0 | 1 = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    if (now.has('a:shock')) steer = (-steer) as -1 | 0 | 1;
    await c.steer(naive ? 0 : steer);
    if (snag) {
      await c.primary(false);
      if (Date.now() - lastTap >= 500) { await c.tap(); snagTaps++; lastTap = Date.now(); }
    } else {
      await c.primary(w.tension < target);
    }
    TRACE.push({ ms: Date.now() - t0, t: Math.round(w.tension * 100) / 100, want: w.tension < target, reeling: w.input.reeling, steerWant: naive ? 0 : steer, steer: w.input.steer });
  }
  await c.release();
  const end = await st(f);
  return {
    behavior, outcome: end.rodState === 'Caught' ? 'caught' : `escaped:${end.lastEscape}`, durationS: (Date.now() - t0) / 1000,
    actions, telegraphs, rodUps, snagTaps, maxTension: Math.round(maxT * 100) / 100, ...(shot ? { shot } : {}),
  };
}

async function closeCard(f: Frame): Promise<void> {
  const w = await st(f);
  if (w.catchCardOpen) await f.locator('.cc__bucket').click();
  await waitState(f, ['Idle', 'Escaped', 'Casting'], 10_000).catch(() => undefined);
  await waitState(f, ['Idle'], 10_000).catch(() => undefined);
}

// ------------------------------------------------------------------ 1. Verhaltensarten mit eigener Strategie (Tastatur)

const PLAN: [string, string, string | null][] = [
  ['Ruhig', 'F004', null], ['Zappler', 'F002', null], ['Sprinter', 'F014', null], ['Taucher', 'F010', null],
  ['Springer', 'F012', null], ['Zickzack', 'F008', null], ['Brocken', 'F003', null], ['Trickser', 'F004', 'Trickser'],
  ['Versteckspieler', 'F004', 'Versteckspieler'], ['Aufblaeher', 'F004', 'Aufblaeher'], ['Stromer', 'F004', 'Stromer'],
  ['Blinker', 'F004', 'Blinker'], ['Hitzkopf', 'F004', 'Hitzkopf'],
];
const SHOT_ON: Record<string, string[]> = {
  Zickzack: ['zigzag'], Versteckspieler: ['cover'], Aufblaeher: ['inflate'], Stromer: ['shock'], Blinker: ['invisible'],
  Sprinter: ['sprint'], Taucher: ['dive'], Springer: ['jump'], Zappler: ['spike'], Trickser: ['flee'],
};

test('Tastatur im iframe: alle 13 Verhaltensarten mit eigener Strategie (je bis 3 Versuche)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur Desktop');
  test.setTimeout(1_500_000);
  const errors = watchConsole(page);
  const f = await openFrame(page, null);
  await fresh(f);
  const c = keyboardCtl(page);
  const results: Record<string, DrillReport[]> = {};
  for (const [beh, fish, force] of PLAN) {
    await hook(f, 'forceFish', fish);
    await hook(f, 'forceBehavior', force);
    results[beh] = [];
    for (let a = 0; a < 3; a++) {
      const hooked = await castAndHook(page, f, c, { holdMs: 400, sinkMs: 500 });
      if (!hooked) { results[beh].push({ behavior: null, outcome: `nicht gehakt:${(await st(f)).lastEscape}`, durationS: 0, actions: [], telegraphs: 0, rodUps: 0, snagTaps: 0, maxTension: 0 }); await sleep(page, 2500); continue; }
      const r = await playDrill(page, f, c, a === 0 ? `verhalten-${beh}` : null, SHOT_ON[beh] ?? []);
      results[beh].push(r);
      if (r.outcome === 'caught') {
        await sleep(page, 500);
        if (a === 0 && ['Ruhig', 'Springer', 'Taucher'].includes(beh)) await page.screenshot({ path: `${OUT}/qa-fang-${beh}.png` });
        await closeCard(f);
        break;
      }
      await sleep(page, 2600);
      await waitState(f, ['Idle'], 10_000).catch(() => undefined);
    }
    writeFileSync(`${OUT}/qa-strategie.json`, JSON.stringify(results, null, 1));
  }
  const caught = Object.entries(results).filter(([, r]) => r.some((x) => x.outcome === 'caught')).map(([b]) => b);
  console.info(`gefangen mit eigener Strategie: ${caught.length}/13 – ${caught.join(', ')}`);
  expect.soft(caught.length).toBeGreaterThanOrEqual(4);
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 2. Wurf und Anschlag (Tastatur)

test('Tastatur im iframe: perfekter Wurf, Fehlwurf, Anschlag zu früh / zu spät / perfekt / ok', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur Desktop');
  test.setTimeout(400_000);
  const errors = watchConsole(page);
  const f = await openFrame(page, null);
  await fresh(f);
  const c = keyboardCtl(page);
  await hook(f, 'forceFish', 'F004');
  const out: Record<string, unknown> = {};
  const lastRec = async () => (await save(f))?.profile.bucket.at(-1) ?? null;

  // Fehlwurf: kurz tippen
  await waitState(f, ['Idle']);
  const camIdle = (await st(f)).camera;
  await c.primary(true); await waitState(f, ['Casting']); await sleep(page, 30); await c.primary(false);
  await waitState(f, ['Sinking', 'Waiting']); await sleep(page, 1200);
  out.missCamera = { idle: camIdle, after: (await st(f)).camera };
  await page.screenshot({ path: `${OUT}/qa-fehlwurf.png` });
  await c.retrieve(); await waitState(f, ['Idle']);
  // weiter Wurf zum Vergleich
  await c.primary(true); await waitState(f, ['Casting']); await sleep(page, 540); await c.primary(false);
  await waitState(f, ['Sinking', 'Waiting']); await sleep(page, 1200);
  out.farCamera = (await st(f)).camera;
  await page.screenshot({ path: `${OUT}/qa-weiter-wurf.png` });
  await c.retrieve(); await waitState(f, ['Idle']);

  // perfekter Wurf: ~0,60 s halten (Kraft 1,0 bei Zyklus 1,2 s), Fang per Autopilot zu Ende, Rekord lesen
  const perfect: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    await waitState(f, ['Idle']);
    await c.primary(true); await waitState(f, ['Casting']); await sleep(page, 590); await c.primary(false);
    await waitState(f, ['Sinking', 'Waiting']);
    if (i === 0) { await sleep(page, 150); await page.screenshot({ path: `${OUT}/qa-perfekter-wurf.png` }); }
    await hook(f, 'autopilot', true); await hook(f, 'skipWait');
    await waitState(f, ['Caught', 'Escaped'], 90_000);
    await hook(f, 'autopilot', false);
    const r = await lastRec();
    perfect.push(!!r?.perfectCast);
    await hook(f, 'closeCatchCard'); await sleep(page, 2600); await waitState(f, ['Idle'], 10_000).catch(() => undefined);
  }
  out.perfectCasts = perfect;

  // zu früh: im Zupfer-Zustand anschlagen
  const early: string[] = [];
  for (let i = 0; i < 6 && early.length < 1; i++) {
    await waitState(f, ['Idle']);
    await c.primary(true); await waitState(f, ['Casting']); await sleep(page, 400); await c.primary(false);
    await waitState(f, ['Sinking', 'Waiting']); await sleep(page, 500);
    if ((await st(f)).snag) { await c.retrieve(); continue; }
    await hook(f, 'skipWait');
    await waitState(f, ['Nibble', 'Bite'], 10_000);
    if ((await st(f)).rodState === 'Nibble') {
      await c.tap();
      await sleep(page, 200);
      early.push((await st(f)).rodState);
      await page.screenshot({ path: `${OUT}/qa-zu-frueh.png` });
    }
    await c.retrieve(); await waitState(f, ['Idle'], 10_000).catch(() => undefined);
  }
  out.earlyStateAfter = early;

  // zu spät: nichts tun
  await castAndHook(page, f, { ...c, tap: async () => undefined }, { holdMs: 400 }).catch(() => false);
  await waitState(f, ['Escaped'], 5_000);
  out.late = (await st(f)).lastEscape;
  await page.screenshot({ path: `${OUT}/qa-zu-spaet.png` });
  await sleep(page, 2600);

  // perfekt (sofort) und ok (nach 0,55 s von 0,8 s)
  for (const [name, delay] of [['perfekt', 0], ['ok', 550]] as const) {
    await waitState(f, ['Idle'], 10_000);
    const ok = await castAndHook(page, f, c, { holdMs: 400, strikeDelayMs: delay });
    if (!ok) { out[name] = 'nicht gehakt'; await sleep(page, 2600); continue; }
    await hook(f, 'autopilot', true);
    await waitState(f, ['Caught', 'Escaped'], 90_000);
    await hook(f, 'autopilot', false);
    const r = await lastRec();
    out[name] = { perfectStrike: r?.perfectStrike, rodState: (await st(f)).rodState };
    await hook(f, 'closeCatchCard'); await sleep(page, 2600);
  }

  // Schnur zu kurz: weit werfen (Kante), lange sinken
  await waitState(f, ['Idle'], 10_000).catch(() => undefined);
  await c.primary(true); await waitState(f, ['Casting']); await sleep(page, 560); await c.primary(false);
  await waitState(f, ['Sinking', 'Waiting']); await sleep(page, 600);
  if (!(await st(f)).snag) {
    await c.sink(true); await sleep(page, 7000);
    out.lineTooShortDepth = (await st(f)).depthM;
    await page.screenshot({ path: `${OUT}/qa-schnur-zu-kurz.png` });
    await c.sink(false);
  }
  writeFileSync(`${OUT}/qa-wurf-anschlag.json`, JSON.stringify(out, null, 1));
  console.info(JSON.stringify(out));
  expect.soft(out.late).toBe('late');
  expect.soft(perfect.some(Boolean)).toBe(true);
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 3. Lexikon, Schillernd, Eimer, Verkauf, Neuladen

test('Lexikon (unbekannt → gesichtet → gefangen, Sterne), Schillernd, Eimer, Verkauf, Neuladen', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur Desktop');
  test.setTimeout(400_000);
  const errors = watchConsole(page);
  const f = await openFrame(page, null);
  await fresh(f);
  const c = keyboardCtl(page);
  const out: Record<string, unknown> = {};
  // gesichtet: Fisch haken und im Drill nichts tun → schlitzt aus
  await hook(f, 'forceFish', 'F013');
  await castAndHook(page, f, c, { holdMs: 300 });
  await waitState(f, ['Escaped'], 30_000);
  out.escape = (await st(f)).lastEscape;
  await sleep(page, 2600);
  // gefangen: normal und schillernd (Debug)
  for (const [fish, shiny] of [['F004', false], ['F001', true]] as const) {
    await hook(f, 'forceFish', fish);
    await hook(f, 'forceShiny', shiny);
    await waitState(f, ['Idle'], 10_000);
    await hook(f, 'autopilot', true);
    await waitState(f, ['Caught'], 90_000);
    await hook(f, 'autopilot', false);
    await sleep(page, 900);
    if (shiny) await page.screenshot({ path: `${OUT}/qa-schillernd-karte.png` });
    else await page.screenshot({ path: `${OUT}/qa-fangkarte.png` });
    await f.locator('.cc__bucket').click();
    await waitState(f, ['Idle'], 10_000);
  }
  await hook(f, 'forceShiny', false);
  const btns = f.locator('.hud__btn');
  // Lexikon
  await btns.nth(0).click();
  await f.locator('.lx__grid').waitFor();
  const count = async () => ({
    caught: await f.locator('.lx__cell--caught').count(), seen: await f.locator('.lx__cell--seen').count(),
    unknown: await f.locator('.lx__cell--unknown').count(), all: await f.locator('.lx__cell').count(),
  });
  out.lexicon = await count();
  await page.screenshot({ path: `${OUT}/qa-lexikon.png` });
  await f.locator('.lx__cell[data-id="F001"]').click();
  await sleep(page, 300);
  out.f001Stars = await f.locator('.lx__d-stars-text').textContent().catch(() => null);
  await page.screenshot({ path: `${OUT}/qa-lexikon-schillernd.png` });
  await f.locator('.lx__cell[data-id="F013"]').click().catch(() => undefined);
  await sleep(page, 300);
  out.f013Text = await f.locator('.lx__d-text').textContent().catch(() => null);
  await page.screenshot({ path: `${OUT}/qa-lexikon-gesichtet.png` });
  await page.keyboard.press('Escape');
  await sleep(page, 300);
  // Eimer + Verkauf
  await btns.nth(1).click();
  await f.locator('.bk__list, .bk__empty').first().waitFor();
  out.bucketRows = await f.locator('.bk__row').count();
  await page.screenshot({ path: `${OUT}/qa-eimer.png` });
  const coins0 = (await st(f)).coins;
  await f.locator('.bk__sellall').click();
  await sleep(page, 200);
  if (await f.locator('.bk__sellall.is-confirm').count()) await f.locator('.bk__sellall').click();
  await sleep(page, 400);
  out.coins = { before: coins0, after: (await st(f)).coins, rowsAfter: await f.locator('.bk__row').count() };
  await page.screenshot({ path: `${OUT}/qa-eimer-verkauft.png` });
  await page.keyboard.press('Escape');
  await sleep(page, 1500);
  // Neuladen
  await page.reload();
  const el = await page.waitForSelector('#game');
  const f2 = (await el.contentFrame()) as Frame;
  await startGame(f2);
  const s2 = await st(f2);
  const sv = await save(f2);
  out.afterReload = {
    coins: s2.coins, lexF001: sv?.profile.lexicon.F001?.state, lexF013: sv?.profile.lexicon.F013?.state, lexF004: sv?.profile.lexicon.F004?.state,
  };
  writeFileSync(`${OUT}/qa-lexikon-eimer.json`, JSON.stringify(out, null, 1));
  console.info(JSON.stringify(out));
  expect.soft(out.afterReload).toMatchObject({ lexF001: 'caught', lexF013: 'seen', lexF004: 'caught' });
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 4. Tageszeit / Wetter (Screenshots) + Pixelraster im Drill

test('Tageszeit und Wetter sichtbar; Pixelraster auch während des Drills', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur Desktop');
  test.setTimeout(200_000);
  const errors = watchConsole(page);
  const f = await openFrame(page, null);
  await fresh(f);
  for (const [p, w] of [['Morgen', 'Nebel'], ['Abend', 'Regen'], ['Nacht', 'Gewitter'], ['Tag', 'Bewoelkt']] as const) {
    await hook(f, 'setPhase', p);
    await hook(f, 'setWeather', w);
    await sleep(page, 1500);
    await page.screenshot({ path: `${OUT}/qa-welt-${p}-${w}.png` });
  }
  await hook(f, 'setPhase', 'Tag');
  await hook(f, 'setWeather', 'Sonnig');
  await hook(f, 'forceFish', 'F004');
  await hook(f, 'autopilot', true);
  await waitState(f, ['Reeling'], 60_000);
  await sleep(page, 1500);
  // Raster: Spiel-Seite direkt (nicht im iframe), ohne HTML-Overlay
  const p2 = await context.newPage();
  await p2.goto('http://localhost:4173/');
  await startGame(p2.mainFrame());
  const f2 = p2.mainFrame();
  await hook(f2, 'forceFish', 'F004');
  await hook(f2, 'autopilot', true);
  await waitState(f2, ['Reeling'], 60_000);
  await sleep(p2, 1200);
  await p2.addStyleTag({ content: '#overlay{display:none !important}' });
  await sleep(p2, 100);
  const geo = await p2.evaluate(() => {
    const cv = document.querySelector('#game canvas') as HTMLCanvasElement;
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const z = (window as unknown as { __KK: { layout: { deviceZoom: number } } }).__KK.layout.deviceZoom;
    return { x: r.x * dpr, y: r.y * dpr, w: r.width * dpr, h: r.height * dpr, z };
  });
  const png = (await p2.screenshot({ scale: 'device' })).toString('base64');
  writeFileSync(`${OUT}/qa-raster-drill.png`, Buffer.from(png, 'base64'));
  const an = await context.newPage();
  await an.setContent('<!doctype html><body></body>');
  const res = await an.evaluate(async ({ png, geo }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
    const { data, width } = ctx.getImageData(0, 0, cv.width, cv.height);
    const col = (x: number, y: number) => { const i = (y * width + x) * 4; return (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!; };
    const x0 = Math.ceil(geo.x) + 1, x1 = Math.floor(geo.x + geo.w) - 1, y0 = Math.ceil(geo.y) + 1, y1 = Math.floor(geo.y + geo.h) - 1;
    let runs = 0, bad = 0; const samples: string[] = [];
    for (const hor of [true, false]) {
      const lines = hor ? [y0, y1] : [x0, x1]; const span = hor ? [x0, x1] : [y0, y1];
      for (let l = lines[0]!; l < lines[1]!; l += 5) {
        let prev = -1, start = span[0]!, first = true;
        for (let t = span[0]!; t < span[1]!; t++) {
          const c = hor ? col(t, l) : col(l, t);
          if (c === prev) continue;
          if (prev !== -1) { if (!first) { runs++; const len = t - start; if (len % geo.z !== 0) { bad++; if (samples.length < 5) samples.push(`${hor ? 'Z' : 'S'} ${l}: ${len}px @${start}`); } } first = false; }
          prev = c; start = t;
        }
      }
    }
    return { runs, bad, samples };
  }, { png, geo });
  writeFileSync(`${OUT}/qa-raster-drill.json`, JSON.stringify({ geo, ...res }, null, 1));
  console.info(`Raster im Drill: ${JSON.stringify(res)}`);
  expect.soft(res.bad).toBe(0);
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 5. Handy: Touch-Fang mit echter Gestenfolge

test('Handy (Touch im iframe): kompletter Fang über die sichtbaren Knöpfe + Verhaltensarten', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'nur Handy-Profile');
  test.setTimeout(900_000);
  const errors = watchConsole(page);
  const cdp = await page.context().newCDPSession(page);
  const f = await openFrame(page, cdp);
  await fresh(f);
  const c = touchCtl(f, cdp);
  const name = info.project.name;
  const plan = name === 'iphone' ? PLAN.filter(([b]) => ['Ruhig', 'Zickzack', 'Taucher', 'Springer'].includes(b)) : PLAN.filter(([b]) => b === 'Ruhig');
  const results: Record<string, DrillReport[]> = {};
  let shots = 0;
  for (const [beh, fish, force] of plan) {
    await hook(f, 'forceFish', fish);
    await hook(f, 'forceBehavior', force);
    results[beh] = [];
    for (let a = 0; a < 3; a++) {
      await waitState(f, ['Idle'], 15_000);
      if (shots === 0) await page.screenshot({ path: `${OUT}/qa-${name}-1-bereit.png` });
      await c.primary(true); await waitState(f, ['Casting'], 5_000); await sleep(page, 450);
      if (shots === 0) await page.screenshot({ path: `${OUT}/qa-${name}-2-kraftbalken.png` });
      await c.primary(false);
      await waitState(f, ['Sinking', 'Waiting']); await sleep(page, 700);
      if ((await st(f)).snag) { await c.retrieve(); a--; continue; }
      await c.sink(true); await sleep(page, 600); await c.sink(false);
      if (shots === 0) await page.screenshot({ path: `${OUT}/qa-${name}-3-warten.png` });
      if ((await st(f)).snag) { await c.retrieve(); a--; continue; }
      await hook(f, 'skipWait');
      await waitState(f, ['Bite'], 20_000);
      await c.tap();
      await waitState(f, ['Reeling', 'Escaped'], 5_000);
      if ((await st(f)).rodState !== 'Reeling') { results[beh].push({ behavior: null, outcome: `nicht gehakt:${(await st(f)).lastEscape}`, durationS: 0, actions: [], telegraphs: 0, rodUps: 0, snagTaps: 0, maxTension: 0 }); await sleep(page, 2600); continue; }
      const r = await playDrill(page, f, c, shots === 0 ? `${name}-4-drill` : null, ['zigzag', 'dive', 'jump', 'spike', 'sprint']);
      if (shots === 0 && !r.shot) await page.screenshot({ path: `${OUT}/qa-${name}-4-drill-ende.png` });
      results[beh].push(r);
      if (r.outcome === 'caught') {
        await sleep(page, 700);
        if (shots === 0) await page.screenshot({ path: `${OUT}/qa-${name}-5-fang.png` });
        shots++;
        const b = await f.locator('.cc__bucket').boundingBox();
        if (b) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 9, x: b.x + b.width / 2, y: b.y + b.height / 2 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        await waitState(f, ['Idle'], 10_000);
        break;
      }
      await sleep(page, 2600);
    }
    writeFileSync(`${OUT}/qa-touch-${name}.json`, JSON.stringify(results, null, 1));
  }
  // HUD-Knöpfe: Größe ≥ 44 px
  const sizes = await f.evaluate(() => [...document.querySelectorAll('.touch__cast, .touch__small, .hud__btn')].filter((e) => (e as HTMLElement).offsetParent).map((e) => {
    const r = e.getBoundingClientRect(); return { cls: e.className.split(' ').slice(-1)[0], w: Math.round(r.width), h: Math.round(r.height) };
  }));
  writeFileSync(`${OUT}/qa-touch-${name}-knoepfe.json`, JSON.stringify(sizes, null, 1));
  const caught = Object.values(results).filter((r) => r.some((x) => x.outcome === 'caught')).length;
  console.info(`${name}: gefangen ${caught}/${plan.length}; Knöpfe ${JSON.stringify(sizes)}`);
  expect.soft(caught).toBeGreaterThanOrEqual(1);
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 6. Falsche Reaktion wird bestraft (Gegenprobe)

test('Gegenprobe: ohne Reaktion auf Vorwarnungen (nur Spannung mittig, nie lenken) gehen Fische verloren', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'nur Desktop');
  test.setTimeout(900_000);
  const errors = watchConsole(page);
  const f = await openFrame(page, null);
  await fresh(f);
  const c = keyboardCtl(page);
  const results: Record<string, DrillReport[]> = {};
  for (const [beh, fish, force] of PLAN.filter(([b]) => ['Springer', 'Versteckspieler', 'Trickser', 'Taucher', 'Aufblaeher'].includes(b))) {
    await hook(f, 'forceFish', fish);
    await hook(f, 'forceBehavior', force);
    results[beh] = [];
    for (let a = 0; a < 3; a++) {
      if (!(await castAndHook(page, f, c, { holdMs: 400 }))) { await sleep(page, 2600); continue; }
      results[beh].push(await playDrill(page, f, c, null, [], true));
      if ((await st(f)).catchCardOpen) await closeCard(f);
      else await sleep(page, 2600);
      await waitState(f, ['Idle'], 10_000).catch(() => undefined);
    }
    writeFileSync(`${OUT}/qa-gegenprobe.json`, JSON.stringify(results, null, 1));
  }
  expect(relevant(errors)).toEqual([]);
});

// ------------------------------------------------------------------ 7. Diagnose: Kurbel-Knopf im Drill (Handy quer)

test('Diagnose: Touch-Knöpfe im Drill sichtbar und bedienbar', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'nur Handy');
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  const f = await openFrame(page, cdp);
  await fresh(f);
  await hook(f, 'forceFish', 'F004');
  const c = touchCtl(f, cdp);
  const ok = await castAndHook(page, f, c, { holdMs: 400 });
  const vis = async () => f.evaluate(() => [...document.querySelectorAll('.ui-touch, .touch__cast, .touch__left, .touch__right, .touch__rodup')].map((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return `${e.className}|hidden=${(e as HTMLElement).hidden}|disp=${cs.display}|vis=${cs.visibility}|${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`;
  }));
  const log: unknown[] = [{ hooked: ok, state: (await st(f)).rodState, input: (await st(f)).input }, await vis()];
  await page.screenshot({ path: `${OUT}/qa-diagnose-${info.project.name}-drill.png` });
  // Kurbeln 0,4 s halten, loslassen: reeling muss folgen
  await c.primary(true); await sleep(page, 400); log.push({ heldReeling: (await st(f)).input.reeling, t: (await st(f)).tension });
  await c.primary(false); await sleep(page, 300); log.push({ releasedReeling: (await st(f)).input.reeling, t: (await st(f)).tension });
  writeFileSync(`${OUT}/qa-diagnose-${info.project.name}.json`, JSON.stringify(log, null, 1));
  console.info(JSON.stringify(log));
});

test('Diagnose: Zickzack per Touch – Eingabe-Spur', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'nur iPhone');
  test.setTimeout(300_000);
  const cdp = await page.context().newCDPSession(page);
  const f = await openFrame(page, cdp);
  await fresh(f);
  await hook(f, 'forceFish', 'F008');
  const c = touchCtl(f, cdp);
  const res: unknown[] = [];
  for (let a = 0; a < 2; a++) {
    TRACE.length = 0;
    if (!(await castAndHook(page, f, c, { holdMs: 400 }))) { await sleep(page, 2600); continue; }
    const r = await playDrill(page, f, c, null);
    res.push({ r, trace: [...TRACE] });
    if ((await st(f)).catchCardOpen) await closeCard(f); else await sleep(page, 2600);
  }
  writeFileSync(`${OUT}/qa-diagnose-zickzack-touch.json`, JSON.stringify(res));
});
