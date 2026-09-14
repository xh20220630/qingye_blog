export function isPublished({ data }: { data: { draft?: boolean; pubDate: Date } }): boolean {
  return !data.draft && data.pubDate.valueOf() <= Date.now();
}
