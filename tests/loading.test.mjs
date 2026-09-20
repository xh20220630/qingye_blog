import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/loading/bootstrap.js', import.meta.url), 'utf8');

// Small browser test double: execute the actual inline entry, with a controlled clock.
// No WebGL, network, browser binary or extra runtime dependency is required.
function boot({ home = true, embedded = false, reduced = false, motionOff = false, state, priorBusy = null } = {}) {
  const document = new EventTarget();
  let now = 0, nextTimer = 0;
  const timers = new Map();
  class Element extends EventTarget {
    constructor(tagName = 'DIV') {
      super(); this.tagName = tagName; this.dataset = {}; this.attributes = new Map();
      this.hidden = false; this.inert = false; this.isConnected = true; this.children = [];
      this.textContent = ''; this.classes = new Set();
      this.classList = {
        add: value => this.classes.add(value), remove: value => this.classes.delete(value),
        contains: value => this.classes.has(value),
        toggle: (value, on) => on ? this.classes.add(value) : this.classes.delete(value),
      };
    }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    closest() { return this.hidden ? this : this.parent?.closest() ?? null; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '[data-loading-stage]') return all.filter(child => child.dataset.loadingStage);
      if (selector === 'a[href], button') return all.filter(child => ['A', 'BUTTON'].includes(child.tagName));
      return all;
    }
  }
  const ids = Object.fromEntries(['global-loading', 'main-content', 'loading-status', 'loading-title', 'loading-description', 'loading-recovery', 'loading-static'].map(id => [id, new Element(id === 'loading-static' ? 'BUTTON' : 'DIV')]));
  const root = new Element('HTML'), body = new Element('BODY'), header = new Element('HEADER');
  const overlay = ids['global-loading'], main = ids['main-content'], recovery = ids['loading-recovery'];
  const exit = new Element('A');
  const stages = ['summon', 'models', 'scene'].map(value => { const node = new Element('LI'); node.dataset.loadingStage = value; return node; });
  overlay.hidden = true; recovery.hidden = true; overlay.dataset.mode = home ? 'realm' : 'page';
  overlay.append(ids['loading-title'], ids['loading-description'], ids['loading-status'], ...stages, recovery, exit);
  recovery.append(ids['loading-static']); body.append(header, main, overlay, new Element('SCRIPT'));
  if (priorBusy !== null) main.setAttribute('aria-busy', priorBusy);
  if (state) root.dataset.realmState = state;
  if (motionOff) root.dataset.motion = 'off';
  Object.assign(document, { documentElement: root, body, hidden: false, readyState: 'loading', activeElement: body, getElementById: id => ids[id] });
  const window = new EventTarget(); window.self = window; window.top = embedded ? {} : window;
  const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
  const advance = duration => {
    const target = now + duration;
    while (true) {
      const pending = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!pending) break;
      now = pending[1].at; timers.delete(pending[0]); pending[1].callback();
    }
    now = target;
  };
  runInNewContext(source, {
    document, window, AbortController, CustomEvent, performance: { now: () => now },
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const key = (value, shiftKey = false) => { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: value, shiftKey }); overlay.dispatchEvent(event); return event; };
  return { document, window, ids, root, overlay, main, header, recovery, exit, stages, emit, advance, key, timers };
}

test('cold entry locks the background and waits for first render, not just completed models', () => {
  const app = boot();
  assert.equal(app.overlay.hidden, false);
  assert.equal(app.main.inert, true);
  assert.equal(app.main.getAttribute('aria-busy'), 'true');
  app.emit('realm:loading', { stage: 'models', completed: 7, total: 7 });
  app.emit('realm:loading', { stage: 'scene' });
  assert.equal(app.main.inert, true);
  app.emit('realm:ready');
  assert.equal(app.main.inert, false);
  assert.equal(app.main.getAttribute('aria-busy'), null);
  assert.equal(app.root.dataset.loading, undefined);
  assert.equal(app.document.activeElement, app.main);
  app.advance(500);
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.timers.size, 0);
});

test('out-of-order progress cannot regress a stage or model count; partial failure is disclosed', () => {
  const app = boot();
  app.emit('realm:loading', { stage: 'models', completed: 4, total: 7, failed: 1 });
  assert.match(app.ids['loading-status'].textContent, /4 \/ 7 · 简景补全/);
  app.emit('realm:loading', { stage: 'models', completed: 2, total: 7, failed: 1 });
  assert.match(app.ids['loading-status'].textContent, /4 \/ 7/);
  app.emit('realm:loading', { stage: 'scene' });
  app.emit('realm:loading', { stage: 'models', completed: 7, total: 7 });
  assert.equal(app.overlay.dataset.stage, 'scene');
});

test('missing application chunks cannot leave the page blocked forever', () => {
  const app = boot(); let skips = 0;
  app.document.addEventListener('realm:skip', () => skips++);
  app.advance(7999); assert.equal(app.recovery.hidden, true);
  app.advance(1); assert.equal(app.recovery.hidden, false);
  app.advance(17000);
  assert.equal(skips, 1);
  assert.equal(app.root.dataset.realmMode, 'static');
  assert.equal(app.main.inert, false);
  app.advance(500); assert.equal(app.overlay.hidden, true);
});

test('manual static entry is final even if late progress and ready events arrive', () => {
  const app = boot(); let skips = 0;
  app.document.addEventListener('realm:skip', () => skips++);
  app.advance(8000);
  app.ids['loading-static'].dispatchEvent(new Event('click'));
  app.emit('realm:loading', { stage: 'models', completed: 7, total: 7 });
  app.emit('realm:ready');
  app.advance(30000);
  assert.equal(app.ids['loading-title'].textContent, '静览山川');
  assert.equal(app.root.dataset.realmState, 'fallback');
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.main.inert, false);
  assert.equal(skips, 1);
});

test('renderer failure releases the page and preserves an existing busy attribute', () => {
  const app = boot({ priorBusy: 'false' });
  app.emit('realm:fallback'); app.advance(500);
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.main.getAttribute('aria-busy'), 'false');
  assert.equal(app.header.inert, false);
});

test('background time is excluded from slow-network and fallback deadlines', () => {
  const app = boot();
  app.advance(4000); app.document.hidden = true; app.emit('visibilitychange');
  app.advance(60000); assert.equal(app.recovery.hidden, true); assert.equal(app.main.inert, true);
  app.document.hidden = false; app.emit('visibilitychange');
  app.advance(4000); assert.equal(app.recovery.hidden, false); assert.equal(app.main.inert, true);
  app.advance(17000); assert.equal(app.main.inert, false);
});

test('reading pages release at DOMContentLoaded independently of the decorative world', () => {
  const app = boot({ home: false });
  app.emit('DOMContentLoaded');
  assert.equal(app.overlay.hidden, true); assert.equal(app.main.inert, false);
  app.advance(30000); assert.equal(app.root.dataset.realmMode, undefined);
});

test('embedded reading frames never open another global loader', () => {
  const app = boot({ embedded: true });
  assert.equal(app.overlay.hidden, true); assert.equal(app.main.inert, false);
  assert.equal(app.root.dataset.loading, undefined); assert.equal(app.timers.size, 0);
});

test('keyboard focus stays in the loading layer and Escape enters static mode', () => {
  const app = boot();
  app.key('Tab'); assert.equal(app.document.activeElement, app.exit);
  app.key('Tab', true); assert.equal(app.document.activeElement, app.exit);
  app.key('Escape'); assert.equal(app.main.inert, false);
  assert.equal(app.document.activeElement, app.main);
});

test('reduced motion and the site motion preference avoid the fade delay', () => {
  for (const options of [{ reduced: true }, { motionOff: true }]) {
    const app = boot(options); app.emit('realm:ready');
    assert.equal(app.overlay.hidden, true); assert.equal(app.timers.size, 0);
  }
});

test('pagehide and BFCache restoration cannot resurrect a blocking or fading layer', () => {
  const app = boot();
  app.window.dispatchEvent(new Event('pagehide'));
  const restored = new Event('pageshow'); Object.assign(restored, { persisted: true });
  app.window.dispatchEvent(restored);
  assert.equal(app.overlay.hidden, true); assert.equal(app.main.inert, false);
  assert.equal(app.root.dataset.loading, undefined); assert.equal(app.timers.size, 0);
});

test('ready state observed before boot still dismisses the overlay', () => {
  const app = boot({ state: 'ready', reduced: true });
  assert.equal(app.overlay.hidden, true); assert.equal(app.main.inert, false);
});
