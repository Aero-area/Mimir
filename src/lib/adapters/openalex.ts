import { NormalizedSource } from '../types/sources';
import { getCanonicalUrl } from '../utils/normalization';

interface OpenAlexAuthor {
  author: {
    display_name: string;
  };
}

interface OpenAlexWork {
  id: string;
  title: string;
  doi: string | null;
  publication_date: string | null;
  primary_location?: {
    landing_page_url?: string;
    source?: {
      display_name?: string;
    } | null;
  } | null;
  authorships?: OpenAlexAuthor[];
  cited_by_count?: number;
  open_access?: {
    is_oa: boolean;
  };
  abstract_inverted_index?: Record<string, number[]> | null;
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string | null {
  if (!invertedIndex) return null;
  try {
    const words: string[] = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        words[pos] = word;
      }
    }
    return words.join(' ');
  } catch (e) {
    console.error('Error reconstructing abstract:', e);
    return null;
  }
}

export async function searchOpenAlex(query: string): Promise<NormalizedSource[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=10`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mimir/1.0 (mailto:mimir-project@example.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAlex request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const results: OpenAlexWork[] = data.results || [];

    return results.map((work) => {
      const doi = work.doi ? work.doi.replace('https://doi.org/', '') : null;
      const url = work.primary_location?.landing_page_url || work.id;
      const authors = work.authorships
        ? work.authorships.map((a) => a.author.display_name).join(', ')
        : null;
      
      const abstract = reconstructAbstract(work.abstract_inverted_index);

      return {
        title: work.title || 'Untitled Academic Paper',
        url,
        canonicalUrl: getCanonicalUrl(url),
        sourceType: 'academic',
        provider: 'openalex',
        authors: authors || null,
        publishedAt: work.publication_date || null,
        retrievedAt: new Date().toISOString(),
        doi,
        snippet: abstract || null,
        metadata: {
          openAlexId: work.id,
          citations: work.cited_by_count || 0,
          isOpenAccess: work.open_access?.is_oa || false,
          venue: work.primary_location?.source?.display_name || null,
        }
      };
    });
  } catch (err: any) {
    console.error('Error in searchOpenAlex adapter:', err);
    throw err;
  }
}
