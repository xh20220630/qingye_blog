export function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function fmtYearMonth(d: Date): string {
  return `${d.getFullYear()} 年 ${String(d.getMonth() + 1).padStart(2, '0')} 月`;
}

export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const chars = body.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}

export function stripMarkdown(body: string | undefined, len = 220): string {
  if (!body) return '';
  return body
    .replace(/^```[^\n]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>`|-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, len);
}
