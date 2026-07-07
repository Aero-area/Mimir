export interface NormalizedSource {
  title: string;
  url: string;
  canonicalUrl: string;
  sourceType: 'web' | 'academic' | 'repository' | 'social';
  provider: string; // 'searxng' | 'openalex' | 'github'
  authors: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  doi: string | null;
  snippet: string | null;
  metadata: Record<string, any>;
}
