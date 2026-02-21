import { loadConfig } from "../config.js";
import { Connector, InteractionCandidate } from "./index.js";

interface AlgoliaHit {
  objectID: string;
  author: string;
  comment_text?: string;
  title?: string;
  created_at: string;
  /** The HN story this comment belongs to (reliable item id) */
  story_id?: number;
  /** Parent comment id */
  parent_id?: number;
}

/**
 * GATE-HN-SOURCEREF-VALID-01:
 * Build a valid, clickable HN URL from the most specific ID available.
 * Priority: story_id > parent_id > algolia://objectID fallback.
 */
function buildSourceRef(hit: AlgoliaHit): string {
  if (hit.story_id) {
    return `https://news.ycombinator.com/item?id=${hit.story_id}`;
  }
  if (hit.parent_id) {
    return `https://news.ycombinator.com/item?id=${hit.parent_id}`;
  }
  // Fallback: Algolia-specific ref (not an HN page, clearly labeled)
  return `algolia://comment/${hit.objectID}`;
}

export class HNConnector implements Connector {
  public id = "hn-algolia";

  // Timestamp to skip already-fetched items within a single process lifecycle.
  // NOT the primary dedup mechanism — PSG source_ref check is (see FIX-A-2).
  private lastFetchTime = 0;

  public async pull(): Promise<InteractionCandidate[]> {
    const config = loadConfig();
    const keywords = config.hn_keywords;

    const candidates: InteractionCandidate[] = [];
    const seenRefs = new Set<string>(); // Prevent intra-pull duplicates across keywords

    for (const keyword of keywords) {
      try {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(keyword)}&tags=comment&hitsPerPage=3`;
        const res = await fetch(url);
        if (!res.ok) {
          continue;
        }

        const data = (await res.json()) as { hits: AlgoliaHit[] };

        for (const hit of data.hits) {
          const hitTime = new Date(hit.created_at).getTime();
          const sourceRef = buildSourceRef(hit);

          // Skip if already seen in this pull cycle or before lastFetchTime
          if (seenRefs.has(sourceRef)) {
            continue;
          }
          if (hitTime > this.lastFetchTime) {
            seenRefs.add(sourceRef);
            candidates.push({
              source_kind: "hn",
              source_ref: sourceRef,
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
