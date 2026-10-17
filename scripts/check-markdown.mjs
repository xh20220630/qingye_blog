import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { parse } from 'node-html-parser'

const distDir = resolve(process.argv[2] || 'dist')
const slug = 'markdown-rendering-lab'
const pagePath = join(distDir, 'posts', slug, 'index.html')
assert.ok(existsSync(pagePath), 'Build the Markdown test article before running this check.')

const html = readFileSync(pagePath, 'utf8')
// Shiki emits nested spans inside pre elements, which the parser otherwise treats as raw text.
const document = parse(html, { blockTextElements: { script: true, noscript: true, style: true } })
const content = document.querySelector('#post-content')
assert.ok(content, 'The article body must exist.')

const checks = []
function check(name, verify) {
  try {
    verify()
    checks.push({ name, passed: true })
  }
  catch (error) {
    checks.push({ name, passed: false, error: error.message })
  }
}

check('Six heading levels and distinct duplicate-heading anchors', () => {
  for (let level = 1; level <= 6; level++) {
    assert.ok(content.querySelector(`h${level}`))
  }
  const duplicates = content.querySelectorAll('h3').filter(node => node.textContent.trim() === '同名小节')
  assert.equal(duplicates.length, 2)
  assert.equal(new Set(duplicates.map(node => node.id)).size, 2)
})

check('Emphasis, deletion, inline code and escaped text', () => {
  for (const selector of ['strong', 'em', 'del', 'p code']) {
    assert.ok(content.querySelector(selector), selector)
  }
  assert.ok(content.textContent.includes('*不是斜体*'))
  assert.ok(content.textContent.includes('_保留原样_'))
  assert.ok(content.querySelectorAll('p code').some(node => node.textContent.includes('<article> & **Markdown**')))
  assert.ok(content.querySelector('br'))
})

check('Lists, nested lists and disabled task checkboxes', () => {
  for (const selector of ['ul li ul', 'ol li ol', 'blockquote blockquote']) {
    assert.ok(content.querySelector(selector), selector)
  }
  const tasks = content.querySelectorAll('input[type="checkbox"]')
  assert.equal(tasks.length, 3)
  assert.ok(tasks.every(node => node.hasAttribute('disabled')))
  assert.equal(tasks.filter(node => node.hasAttribute('checked')).length, 2)
})

check('Inline, reference, automatic, email and internal links', () => {
  const links = content.querySelectorAll('a')
  assert.ok(links.filter(node => node.getAttribute('href') === 'https://github.com/xh20220630').length >= 4)
  assert.ok(links.some(node => node.getAttribute('href') === 'mailto:hello@example.com'))
  assert.ok(links.some(node => node.getAttribute('href') === '#05-代码与复制'))
  const external = links.find(node => node.getAttribute('href') === 'https://github.com/xh20220630')
  assert.equal(external.getAttribute('target'), '_blank')
  assert.ok(external.getAttribute('rel').includes('noopener'))
})

check('Footnotes, repeated references and return links', () => {
  assert.equal(content.querySelectorAll('a[data-footnote-ref]').length, 3)
  assert.ok(content.querySelectorAll('.data-footnote-backref').length >= 2)
})

check('Code blocks, highlighting, copying controls and literal content', () => {
  const wrappers = content.querySelectorAll('.code-block-wrapper')
  assert.equal(wrappers.length, 7)
  assert.equal(content.querySelectorAll('.code-copy-button').length, wrappers.length)
  assert.ok(wrappers[0].querySelector('pre code span[style]'))
  assert.ok(wrappers.some(node => node.textContent.includes('<article data-author="青也">')))
  assert.ok(wrappers.some(node => node.textContent.includes('**这些星号应作为代码展示。**')))
  assert.ok(wrappers.some(node => node.textContent.includes('console.log(\'青也\')')))
  assert.ok(content.querySelector('textarea#copy-verification'))
})

check('Tables and column alignment', () => {
  assert.equal(content.querySelectorAll('table').length, 2)
  assert.ok(content.querySelector('th[align="center"]'))
  assert.ok(content.querySelector('th[align="right"]'))
})

check('Local images, captions, caption suppression and gallery', () => {
  assert.equal(content.querySelectorAll('img').length, 6)
  assert.equal(content.querySelectorAll('figcaption').length, 5)
  assert.equal(content.querySelectorAll('.gallery-container .gallery-item').length, 3)
  const hiddenCaption = content.querySelector('img[alt="_隐藏图注测试"]')
  assert.ok(hiddenCaption)
  assert.equal(hiddenCaption.parentNode.querySelector('figcaption'), null)
  assert.ok(content.querySelector('img[src="/images/markdown-lab.svg"]'))
  assert.ok(content.querySelectorAll('img').some(node => node.getAttribute('src').includes('/_astro/')))
})

check('Inline and display mathematics without KaTeX errors', () => {
  assert.equal(content.querySelectorAll('.katex').length, 5)
  assert.equal(content.querySelectorAll('.katex-display').length, 3)
  assert.equal(content.querySelectorAll('.katex-error').length, 0)
})

check('Flowchart and sequence-diagram source reaches the browser', () => {
  // Mermaid SVG output and theme changes need browser verification after hydration.
  const diagrams = content.querySelectorAll('pre.mermaid')
  assert.equal(diagrams.length, 2)
  assert.ok(diagrams[0].textContent.includes('flowchart LR'))
  assert.ok(diagrams[1].textContent.includes('sequenceDiagram'))
})

check('All five admonitions in both supported syntaxes', () => {
  for (const type of ['note', 'tip', 'important', 'warning', 'caution']) {
    assert.equal(content.querySelectorAll(`.admonition-${type}`).length, type === 'note' ? 3 : 2, type)
  }
})

check('Directive folds and native HTML details', () => {
  assert.equal(content.querySelectorAll('details').length, 8)
  assert.equal(content.querySelectorAll('details summary').length, 8)
  assert.ok(content.querySelectorAll('summary').some(node => node.textContent === '展开一段补充内容'))
})

check('Native HTML typography and local audio controls', () => {
  for (const selector of ['sub', 'sup', 'abbr[title]', 'mark', 'u[title]', 'kbd', 'hr']) {
    assert.ok(content.querySelector(selector), selector)
  }
  const audio = content.querySelector('audio')
  assert.ok(audio.hasAttribute('controls'))
  assert.equal(audio.getAttribute('src'), '/sounds/tap_01.wav')
})

check('GitHub, YouTube, Bilibili, Spotify, X and CodePen embed structures', () => {
  assert.equal(content.querySelectorAll('.gc-container').length, 1)
  assert.equal(content.querySelectorAll('lite-youtube').length, 1)
  assert.equal(content.querySelectorAll('iframe.bilibili-player').length, 1)
  assert.equal(content.querySelectorAll('iframe.spotify-embed').length, 2)
  assert.equal(content.querySelectorAll('.twitter-tweet').length, 1)
  assert.equal(content.querySelectorAll('iframe.codepen-embed').length, 1)
  assert.ok(content.querySelector('iframe.spotify-embed[height="152"]'))
  assert.ok(content.querySelector('iframe.spotify-embed[height="352"]'))
})

check('Table of contents points to existing page anchors', () => {
  const ids = new Set(document.querySelectorAll('[id]').map(node => node.id))
  const links = document.querySelectorAll('#toc-links-list a')
  assert.ok(links.length >= 14)
  for (const link of links) {
    assert.ok(ids.has(decodeURIComponent(link.getAttribute('href').slice(1))), link.getAttribute('href'))
  }
})

check('Published article, tags, feeds, sitemap and sharing image', () => {
  const home = readFileSync(join(distDir, 'index.html'), 'utf8')
  assert.ok(home.includes(`/posts/${slug}/`))
  assert.ok(!home.includes('还没有文章。'))
  const tags = readFileSync(join(distDir, 'tags', 'index.html'), 'utf8')
  for (const name of ['Markdown', '写作', '站点测试']) {
    assert.ok(tags.includes(name))
  }
  for (const file of ['rss.xml', 'atom.xml', 'sitemap-0.xml']) {
    assert.ok(readFileSync(join(distDir, file), 'utf8').includes(`/posts/${slug}/`), file)
  }
  assert.ok(existsSync(join(distDir, 'og', `${slug}.png`)))
  assert.ok(document.querySelector('meta[property="og:image"]').getAttribute('content').includes(`/og/${slug}.png`))
})

for (const result of checks) {
  process.stdout.write(`${(result.passed ? 'PASS ' : 'FAIL ') + result.name + (result.error ? `: ${result.error}` : '')}\n`)
}
const failures = checks.filter(result => !result.passed)
process.stdout.write(`\n${checks.length - failures.length}/${checks.length} static rendering checks passed.\n`)
if (failures.length > 0) {
  process.exitCode = 1
}
