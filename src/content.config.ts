import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().default('随笔'),
    author: z.string().default('青野散人'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    realm: z.string().optional(),
    series: z.string().optional(),
    cover: z.string().default(''),
    commentsEnabled: z.boolean().default(true),
  }),
});

export const collections = { blog };
