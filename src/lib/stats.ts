import { isPublished } from './publishing';
import { getCollection } from 'astro:content';

export interface SiteStats {
  postCount: number;
  totalChars: number;
  tagCount: number;
  categoryCount: number;
  seriesCount: number;
  daysSinceStart: number;
}

export async function getSiteStats(): Promise<SiteStats> {
  const posts = await getCollection('blog', isPublished);
  const tags = new Set<string>();
  const cats = new Set<string>();
  const series = new Set<string>();
  let totalChars = 0;
  let earliest = Date.now();
  for (const p of posts) {
    p.data.tags.forEach((t) => tags.add(t));
    cats.add(p.data.category);
    if (p.data.series) series.add(p.data.series);
    totalChars += (p.body ?? '').replace(/\s/g, '').length;
    const t = p.data.pubDate.valueOf();
    if (t < earliest) earliest = t;
  }
  return {
    postCount: posts.length,
    totalChars,
    tagCount: tags.size,
    categoryCount: cats.size,
    seriesCount: series.size,
    daysSinceStart: Math.max(1, Math.floor((Date.now() - earliest) / 86400000)),
  };
}

export function fmtChars(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : String(n);
}
