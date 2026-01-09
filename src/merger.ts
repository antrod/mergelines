import { Headline, MergedHeadline } from './types';

// Simple string similarity function using Levenshtein distance
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

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

// Common stop words that don't help with matching
const STOP_WORDS = new Set(['with', 'from', 'that', 'this', 'have', 'will', 'after', 'about', 'says', 'their', 'more', 'than', 'into', 'over', 'some', 'been']);

// Check if two headlines are about the same story
function isSameStory(h1: Headline, h2: Headline): boolean {
  // Check if both link to the same domain (strong signal)
  const domain1 = extractDomain(h1.url);
  const domain2 = extractDomain(h2.url);
  if (domain1 && domain2 && domain1 === domain2) {
    return true;
  }

  // Check title similarity (lowered threshold to 0.45 - 45% similar)
  const titleSim = similarity(h1.title, h2.title);
  if (titleSim > 0.45) return true;

  // Check if they share significant words (excluding stop words)
  const words1 = h1.title.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const words2 = h2.title.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const sharedWords = words1.filter(w => words2.includes(w));
  const minWords = Math.min(words1.length, words2.length);

  // Lowered threshold to 0.35 (35% word overlap)
  if (minWords > 0 && sharedWords.length / minWords > 0.35) {
    return true;
  }

  return false;
}

// Check if headlines are within time window
// Default 24 hours since Techmeme uses scrape time, not article publish time
function withinTimeWindow(h1: Headline, h2: Headline, hoursWindow: number = 24): boolean {
  const timeDiff = Math.abs(h1.timestamp.getTime() - h2.timestamp.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  return hoursDiff <= hoursWindow;
}

export function mergeAndRankHeadlines(
  techmemeHeadlines: Headline[],
  hnHeadlines: Headline[]
): MergedHeadline[] {
  const merged: MergedHeadline[] = [];
  const processedHN = new Set<number>();

  // First pass: find stories that appear on both sites
  for (const tmHeadline of techmemeHeadlines) {
    let matched = false;

    for (let i = 0; i < hnHeadlines.length; i++) {
      if (processedHN.has(i)) continue;

      const hnHeadline = hnHeadlines[i];

      if (isSameStory(tmHeadline, hnHeadline) && withinTimeWindow(tmHeadline, hnHeadline)) {
        // Found a match!
        merged.push({
          title: tmHeadline.title, // Use Techmeme title as primary
          urls: [
            { source: 'Techmeme', url: tmHeadline.url },
            { source: 'Hacker News', url: hnHeadline.url }
          ],
          inBothSites: true,
          timestamp: new Date(Math.min(tmHeadline.timestamp.getTime(), hnHeadline.timestamp.getTime())),
          popularity: (tmHeadline.popularity || 0) + (hnHeadline.popularity || 0),
          techmemeData: tmHeadline,
          hackernewsData: hnHeadline
        });

        processedHN.add(i);
        matched = true;
        break;
      }
    }

    // If no match, add as Techmeme-only story
    if (!matched) {
      merged.push({
        title: tmHeadline.title,
        urls: [{ source: 'Techmeme', url: tmHeadline.url }],
        inBothSites: false,
        timestamp: tmHeadline.timestamp,
        popularity: tmHeadline.popularity || 0,
        techmemeData: tmHeadline
      });
    }
  }

  // Add unmatched Hacker News stories
  for (let i = 0; i < hnHeadlines.length; i++) {
    if (!processedHN.has(i)) {
      const hnHeadline = hnHeadlines[i];
      merged.push({
        title: hnHeadline.title,
        urls: [{ source: 'Hacker News', url: hnHeadline.url }],
        inBothSites: false,
        timestamp: hnHeadline.timestamp,
        popularity: hnHeadline.popularity || 0,
        hackernewsData: hnHeadline
      });
    }
  }

  // Sort: first by whether it's on both sites, then by popularity
  merged.sort((a, b) => {
    if (a.inBothSites !== b.inBothSites) {
      return a.inBothSites ? -1 : 1; // Stories on both sites come first
    }
    return b.popularity - a.popularity; // Higher popularity first
  });

  return merged;
}
