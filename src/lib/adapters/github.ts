import { NormalizedSource } from '../types/sources';
import { getCanonicalUrl } from '../utils/normalization';

interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  stargazers_count: number;
  language: string | null;
  open_issues_count: number;
  archived: boolean;
  owner: {
    login: string;
  };
  license?: {
    name: string;
  } | null;
}

export async function searchGithub(query: string, customToken?: string): Promise<NormalizedSource[]> {
  try {
    const token = customToken || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      'User-Agent': 'Mimir-App',
      'Accept': 'application/vnd.github.v3+json',
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`;
    const response = await fetch(searchUrl, { headers });

    if (!response.ok) {
      throw new Error(`GitHub search request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const items: GitHubRepoItem[] = data.items || [];

    const detailedSources = await Promise.all(
      items.map(async (item) => {
        const owner = item.owner.login;
        const repoName = item.name;
        
        let latestRelease: string | null = null;
        let readme: string | null = null;

        // Fetch latest release
        try {
          const releaseRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/releases/latest`,
            { headers }
          );
          if (releaseRes.ok) {
            const releaseData = await releaseRes.json();
            latestRelease = releaseData.tag_name || releaseData.name || null;
          }
        } catch (e) {
          console.warn(`Failed to fetch release for ${item.full_name}:`, e);
        }

        // Fetch README
        try {
          const readmeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/readme`,
            { headers }
          );
          if (readmeRes.ok) {
            const readmeData = await readmeRes.json();
            if (readmeData.content) {
              const decoded = Buffer.from(readmeData.content, 'base64').toString('utf8');
              // Preview of README (max 2000 chars)
              readme = decoded.slice(0, 2000);
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch README for ${item.full_name}:`, e);
        }

        return {
          title: item.full_name,
          url: item.html_url,
          canonicalUrl: getCanonicalUrl(item.html_url),
          sourceType: 'repository' as const,
          provider: 'github',
          authors: owner,
          publishedAt: item.created_at || null,
          retrievedAt: new Date().toISOString(),
          doi: null,
          snippet: item.description || null,
          metadata: {
            stars: item.stargazers_count,
            language: item.language || null,
            license: item.license?.name || null,
            openIssues: item.open_issues_count,
            archived: item.archived,
            updatedAt: item.updated_at,
            owner,
            repoName,
            latestRelease,
            readmePreview: readme || null
          }
        };
      })
    );

    return detailedSources;
  } catch (err: any) {
    console.error('Error in searchGithub adapter:', err);
    throw err;
  }
}
