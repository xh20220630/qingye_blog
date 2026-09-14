import Fuse from 'fuse.js';
import { escapeHtml as e } from '../lib/client.js';

const input = document.querySelector('#search-input'), results = document.querySelector('#search-results'), state = document.querySelector('#search-state');
const params = new URLSearchParams(location.search);
let index = [], fuse, page = Math.max(1, Number(params.get('page')) || 1), timer, loaded = false;
const controls = ['category', 'tag', 'series', 'year', 'sort'];
input.value = params.get('q') || '';
function options(name, values, title) {
  const select = document.querySelector(`#filter-${name}`); select.innerHTML = `<option value="">${title}</option>` + values.map(value => `<option value="${e(value)}">${e(value)}</option>`).join(''); select.value = params.get(name) || '';
}
function highlight(text, query) {
  if (!query) return e(text);
  const lower = text.toLowerCase(), needle = query.toLowerCase(); let from = 0, at, result = '';
  while ((at = lower.indexOf(needle, from)) !== -1) { result += e(text.slice(from, at)) + '<mark>' + e(text.slice(at, at + query.length)) + '</mark>'; from = at + query.length; }
  return result + e(text.slice(from));
}
function run(updateURL = true) {
  if (!loaded) return;
  const q = input.value.trim(), filters = Object.fromEntries(controls.map(name => [name, document.querySelector(`#filter-${name}`).value]));
  let hits = q ? fuse.search(q).map(hit => hit.item) : [...index];
  hits = hits.filter(item => (!filters.category || item.category === filters.category) && (!filters.tag || item.tags.includes(filters.tag)) && (!filters.series || item.series === filters.series) && (!filters.year || String(item.year) === filters.year));
  if (filters.sort === 'oldest') hits.sort((a, b) => a.timestamp - b.timestamp);
  else if (filters.sort === 'title') hits.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  else if (!q || filters.sort === 'newest') hits.sort((a, b) => b.timestamp - a.timestamp);
  const pages = Math.max(1, Math.ceil(hits.length / 10)); page = Math.min(page, pages);
  const next = new URLSearchParams(); if (q) next.set('q', q); for (const [name, value] of Object.entries(filters)) if (value && value !== 'relevance') next.set(name, value); if (page > 1) next.set('page', String(page));
  if (updateURL) history.replaceState(null, '', `${location.pathname}${next.size ? '?' + next : ''}`);
  state.textContent = `检得 ${hits.length} 卷${q ? `与「${q}」相关的` : ''}玉简。`; state.classList.remove('is-error'); results.hidden = false;
  results.innerHTML = hits.length ? hits.slice((page - 1) * 10, page * 10).map(item => {
    const at = q ? item.excerpt.toLowerCase().indexOf(q.toLowerCase()) : -1;
    const start = Math.max(0, at - 45), snippet = item.excerpt.slice(start, start + 160);
    return `<article class="search-hit"><h3><a href="${e(item.url)}">${highlight(item.title, q)}</a></h3><div class="hit-meta"><a href="/categories/${encodeURIComponent(item.category)}/">${e(item.category)}</a><span>${e(item.date)}</span>${item.tags.map(t => `<a href="/tags/${encodeURIComponent(t)}/">#${e(t)}</a>`).join('')}</div><p class="hit-desc">${highlight(item.description, q)}</p>${q && at >= 0 ? `<p class="hit-excerpt">${start ? '…' : ''}${highlight(snippet, q)}${start + 160 < item.excerpt.length ? '…' : ''}</p>` : ''}</article>`;
  }).join('') : '<div class="community-empty"><b>这片云里，暂未寻到。</b>试试更短的关键词，或放宽分类与年份。</div>';
  document.querySelector('#search-pagination').innerHTML = `<button data-page="-1" ${page === 1 ? 'disabled' : ''}>上一页</button><span>${page} / ${pages}</span><button data-page="1" ${page === pages ? 'disabled' : ''}>下一页</button>`;
}
async function load() {
  state.textContent = '正在展开全阁索引…';
  try {
    const response = await fetch('/search-index.json'); if (!response.ok) throw new Error('检索索引暂未载入'); index = await response.json();
    fuse = new Fuse(index, { keys: [{ name: 'title', weight: .4 }, { name: 'description', weight: .2 }, { name: 'tags', weight: .15 }, { name: 'category', weight: .05 }, { name: 'series', weight: .05 }, { name: 'excerpt', weight: .15 }], threshold: .32, ignoreLocation: true, includeScore: true });
    for (const name of ['category', 'series', 'year']) options(name, [...new Set(index.map(item => item[name]).filter(Boolean))].sort((a, b) => name === 'year' ? b - a : String(a).localeCompare(String(b), 'zh-CN')), { category: '全部分类', series: '全部系列', year: '全部年份' }[name]);
    options('tag', [...new Set(index.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), '全部标签');
    document.querySelector('#filter-sort').value = params.get('sort') || 'relevance'; loaded = true; run(false);
  } catch (error) { state.textContent = error.message; state.classList.add('is-error'); results.hidden = false; results.innerHTML = '<button class="community-button secondary" id="retry-search">重新载入</button>'; document.querySelector('#retry-search').addEventListener('click', load); }
}
input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; run(); }, 200); });
controls.forEach(name => document.querySelector(`#filter-${name}`).addEventListener('change', () => { page = 1; run(); }));
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.query; page = 1; run(); input.focus(); }));
document.querySelector('#search-pagination').addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) { page += Number(button.dataset.page); run(); state.scrollIntoView({ block: 'center', behavior: 'auto' }); } });
document.querySelector('#clear-search').addEventListener('click', () => { input.value = ''; controls.forEach(name => document.querySelector(`#filter-${name}`).value = name === 'sort' ? 'relevance' : ''); page = 1; run(); input.focus(); });
window.addEventListener('popstate', () => { const params = new URLSearchParams(location.search); input.value = params.get('q') || ''; controls.forEach(name => document.querySelector(`#filter-${name}`).value = params.get(name) || (name === 'sort' ? 'relevance' : '')); page = Math.max(1, Number(params.get('page')) || 1); run(false); });
if (params.get('focus') === '1') input.focus();
void load();
