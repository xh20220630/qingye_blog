/* Inlined at the end of the document, before deferred modules can start.
   Keep this independent of application chunks, WebGL, storage and external assets. */
(() => {
  const root = document.documentElement;
  const overlay = document.getElementById('global-loading');
  if (!overlay || window.self !== window.top) return;
  const home = overlay.dataset.mode === 'realm';
  const main = document.getElementById('main-content');
  const status = document.getElementById('loading-status');
  const title = document.getElementById('loading-title');
  const description = document.getElementById('loading-description');
  const recovery = document.getElementById('loading-recovery');
  const stages = [...overlay.querySelectorAll('[data-loading-stage]')];
  const previousFocus = document.activeElement;
  const surfaces = [...document.body.children].filter(node => node !== overlay && !['SCRIPT', 'STYLE'].includes(node.tagName));
  const previousInert = surfaces.map(node => node.inert);
  const previousBusy = main?.getAttribute('aria-busy');
  const listeners = new AbortController();
  let finished = false, stageIndex = 0, settled = 0, total = 0;
  let slowTimer, deadlineTimer, removalTimer;
  let elapsed = 0, visibleSince = performance.now();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'off';
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: listeners.signal });

  function removeOverlay() {
    clearTimeout(removalTimer);
    overlay.hidden = true;
    overlay.classList.remove('is-leaving');
  }
  function finish(fallback = false, immediate = false) {
    if (finished) { if (immediate) removeOverlay(); return; }
    finished = true;
    clearTimeout(slowTimer); clearTimeout(deadlineTimer);
    listeners.abort();
    title.textContent = fallback ? '静览山川' : home ? '云境已开' : '书卷已就绪';
    status.textContent = fallback ? '静景已备妥，仍可循图录阅卷' : '已就绪';
    stages.forEach(node => { node.classList.add('is-complete'); node.removeAttribute('aria-current'); });
    surfaces.forEach((node, index) => { node.inert = previousInert[index]; });
    if (main) {
      if (previousBusy === null) main.removeAttribute('aria-busy');
      else main.setAttribute('aria-busy', previousBusy);
    }
    delete root.dataset.loading;
    if (overlay.contains(document.activeElement)) {
      const target = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : main;
      target?.focus({ preventScroll: true });
    }
    if (immediate || reduced()) removeOverlay();
    else {
      overlay.classList.add('is-leaving');
      // A timer also covers missing transitionend, background tabs and detached styles.
      removalTimer = setTimeout(removeOverlay, 500);
    }
  }
  function staticEntrance() {
    if (finished) return;
    root.dataset.realmMode = 'static';
    root.dataset.realmState = 'fallback';
    document.dispatchEvent(new CustomEvent('realm:skip'));
    document.dispatchEvent(new CustomEvent('realm:fallback'));
    finish(true);
  }
  function update(event) {
    if (finished || !home) return;
    const detail = event.detail || {};
    const next = ['summon', 'models', 'scene'].indexOf(detail.stage);
    if (next < stageIndex || next < 0) return;
    stageIndex = next;
    overlay.dataset.stage = detail.stage;
    stages.forEach((node, index) => {
      node.classList.toggle('is-complete', index < next);
      if (index === next) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    if (next === 1) {
      total = Number.isFinite(detail.total) ? detail.total : total;
      settled = Math.max(settled, Math.min(total, Number(detail.completed) || 0));
      status.textContent = `仙山凝形 · ${settled} / ${total}${detail.failed ? ' · 简景补全' : ''}`;
    } else if (next === 2) status.textContent = '云海铺展 · 正在绘制初景';
  }
  function armTimers() {
    clearTimeout(slowTimer); clearTimeout(deadlineTimer);
    if (finished || document.hidden) return;
    visibleSince = performance.now();
    if (home) {
      slowTimer = setTimeout(() => { recovery.hidden = false; description.textContent = '云海尚在铺展，书卷已可先行'; }, Math.max(0, 8000 - elapsed));
      deadlineTimer = setTimeout(staticEntrance, Math.max(0, 25000 - elapsed));
    } else deadlineTimer = setTimeout(() => finish(false, true), Math.max(0, 8000 - elapsed));
  }

  overlay.hidden = false;
  root.dataset.loading = home ? 'realm' : 'page';
  surfaces.forEach(node => { node.inert = true; });
  main?.setAttribute('aria-busy', 'true');
  overlay.focus({ preventScroll: true });
  listen(document, 'realm:loading', update);
  listen(document, 'realm:ready', () => { if (home) finish(); });
  listen(document, 'realm:fallback', () => { if (home) finish(true); });
  listen(document.getElementById('loading-static'), 'click', staticEntrance);
  listen(overlay, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); home ? staticEntrance() : finish(false, true); }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('a[href], button')].filter(node => !node.closest('[hidden]') && !node.disabled);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === overlay)) { event.preventDefault(); first?.focus(); }
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { elapsed += performance.now() - visibleSince; clearTimeout(slowTimer); clearTimeout(deadlineTimer); }
    else armTimers();
  });
  // A BFCache restore must never restore a dismissed or half-faded blocking layer.
  window.addEventListener('pagehide', () => finish(false, true), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) finish(false, true); });
  if (home) {
    if (root.dataset.realmState === 'ready') finish();
    else if (root.dataset.realmState === 'fallback') finish(true);
  } else {
    // Reading pages do not wait for decorative 3D assets or window.load.
    if (document.readyState !== 'loading') finish(false, true);
    else listen(document, 'DOMContentLoaded', () => finish(false, true));
  }
  armTimers();
})();
