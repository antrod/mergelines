import fs from 'fs';
import path from 'path';
import { MergedHeadline } from './types';
import { getDB } from './db';

const HTML_PATH = path.join(process.cwd(), 'index.html');

export async function generateHTML(mergedHeadlines: MergedHeadline[]): Promise<void> {
  const topHeadlines = mergedHeadlines.slice(0, 10);
  const now = new Date();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mergelines</title>
    <link rel="alternate" type="application/rss+xml" title="Mergelines RSS Feed" href="/feed.xml">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            padding: 24px 20px;
            color: #1d1d1f;
            line-height: 1.5;
        }

        .container {
            max-width: 700px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        h1 {
            font-size: 40px;
            font-weight: 700;
            letter-spacing: -0.03em;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            font-size: 17px;
            color: #86868b;
            font-weight: 400;
            margin-bottom: 16px;
        }

        .meta {
            font-size: 13px;
            color: #86868b;
            margin-bottom: 12px;
        }

        .rss-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(0, 0, 0, 0.04);
            border-radius: 16px;
            text-decoration: none;
            color: #1d1d1f;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .rss-link:hover {
            background: rgba(0, 0, 0, 0.08);
        }

        .stories {
            display: grid;
            gap: 4px;
        }

        .story {
            background: white;
            border-radius: 0;
            padding: 20px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            transition: all 0.2s ease;
            position: relative;
        }

        .story:last-child {
            border-bottom: none;
        }

        .story::before {
            content: '';
            position: absolute;
            top: 0;
            left: -20px;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .story.featured::before {
            opacity: 1;
        }

        .story:hover {
            background: rgba(0, 0, 0, 0.01);
        }

        .story-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .story-number {
            font-size: 13px;
            font-weight: 600;
            color: #86868b;
            min-width: 24px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 10px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.01em;
            text-transform: uppercase;
        }

        .badge.featured {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .badge.hn {
            background: rgba(255, 102, 0, 0.1);
            color: #ff6600;
        }

        .badge.tm {
            background: rgba(0, 122, 255, 0.1);
            color: #007aff;
        }

        .story-title {
            font-size: 18px;
            font-weight: 600;
            line-height: 1.35;
            margin-bottom: 10px;
            color: #1d1d1f;
        }

        .story-title a {
            color: inherit;
            text-decoration: none;
            transition: color 0.15s ease;
        }

        .story-title a:hover {
            color: #667eea;
        }

        .story-summary {
            font-size: 14px;
            line-height: 1.5;
            color: #515154;
            margin-bottom: 10px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.02);
            border-radius: 8px;
            border-left: 2px solid #667eea;
        }

        .story-links {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }

        .story-link {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: rgba(0, 0, 0, 0.04);
            border-radius: 10px;
            text-decoration: none;
            color: #1d1d1f;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.15s ease;
        }

        .story-link:hover {
            background: rgba(0, 0, 0, 0.08);
        }

        .story-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 12px;
            color: #86868b;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 3px;
        }

        footer {
            text-align: center;
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            color: #86868b;
            font-size: 13px;
        }

        @media (max-width: 768px) {
            h1 {
                font-size: 32px;
            }

            .subtitle {
                font-size: 15px;
            }

            .story {
                padding: 16px 0;
            }

            .story-title {
                font-size: 16px;
            }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .story {
            animation: fadeIn 0.5s ease forwards;
        }

        ${topHeadlines.map((_, i) => `.story:nth-child(${i + 1}) { animation-delay: ${i * 0.05}s; opacity: 0; }`).join('\n        ')}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Mergelines</h1>
            <p class="subtitle">The best of Techmeme and Hacker News</p>
            <p class="meta">Updated ${now.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })}</p>
            <a href="/feed.xml" class="rss-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
                </svg>
                Subscribe to RSS
            </a>
        </header>

        <div class="stories">
${await Promise.all(topHeadlines.map(async (headline, index) => {
    const number = index + 1;
    let badgeHTML = '';
    let summaryHTML = '';
    let linksHTML = '';
    let metaHTML = '';

    if (headline.inBothSites) {
        badgeHTML = '<span class="badge featured">🔥 Both Sites</span>';

        // Get AI summary
        const db = getDB();
        const crossPlatformStories = db.getCrossPlatformStories(100);
        const matchingStory = crossPlatformStories.find(s => s.title === headline.title);
        if (matchingStory?.summary) {
            summaryHTML = `<div class="story-summary">${matchingStory.summary}</div>`;
        }

        linksHTML = `
                <div class="story-links">
                    <a href="${headline.urls[0].url}" class="story-link" target="_blank" rel="noopener">
                        <span>📰</span> Techmeme
                    </a>
                    <a href="${headline.urls[1].url}" class="story-link" target="_blank" rel="noopener">
                        <span>🗨️</span> Hacker News
                    </a>
                </div>`;

        if (headline.hackernewsData) {
            const points = headline.hackernewsData.points || 0;
            const comments = headline.hackernewsData.commentCount || 0;
            metaHTML = `
                <div class="story-meta">
                    <span class="meta-item">${points} points</span>
                    <span class="meta-item">${comments} comments</span>
                </div>`;
        }
    } else {
        const source = headline.urls[0].source;
        const url = headline.urls[0].url;

        if (source === 'Hacker News') {
            badgeHTML = '<span class="badge hn">Hacker News</span>';
            const points = headline.hackernewsData?.points || 0;
            const comments = headline.hackernewsData?.commentCount || 0;

            linksHTML = `
                <div class="story-links">
                    <a href="${url}" class="story-link" target="_blank" rel="noopener">
                        Read Discussion →
                    </a>
                </div>`;

            metaHTML = `
                <div class="story-meta">
                    <span class="meta-item">${points} points</span>
                    <span class="meta-item">${comments} comments</span>
                </div>`;
        } else {
            badgeHTML = '<span class="badge tm">Techmeme</span>';
            linksHTML = `
                <div class="story-links">
                    <a href="${url}" class="story-link" target="_blank" rel="noopener">
                        Read Article →
                    </a>
                </div>`;
        }
    }

    return `            <article class="story${headline.inBothSites ? ' featured' : ''}">
                <div class="story-header">
                    <span class="story-number">${number}</span>
                    ${badgeHTML}
                </div>
                <h2 class="story-title">
                    <a href="${headline.urls[0].url}" target="_blank" rel="noopener">${headline.title}</a>
                </h2>
                ${summaryHTML}${linksHTML}${metaHTML}
            </article>`;
}))}
        </div>

        <footer>
            <p>Mergelines aggregates the top stories from Techmeme and Hacker News</p>
            <p style="margin-top: 8px; opacity: 0.7;">Updates hourly • <a href="/feed.xml" style="color: inherit;">RSS Feed</a></p>
        </footer>
    </div>
</body>
</html>`;

  fs.writeFileSync(HTML_PATH, html, 'utf-8');
  console.log(`✓ HTML page written to ${HTML_PATH}`);
}
