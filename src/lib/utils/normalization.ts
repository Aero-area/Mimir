import { NormalizedSource } from '../types/sources';

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function getCanonicalUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    let pathname = url.pathname.toLowerCase();
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${host}${pathname}`;
  } catch (e) {
    // Fallback if URL is invalid
    let cleaned = urlStr.toLowerCase();
    cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
    cleaned = cleaned.split('?')[0].split('#')[0];
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  }
}

export function extractGithubRepo(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (url.hostname.toLowerCase().includes('github.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
      }
    }
  } catch (e) {}
  
  // Regex fallback
  const match = urlStr.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (match) {
    return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
  }
  return null;
}

export function getPublishedYear(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const match = publishedAt.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

export function mergeSources(sources: NormalizedSource[]): NormalizedSource[] {
  const merged: NormalizedSource[] = [];

  for (const source of sources) {
    let existingIndex = -1;

    for (let i = 0; i < merged.length; i++) {
      const item = merged[i];

      // 1. Merge by DOI
      if (source.doi && item.doi && source.doi.toLowerCase() === item.doi.toLowerCase()) {
        existingIndex = i;
        break;
      }

      // 2. Merge by GitHub Repository ID
      const sourceRepo = extractGithubRepo(source.url);
      const itemRepo = extractGithubRepo(item.url);
      if (sourceRepo && itemRepo && sourceRepo === itemRepo) {
        existingIndex = i;
        break;
      }

      // 3. Merge by Canonical URL
      if (source.canonicalUrl === item.canonicalUrl) {
        existingIndex = i;
        break;
      }

      // 4. Merge by Normalized Title and Publication Year
      const sourceTitleNorm = normalizeTitle(source.title);
      const itemTitleNorm = normalizeTitle(item.title);
      if (sourceTitleNorm && itemTitleNorm && sourceTitleNorm === itemTitleNorm) {
        const sourceYear = getPublishedYear(source.publishedAt);
        const itemYear = getPublishedYear(item.publishedAt);
        if (sourceYear && itemYear && sourceYear === itemYear) {
          existingIndex = i;
          break;
        }
      }
    }

    if (existingIndex !== -1) {
      // Merge records
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        // Keep the more complete authors/published date/doi
        authors: existing.authors || source.authors,
        publishedAt: existing.publishedAt || source.publishedAt,
        doi: existing.doi || source.doi,
        // Prefer longer snippet/description
        snippet: (existing.snippet || '').length >= (source.snippet || '').length
          ? existing.snippet
          : source.snippet,
        // Merge metadata
        metadata: {
          ...existing.metadata,
          ...source.metadata,
          mergedFromProviders: Array.from(new Set([
            ...(existing.metadata.mergedFromProviders || [existing.provider]),
            source.provider
          ]))
        }
      };
    } else {
      merged.push({
        ...source,
        metadata: {
          ...source.metadata,
          mergedFromProviders: [source.provider]
        }
      });
    }
  }

  return merged;
}
