import { searchSearxng } from '../searxng';
import { NormalizedSource } from '../types/sources';
import { getCanonicalUrl } from '../utils/normalization';

export async function searchWeb(query: string): Promise<NormalizedSource[]> {
  try {
    const { results } = await searchSearxng(query, {
      categories: ['general'],
      pageno: 1
    });

    if (!results) return [];

    return results.map((r) => {
      return {
        title: r.title || 'Untitled Web Page',
        url: r.url,
        canonicalUrl: getCanonicalUrl(r.url),
        sourceType: 'web' as const,
        provider: 'searxng',
        authors: r.author || null,
        publishedAt: null,
        retrievedAt: new Date().toISOString(),
        doi: null,
        snippet: r.content || null,
        metadata: {
          iframeSrc: r.iframe_src || null,
          imgSrc: r.img_src || null
        }
      };
    });
  } catch (err) {
    console.error('Error in searchWeb adapter (SearXNG):', err);
    throw err;
  }
}
