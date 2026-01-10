import Database from 'better-sqlite3';
import path from 'path';
import { Headline } from './types';

const DB_PATH = path.join(process.cwd(), 'mergelines.db');

export interface StoredHeadline {
  id: number;
  title: string;
  url: string;
  source: 'techmeme' | 'hackernews';
  timestamp: number;
  popularity: number;
  points?: number;
  commentCount?: number;
  hn_discussion_url?: string;
  contentHash: string;
}

export interface CrossPlatformStory {
  id: number;
  techmeme_headline_id: number;
  hn_headline_id: number;
  matched_at: number;
  title: string;
  summary?: string;
  rss_published: number;
}

class MergelinesDB {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  private initSchema() {
    // Create headlines table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS headlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        popularity INTEGER DEFAULT 0,
        points INTEGER,
        comment_count INTEGER,
        hn_discussion_url TEXT,
        content_hash TEXT NOT NULL,
        UNIQUE(content_hash, source)
      )
    `);

    // Create index on timestamp for time-window queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_headlines_timestamp
      ON headlines(timestamp)
    `);

    // Create cross-platform stories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cross_platform_stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        techmeme_headline_id INTEGER NOT NULL,
        hn_headline_id INTEGER NOT NULL,
        matched_at INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        rss_published INTEGER NOT NULL,
        FOREIGN KEY(techmeme_headline_id) REFERENCES headlines(id),
        FOREIGN KEY(hn_headline_id) REFERENCES headlines(id),
        UNIQUE(techmeme_headline_id, hn_headline_id)
      )
    `);

    // Create index on matched_at for RSS feed queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cross_platform_matched_at
      ON cross_platform_stories(matched_at DESC)
    `);
  }

  // Simple hash function for deduplication
  private hashHeadline(title: string, url: string): string {
    return Buffer.from(`${title}:${url}`).toString('base64');
  }

  // Store a headline (returns existing ID if already exists)
  storeHeadline(headline: Headline): number {
    const hash = this.hashHeadline(headline.title, headline.url);

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO headlines
      (title, url, source, timestamp, popularity, points, comment_count, hn_discussion_url, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      headline.title,
      headline.url,
      headline.source,
      headline.timestamp.getTime(),
      headline.popularity || 0,
      headline.points || null,
      headline.commentCount || null,
      headline.hnDiscussionUrl || null,
      hash
    );

    // If inserted, return new ID, otherwise find existing ID
    if (result.changes > 0) {
      return result.lastInsertRowid as number;
    }

    // Find existing headline
    const existing = this.db.prepare(
      'SELECT id FROM headlines WHERE content_hash = ? AND source = ?'
    ).get(hash, headline.source) as { id: number } | undefined;

    return existing?.id || 0;
  }

  // Get a single headline by ID
  getHeadlineById(id: number): StoredHeadline | null {
    return this.db.prepare('SELECT * FROM headlines WHERE id = ?').get(id) as StoredHeadline | undefined || null;
  }

  // Get headlines within time window (in hours)
  getHeadlinesInWindow(hoursAgo: number, source?: 'techmeme' | 'hackernews'): StoredHeadline[] {
    const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);

    let query = 'SELECT * FROM headlines WHERE timestamp >= ?';
    const params: any[] = [cutoffTime];

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    query += ' ORDER BY timestamp DESC';

    return this.db.prepare(query).all(...params) as StoredHeadline[];
  }

  // Store a cross-platform story
  storeCrossPlatformStory(
    techmemeId: number,
    hnId: number,
    title: string,
    summary?: string
  ): number {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO cross_platform_stories
      (techmeme_headline_id, hn_headline_id, matched_at, title, summary, rss_published)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(techmemeId, hnId, now, title, summary || null, now);

    if (result.changes > 0) {
      return result.lastInsertRowid as number;
    }

    // Return existing ID
    const existing = this.db.prepare(
      'SELECT id FROM cross_platform_stories WHERE techmeme_headline_id = ? AND hn_headline_id = ?'
    ).get(techmemeId, hnId) as { id: number } | undefined;

    return existing?.id || 0;
  }

  // Get cross-platform stories for RSS feed
  getCrossPlatformStories(limit: number = 50): CrossPlatformStory[] {
    return this.db.prepare(`
      SELECT * FROM cross_platform_stories
      ORDER BY matched_at DESC
      LIMIT ?
    `).all(limit) as CrossPlatformStory[];
  }

  // Get full details for a cross-platform story
  getCrossPlatformStoryDetails(storyId: number): {
    story: CrossPlatformStory;
    techmeme: StoredHeadline;
    hackernews: StoredHeadline;
  } | null {
    const story = this.db.prepare(
      'SELECT * FROM cross_platform_stories WHERE id = ?'
    ).get(storyId) as CrossPlatformStory | undefined;

    if (!story) return null;

    const techmeme = this.db.prepare(
      'SELECT * FROM headlines WHERE id = ?'
    ).get(story.techmeme_headline_id) as StoredHeadline;

    const hackernews = this.db.prepare(
      'SELECT * FROM headlines WHERE id = ?'
    ).get(story.hn_headline_id) as StoredHeadline;

    return { story, techmeme, hackernews };
  }

  // Clean up old headlines (older than X days)
  cleanupOldHeadlines(daysOld: number = 7) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    this.db.prepare('DELETE FROM headlines WHERE timestamp < ?').run(cutoffTime);
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: MergelinesDB | null = null;

export function getDB(): MergelinesDB {
  if (!dbInstance) {
    dbInstance = new MergelinesDB();
  }
  return dbInstance;
}

export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
