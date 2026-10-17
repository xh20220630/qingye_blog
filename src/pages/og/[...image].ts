import type { CollectionEntry } from 'astro:content'
import { OGImageRoute } from 'astro-og-canvas'
import { getCollection } from 'astro:content'
import { themeConfig } from '@/config'
import { getPostDescription } from '@/utils/description'

// eslint-disable-next-line antfu/no-top-level-await
const posts = await getCollection('posts')

const pages = {
  ...Object.fromEntries(
    posts.map((post: CollectionEntry<'posts'>) => [
      post.id,
      {
        title: post.data.title,
        description: getPostDescription(post, 'og'),
      },
    ]),
  ),
  __site: {
    title: themeConfig.site.title,
    description: themeConfig.site.description,
  },
}

// eslint-disable-next-line antfu/no-top-level-await
export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'image',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    border: {
      color: [242, 241, 245],
      width: 20,
    },
    font: {
      title: {
        families: ['Noto Sans SC'],
        weight: 'Bold',
        color: [34, 33, 36],
        lineHeight: 1.5,
      },
      description: {
        families: ['Noto Sans SC'],
        color: [72, 71, 74],
        lineHeight: 1.5,
      },
    },
    fonts: [
      './public/fonts/NotoSansSC-Bold.otf',
      './public/fonts/NotoSansSC-Regular.otf',
    ],
    bgGradient: [[242, 241, 245]],
  }),
})
