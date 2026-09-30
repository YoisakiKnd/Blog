import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.string().default('日常'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** 系列名。同一系列的文章会自动串起来，留空就不参与 */
    series: z.string().optional(),
  }),
});

export const collections = { posts };