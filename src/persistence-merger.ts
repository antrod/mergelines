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
function storedToHeadline(stored: any): Headline {
  return {
    title: stored.title,
    url: stored.url,
    source: stored.source,
    timestamp: new Date(stored.timestamp),
    popularity: stored.popularity,
    points: stored.points || undefined,
    commentCount: stored.comment_count || undefined, // Database uses snake_case
    hnDiscussionUrl: stored.hn_discussion_url || undefined,
  };
}

// Store headlines and find matches within time window
export async function storeAndMatchHeadlines(
  newTechmemeHeadlines: Headline[],
  newHNHeadlines: Headline[],
  new9to5MacHeadlines: Headline[],
  timeWindowHours: number = 12
): Promise<{
  stored: { techmeme: number; hackernews: number; nineToFiveMac: number };
  newMatches: number;
  allMerged: MergedHeadline[];
}> {
  const db = getDB();

  // Store all new headlines
  console.log(`\n💾 Storing ${newTechmemeHeadlines.length} Techmeme + ${newHNHeadlines.length} HN + ${new9to5MacHeadlines.length} 9to5Mac headlines...`);

  const techmemeIds: number[] = [];
  const hnIds: number[] = [];
  const nineToFiveMacIds: number[] = [];

  for (const headline of newTechmemeHeadlines) {
    const id = db.storeHeadline(headline);
    if (id) techmemeIds.push(id);
  }

  for (const headline of newHNHeadlines) {
    const id = db.storeHeadline(headline);
    if (id) hnIds.push(id);
  }

  for (const headline of new9to5MacHeadlines) {
    const id = db.storeHeadline(headline);
    if (id) nineToFiveMacIds.push(id);
  }

  // Get all headlines within time window (for matching)
  const techmemeInWindow = db.getHeadlinesInWindow(timeWindowHours, 'techmeme');
  const hnInWindow = db.getHeadlinesInWindow(timeWindowHours, 'hackernews');
  const nineToFiveMacInWindow = db.getHeadlinesInWindow(timeWindowHours, '9to5mac');

  console.log(`🕐 Found ${techmemeInWindow.length} Techmeme + ${hnInWindow.length} HN + ${nineToFiveMacInWindow.length} 9to5Mac headlines in ${timeWindowHours}h window`);

  // Convert fresh headlines to stored format for display (use only current scrape)
  const freshTechmemeStored = techmemeIds.map(id => {
    const stored = db.getHeadlineById(id);
    return stored;
  }).filter((h): h is StoredHeadline => h !== null);

  const freshHNStored = hnIds.map(id => {
    const stored = db.getHeadlineById(id);
    return stored;
  }).filter((h): h is StoredHeadline => h !== null);

  const fresh9to5MacStored = nineToFiveMacIds.map(id => {
    const stored = db.getHeadlineById(id);
    return stored;
  }).filter((h): h is StoredHeadline => h !== null);

  console.log(`📋 Using ${freshTechmemeStored.length} fresh Techmeme + ${freshHNStored.length} fresh HN + ${fresh9to5MacStored.length} fresh 9to5Mac for display`);

  // Find matches across all 3 sources (any pair)
  let newMatches = 0;
  const allHeadlines = [
    ...techmemeInWindow.map(h => ({ ...h, sourceType: 'techmeme' as const })),
    ...hnInWindow.map(h => ({ ...h, sourceType: 'hackernews' as const })),
    ...nineToFiveMacInWindow.map(h => ({ ...h, sourceType: '9to5mac' as const }))
  ];

  // Track which headline IDs have been matched
  const matchedIds = new Set<string>();

  // Find all 2-way and 3-way matches
  for (let i = 0; i < allHeadlines.length; i++) {
    for (let j = i + 1; j < allHeadlines.length; j++) {
      const h1 = allHeadlines[i];
      const h2 = allHeadlines[j];

      // Skip if same source or already matched
      if (h1.sourceType === h2.sourceType) continue;

      if (isSameStory(h1, h2)) {
        const matchKey = `${h1.id}-${h2.id}`;
        if (!matchedIds.has(matchKey)) {
          matchedIds.add(matchKey);
          matchedIds.add(`${h2.id}-${h1.id}`);

          // Check if already in database
          const existingStories = db.getCrossPlatformStories(1000);
          const alreadyExists = existingStories.some(story =>
            (story.techmeme_headline_id === h1.id && story.hn_headline_id === h2.id) ||
            (story.techmeme_headline_id === h2.id && story.hn_headline_id === h1.id)
          );

          if (!alreadyExists) {
            console.log(`🤖 Generating summary for: "${h1.title.substring(0, 50)}..."`);
            const summary = await generateSummary(h1.title, h2.title);
            db.storeCrossPlatformStory(h1.id, h2.id, h1.title, summary);
            newMatches++;
            console.log(`✨ New match found! Total new matches: ${newMatches}`);
          }
        }
      }
    }
  }

  // Build merged view for display
  const merged: MergedHeadline[] = [];
  const processed = new Set<number>();

  // Helper to create merged headline from multiple sources
  const createMergedHeadline = (stories: StoredHeadline[]): MergedHeadline => {
    const urls = stories.map(s => ({
      source: s.source === 'techmeme' ? 'Techmeme' : s.source === 'hackernews' ? 'Hacker News' : '9to5Mac',
      url: s.url
    }));

    const earliest = Math.min(...stories.map(s => s.timestamp));
    const totalPopularity = stories.reduce((sum, s) => sum + s.popularity, 0);

    const merged: MergedHeadline = {
      title: stories[0].title,
      urls,
      inBothSites: stories.length >= 2,
      timestamp: new Date(earliest),
      popularity: totalPopularity,
    };

    // Add source-specific data
    stories.forEach(s => {
      if (s.source === 'techmeme') merged.techmemeData = storedToHeadline(s);
      if (s.source === 'hackernews') merged.hackernewsData = storedToHeadline(s);
      if (s.source === '9to5mac') merged.nineToFiveMacData = storedToHeadline(s);
    });

    return merged;
  };

  // First pass: find all fresh headlines that match across 2+ sources
  const allFresh = [
    ...freshTechmemeStored,
    ...freshHNStored,
    ...fresh9to5MacStored
  ];

  for (const fresh of allFresh) {
    if (processed.has(fresh.id)) continue;

    // Find all matching headlines (including from other sources in window)
    const matches: StoredHeadline[] = [fresh];
    processed.add(fresh.id);

    for (const other of [...techmemeInWindow, ...hnInWindow, ...nineToFiveMacInWindow]) {
      if (processed.has(other.id)) continue;
      if (fresh.source === other.source) continue;

      if (isSameStory(fresh, other)) {
        matches.push(other);
        processed.add(other.id);
      }
    }

    // Add to merged list if matches 2+ sources or is a fresh headline
    if (matches.length >= 2) {
      merged.push(createMergedHeadline(matches));
    }
  }

  // Collect unmatched fresh stories
  const unmatchedTM: MergedHeadline[] = [];
  const unmatchedHN: MergedHeadline[] = [];
  const unmatched9to5Mac: MergedHeadline[] = [];

  for (const tmStored of freshTechmemeStored) {
    if (!processed.has(tmStored.id)) {
      unmatchedTM.push(createMergedHeadline([tmStored]));
      processed.add(tmStored.id);
    }
  }

  for (const hnStored of freshHNStored) {
    if (!processed.has(hnStored.id)) {
      unmatchedHN.push(createMergedHeadline([hnStored]));
      processed.add(hnStored.id);
    }
  }

  for (const macStored of fresh9to5MacStored) {
    if (!processed.has(macStored.id)) {
      unmatched9to5Mac.push(createMergedHeadline([macStored]));
      processed.add(macStored.id);
    }
  }

  // Sort by source-specific metrics
  unmatchedTM.sort((a, b) => a.popularity - b.popularity); // Position, lower is better
  unmatchedHN.sort((a, b) => b.popularity - a.popularity); // Points, higher is better
  unmatched9to5Mac.sort((a, b) => b.popularity - a.popularity); // Comments, higher is better

  // Deduplicate Techmeme stories
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

  // Interleave HN, Techmeme, and 9to5Mac stories
  const maxLength = Math.max(dedupedTM.length, unmatchedHN.length, unmatched9to5Mac.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < unmatchedHN.length) {
      merged.push(unmatchedHN[i]);
    }
    if (i < dedupedTM.length) {
      merged.push(dedupedTM[i]);
    }
    if (i < unmatched9to5Mac.length) {
      merged.push(unmatched9to5Mac[i]);
    }
  }

  return {
    stored: {
      techmeme: techmemeIds.length,
      hackernews: hnIds.length,
      nineToFiveMac: nineToFiveMacIds.length
    },
    newMatches,
    allMerged: merged,
  };
}
