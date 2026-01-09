import RSS from 'rss';
import fs from 'fs';
import path from 'path';
import { getDB, CrossPlatformStory } from './db';
import OpenAI from 'openai';

const FEED_PATH = path.join(process.cwd(), 'feed.xml');

// Lazy-initialize OpenAI client
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Generate summary for a cross-platform story
export async function generateSummary(
  techmemeTitle: string,
  hnTitle: string
): Promise<string> {
  try {
    const client = getOpenAI();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at writing concise, informative summaries of tech news stories.

Given two headlines about the same story from different sources (Techmeme and Hacker News), create a single unified summary that:
1. Captures the key facts and significance
2. Is 2-3 sentences maximum
3. Is neutral and factual
4. Focuses on what matters to tech professionals

Return ONLY the summary text, no preamble or explanation.`
        },
        {
          role: 'user',
          content: `Generate a summary for this tech story that appeared on both Techmeme and Hacker News:

Techmeme headline: "${techmemeTitle}"
Hacker News headline: "${hnTitle}"

Summary:`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return completion.choices[0].message.content?.trim() || techmemeTitle;
  } catch (error) {
    console.error('Error generating summary:', error);
    // Fallback to simple combination
    return `${techmemeTitle}`;
  }
}

// Generate RSS feed from merged headlines (top 10)
export async function generateRSSFeed(mergedHeadlines: any[]): Promise<string> {
  const feed = new RSS({
    title: 'Mergelines - Top Tech News',
    description: 'Top tech stories from Techmeme and Hacker News, featuring cross-platform matches',
    feed_url: 'https://yoursite.com/feed.xml',
    site_url: 'https://yoursite.com',
    language: 'en',
    pubDate: new Date(),
    ttl: 60,
  });

  // Take top 10 headlines
  const topHeadlines = mergedHeadlines.slice(0, 10);

  for (const headline of topHeadlines) {
    let itemDescription = '';
    let primaryUrl = '';
    const customElements: any[] = [];

    if (headline.inBothSites) {
      // Cross-platform story - fetch summary from DB
      const db = getDB();
      const crossPlatformStories = db.getCrossPlatformStories(100);
      const matchingStory = crossPlatformStories.find(s => s.title === headline.title);
      const summary = matchingStory?.summary || headline.title;

      itemDescription = `
        <p><strong>🔥 Featured on both Techmeme and Hacker News</strong></p>
        <p>${summary}</p>
        <p><strong>Sources:</strong></p>
        <ul>
          <li><a href="${headline.urls[0].url}">Techmeme</a></li>
          <li><a href="${headline.urls[1].url}">Hacker News</a> (${headline.hackernewsData?.points || 0} points, ${headline.hackernewsData?.commentCount || 0} comments)</li>
        </ul>
      `;
      primaryUrl = headline.urls[0].url;
      customElements.push(
        { 'techmeme:url': headline.urls[0].url },
        { 'hn:url': headline.urls[1].url },
        { 'hn:points': headline.hackernewsData?.points?.toString() || '0' },
        { 'hn:comments': headline.hackernewsData?.commentCount?.toString() || '0' }
      );
    } else {
      // Single-source story
      const source = headline.urls[0].source;
      primaryUrl = headline.urls[0].url;

      if (source === 'Hacker News') {
        itemDescription = `
          <p><strong>From Hacker News</strong></p>
          <p>${headline.hackernewsData?.points || 0} points • ${headline.hackernewsData?.commentCount || 0} comments</p>
          <p><a href="${primaryUrl}">Read on Hacker News</a></p>
        `;
        customElements.push(
          { 'hn:url': primaryUrl },
          { 'hn:points': headline.hackernewsData?.points?.toString() || '0' },
          { 'hn:comments': headline.hackernewsData?.commentCount?.toString() || '0' }
        );
      } else {
        itemDescription = `
          <p><strong>From Techmeme</strong></p>
          <p><a href="${primaryUrl}">Read on Techmeme</a></p>
        `;
        customElements.push({ 'techmeme:url': primaryUrl });
      }
    }

    feed.item({
      title: headline.title,
      description: itemDescription,
      url: primaryUrl,
      date: headline.timestamp,
      custom_elements: customElements,
    });
  }

  return feed.xml({ indent: true });
}

// Write RSS feed to file
export async function writeRSSFeed(mergedHeadlines: any[]): Promise<void> {
  const xml = await generateRSSFeed(mergedHeadlines);
  fs.writeFileSync(FEED_PATH, xml, 'utf-8');
  console.log(`\n✓ RSS feed written to ${FEED_PATH}`);
}

// Get RSS feed file path
export function getRSSFeedPath(): string {
  return FEED_PATH;
}
