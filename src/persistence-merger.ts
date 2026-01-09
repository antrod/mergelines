import { Headline, MergedHeadline } from './types';
import { getDB, StoredHeadline } from './db';
import { generateSummary } from './rss';

// Simple similarity check (from merger.ts)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

const STOP_WORDS = new Set(['with', 'from', 'that', 'this', 'have', 'will', 'after', 'about', 'says', 'their', 'more', 'than', 'into', 'over', 'some', 'been']);

function isSameStory(h1: { title: string; url: string }, h2: { title: string; url: string }): boolean {
  const domain1 = extractDomain(h1.url);
  const domain2 = extractDomain(h2.url);
  if (domain1 && domain2 && domain1 === domain2) {
    return true;
  }

  const titleSim = similarity(h1.title, h2.title);
  if (titleSim > 0.45) return true;

  const words1 = h1.title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const words2 = h2.title.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const sharedWords = words1.filter(w => words2.includes(w));
  const minWords = Math.min(words1.length, words2.length);

  if (minWords > 0 && sharedWords.length / minWords > 0.35) {
    return true;
  }

  return false;
}

// Convert StoredHeadline to Headline
function storedToHeadline(stored: StoredHeadline): Headline {
  return {
    title: stored.title,
    url: stored.url,
    source: stored.source,
    timestamp: new Date(stored.timestamp),
    popularity: stored.popularity,
    points: stored.points || undefined,
    commentCount: stored.commentCount || undefined,
  };
}

// Store headlines and find matches within time window
export async function storeAndMatchHeadlines(
  newTechmemeHeadlines: Headline[],
  newHNHeadlines: Headline[],
  timeWindowHours: number = 12
): Promise<{
  stored: { techmeme: number; hackernews: number };
  newMatches: number;
  allMerged: MergedHeadline[];
}> {
  const db = getDB();

  // Store all new headlines
  console.log(`\n💾 Storing ${newTechmemeHeadlines.length} Techmeme + ${newHNHeadlines.length} HN headlines...`);

  const techmemeIds: number[] = [];
  const hnIds: number[] = [];

  for (const headline of newTechmemeHeadlines) {
    const id = db.storeHeadline(headline);
    if (id) techmemeIds.push(id);
  }

  for (const headline of newHNHeadlines) {
    const id = db.storeHeadline(headline);
    if (id) hnIds.push(id);
  }

  // Get all headlines within time window
  const techmemeInWindow = db.getHeadlinesInWindow(timeWindowHours, 'techmeme');
  const hnInWindow = db.getHeadlinesInWindow(timeWindowHours, 'hackernews');

  console.log(`🕐 Found ${techmemeInWindow.length} Techmeme + ${hnInWindow.length} HN headlines in ${timeWindowHours}h window`);

  // Find new matches
  let newMatches = 0;
  const processedHN = new Set<number>();

  for (const tmStored of techmemeInWindow) {
    for (const hnStored of hnInWindow) {
      if (processedHN.has(hnStored.id)) continue;

      if (isSameStory(tmStored, hnStored)) {
        // Check if this match already exists
        const existing = db.getCrossPlatformStoryDetails(0); // We'll check manually
        let alreadyMatched = false;

        // Simple check: if both IDs exist in any cross-platform story, skip
        const existingStories = db.getCrossPlatformStories(1000);
        for (const story of existingStories) {
          if (
            story.techmeme_headline_id === tmStored.id &&
            story.hn_headline_id === hnStored.id
          ) {
            alreadyMatched = true;
            break;
          }
        }

        if (!alreadyMatched) {
          // Generate summary
          console.log(`🤖 Generating summary for: "${tmStored.title.substring(0, 50)}..."`);
          const summary = await generateSummary(tmStored.title, hnStored.title);

          // Store cross-platform story
          db.storeCrossPlatformStory(tmStored.id, hnStored.id, tmStored.title, summary);
          newMatches++;
          console.log(`✨ New match found! Total new matches: ${newMatches}`);
        }

        processedHN.add(hnStored.id);
        break;
      }
    }
  }

  // Build merged view for display
  const merged: MergedHeadline[] = [];
  const processedTM = new Set<number>();
  const processedHNDisplay = new Set<number>();

  // Add matched stories first
  for (const tmStored of techmemeInWindow) {
    for (const hnStored of hnInWindow) {
      if (processedHNDisplay.has(hnStored.id)) continue;

      if (isSameStory(tmStored, hnStored)) {
        merged.push({
          title: tmStored.title,
          urls: [
            { source: 'Techmeme', url: tmStored.url },
            { source: 'Hacker News', url: hnStored.url }
          ],
          inBothSites: true,
          timestamp: new Date(Math.min(tmStored.timestamp, hnStored.timestamp)),
          popularity: tmStored.popularity + hnStored.popularity,
          techmemeData: storedToHeadline(tmStored),
          hackernewsData: storedToHeadline(hnStored),
        });

        processedTM.add(tmStored.id);
        processedHNDisplay.add(hnStored.id);
        break;
      }
    }
  }

  // Collect unmatched stories
  const unmatchedTM: MergedHeadline[] = [];
  const unmatchedHN: MergedHeadline[] = [];

  for (const tmStored of techmemeInWindow) {
    if (!processedTM.has(tmStored.id)) {
      unmatchedTM.push({
        title: tmStored.title,
        urls: [{ source: 'Techmeme', url: tmStored.url }],
        inBothSites: false,
        timestamp: new Date(tmStored.timestamp),
        popularity: tmStored.popularity,
        techmemeData: storedToHeadline(tmStored),
      });
    }
  }

  for (const hnStored of hnInWindow) {
    if (!processedHNDisplay.has(hnStored.id)) {
      unmatchedHN.push({
        title: hnStored.title,
        urls: [{ source: 'Hacker News', url: hnStored.url }],
        inBothSites: false,
        timestamp: new Date(hnStored.timestamp),
        popularity: hnStored.popularity,
        hackernewsData: storedToHeadline(hnStored),
      });
    }
  }

  // Deduplicate Techmeme stories (peel apart stories about same topic)
  const dedupedTM: MergedHeadline[] = [];
  for (const tm of unmatchedTM) {
    let isDuplicate = false;
    for (const existing of dedupedTM) {
      if (similarity(tm.title, existing.title) > 0.5) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      dedupedTM.push(tm);
    }
  }

  // Interleave HN and deduplicated Techmeme stories
  const maxLength = Math.max(dedupedTM.length, unmatchedHN.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < unmatchedHN.length) {
      merged.push(unmatchedHN[i]);
    }
    if (i < dedupedTM.length) {
      merged.push(dedupedTM[i]);
    }
  }

  return {
    stored: { techmeme: techmemeIds.length, hackernews: hnIds.length },
    newMatches,
    allMerged: merged,
  };
}
