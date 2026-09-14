import settings from './site-settings.json';

export const siteConfig = {
  ...settings,
  announcement: settings.announcement ? { id: settings.announcement, text: settings.announcement } : null,
  giscus: null as null | { repo: string; repoId: string; category: string; categoryId: string; mapping?: string },
};
export const friendLinks: { name: string; url: string; desc: string }[] = settings.links;
