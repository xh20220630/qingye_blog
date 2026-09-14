import settings from './site-settings.json';

export const siteConfig = settings;
export const friendLinks: { name: string; url: string; desc: string }[] = settings.links;
