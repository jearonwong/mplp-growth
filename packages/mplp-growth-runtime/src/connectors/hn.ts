import { Connector, InteractionCandidate } from "./index.js";

interface AlgoliaHit {
  objectID: string;
  author: string;
  comment_text?: string;
  title?: string;
  created_at: string;
}

export class HNConnector implements Connector {
  public id = "hn-algolia";

  // A simple timestamp to avoid pulling the same items repeatedly in a real runtime.
  // For the MVP demo, we can just pull the latest 5.
  private lastFetchTime = 0;

  constructor(private keywords: string[] = ["opensource", "mplp", "openclaw"]) {}

  public async pull(): Promise<InteractionCandidate[]> {
    const candidates: InteractionCandidate[] = [];

    for (const keyword of this.keywords) {
      try {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(keyword)}&tags=comment&hitsPerPage=3`;
        const res = await fetch(url);
        if (!res.ok) {
          continue;
        }

        const data = (await res.json()) as { hits: AlgoliaHit[] };

        for (const hit of data.hits) {
          const hitTime = new Date(hit.created_at).getTime();
          if (hitTime > this.lastFetchTime) {
            candidates.push({
              source_kind: "hn",
              source_ref: `https://news.ycombinator.com/item?id=${hit.objectID}`,
              author_handle: hit.author,
              content: hit.comment_text || hit.title || "",
              timestamp: hit.created_at,
            });
          }
        }
      } catch (err) {
        console.error(`[HNConnector] Error fetching for keyword ${keyword}:`, err);
      }
    }

    this.lastFetchTime = Date.now();
    return candidates;
  }
}

export const hnConnector = new HNConnector();
