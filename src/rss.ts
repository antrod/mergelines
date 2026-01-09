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

// Generate RSS feed from cross-platform stories
export async function generateRSSFeed(): Promise<string> {
  const db = getDB();
  const stories = db.getCrossPlatformStories(50);

  const feed = new RSS({
    title: 'Mergelines - Cross-Platform Tech News',
    description: 'Tech stories that appeared on both Techmeme and Hacker News',
    feed_url: 'https://yoursite.com/feed.xml',
    site_url: 'https://yoursite.com',
    language: 'en',
    pubDate: new Date(),
    ttl: 60,
  });

  for (const story of stories) {
    const details = db.getCrossPlatformStoryDetails(story.id);
    if (!details) continue;

    const { techmeme, hackernews } = details;

    // Use story summary or title
    const description = story.summary || story.title;

    // Create item with links to both sources
    const itemDescription = `
      <p>${description}</p>
      <p><strong>Sources:</strong></p>
      <ul>
        <li><a href="${techmeme.url}">Techmeme</a></li>
        <li><a href="${hackernews.url}">Hacker News</a> (${hackernews.points || 0} points, ${hackernews.commentCount || 0} comments)</li>
      </ul>
    `;

    feed.item({
      title: story.title,
      description: itemDescription,
      url: techmeme.url, // Use Techmeme as primary link
      date: new Date(story.matched_at),
      custom_elements: [
        { 'techmeme:url': techmeme.url },
        { 'hn:url': hackernews.url },
        { 'hn:points': hackernews.points?.toString() || '0' },
        { 'hn:comments': hackernews.commentCount?.toString() || '0' },
      ],
    });
  }

  return feed.xml({ indent: true });
}

// Write RSS feed to file
export async function writeRSSFeed(): Promise<void> {
  const xml = await generateRSSFeed();
  fs.writeFileSync(FEED_PATH, xml, 'utf-8');
  console.log(`\n✓ RSS feed written to ${FEED_PATH}`);
}

// Get RSS feed file path
export function getRSSFeedPath(): string {
  return FEED_PATH;
}
