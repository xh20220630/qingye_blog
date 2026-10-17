import type { ThemeConfig } from '@/types'
import process from 'node:process'

export const themeConfig: ThemeConfig = {
  site: {
    title: '青也',
    subtitle: '',
    description: '青也的个人博客。',
    i18nTitle: false,
    author: '青也',
    url: process.env.SITE_URL || 'http://106.53.216.157',
    base: '/',
    favicon: '/icons/favicon.svg',
  },
  color: {
    mode: 'light',
    light: {
      primary: 'oklch(25% 0.005 298)',
      secondary: 'oklch(40% 0.005 298)',
      background: 'oklch(96% 0.005 298)',
      highlight: 'oklch(0.93 0.195089 103.2532 / 0.5)',
    },
    dark: {
      primary: 'oklch(92% 0.005 298)',
      secondary: 'oklch(77% 0.005 298)',
      background: 'oklch(22% 0.005 298)',
      highlight: 'oklch(0.93 0.195089 103.2532 / 0.2)',
    },
  },
  global: {
    locale: 'zh',
    moreLocales: [],
    fontStyle: 'sans',
    dateFormat: 'YYYY-MM-DD',
    toc: true,
    katex: true,
    reduceMotion: false,
  },
  comment: {
    enabled: false,
    giscus: {
      repo: '',
      repoId: '',
      category: '',
      categoryId: '',
      mapping: 'pathname',
      strict: '0',
      reactionsEnabled: '1',
      emitMetadata: '0',
      inputPosition: 'bottom',
    },
    twikoo: { envId: '' },
    waline: {
      serverURL: '',
      emoji: [],
      search: false,
      imageUploader: false,
    },
  },
  seo: {
    twitterID: '',
    verification: { google: '', bing: '', yandex: '', baidu: '' },
    googleAnalyticsID: '',
    umamiAnalyticsID: '',
    folo: { feedID: '', userID: '' },
    apiflashKey: '',
  },
  footer: {
    links: [
      { name: 'RSS', url: '/rss.xml' },
      { name: 'GitHub', url: 'https://github.com/xh20220630' },
    ],
    startYear: 2026,
  },
  preload: {
    imageHostURL: '',
    customGoogleAnalyticsJS: '',
    customUmamiAnalyticsJS: '',
  },
}

export const base = themeConfig.site.base === '/' ? '' : themeConfig.site.base.replace(/\/$/, '')
export const defaultLocale = themeConfig.global.locale
export const moreLocales = themeConfig.global.moreLocales
export const allLocales = [defaultLocale, ...moreLocales]
