# Mergelines

A TypeScript-based news aggregator that fetches and ranks headlines from Techmeme and Hacker News, featuring persistent storage, AI-generated summaries, and an RSS feed for stories that appear on both platforms.

## Features

- **Persistent Storage**: SQLite database tracks headlines with 12-hour matching window
- **AI Summaries**: OpenAI-powered summaries for cross-platform stories
- **RSS Feed**: Auto-generated feed with summaries and links to both sources
- **Beautiful HTML**: Minimalist reading interface inspired by editorial blogs
- **Smart Matching**: Levenshtein distance, word overlap, and domain matching
- **Deduplication**: Filters similar Techmeme stories for diversity
- **Interleaved Display**: Balanced mix of HN and Techmeme stories

## Installation

```bash
npm install
```

## Setup

### Configure OpenAI API (Required for Summaries)

Create a `.env` file:

```bash
cp .env.example .env
```

Then add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-api-key-here
```

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys).

**Note**: The app works without an API key but won't generate summaries for cross-platform stories.

## Usage

### Development Mode

```bash
npm run dev
```

### Build and Run

```bash
npm run build
npm start
```

## How It Works

### 1. Scraping
Fetches the latest headlines from:
- **Techmeme**: Web scraping with Cheerio (filters ads and navigation)
- **Hacker News**: Official Firebase API (top 30 stories with points/comments)

### 2. Persistence & Matching
- Stores all headlines in SQLite with timestamps
- Finds matches within 12-hour window using:
  - Domain matching (same source URL)
  - Levenshtein similarity (45% threshold)
  - Word overlap with stop-word filtering (35% threshold)
- Deduplicates similar Techmeme stories (50% threshold)

### 3. AI Summaries
For stories appearing on both platforms:
- Generates 2-3 sentence summaries using GPT-4o-mini
- Stored in database with cross-platform match records

### 4. Output Generation
- **RSS Feed**: Top 10 stories with AI summaries and dual links
- **HTML Page**: Minimal editorial design with clickable headlines
- **CLI Display**: Color-coded output with full metrics

### 5. Ranking & Display
- Cross-platform stories (🔥) appear first
- Remaining slots alternate between HN and Techmeme
- HN sorted by points, Techmeme deduplicated for diversity
- Limited to 10 stories total

## Output

### RSS Feed (`feed.xml`)
- Cross-platform stories with AI summaries
- Links to both Techmeme and HN discussions
- HN points and comment counts
- Updates automatically every hour via GitHub Actions

### HTML Page (`index.html`)
- Minimalist serif typography (Georgia)
- Click headlines → original articles
- Click comments → HN discussion
- Responsive design, 650px max width

### CLI Display
- 🔥 **BOTH** badge for cross-platform stories
- Source badges (Techmeme/Hacker News)
- Complete URLs and metrics
- Timestamps and match counts

## Dependencies

### Core
- **openai**: Direct OpenAI API integration for summaries
- **better-sqlite3**: Fast SQLite database
- **rss**: RSS feed generation
- **axios**: HTTP client for web scraping
- **cheerio**: HTML parsing for Techmeme
- **dotenv**: Environment variable management

### UI
- **chalk**: Terminal styling and colors
- **TypeScript**: Type-safe development

## Project Structure

```
mergelines/
├── src/
│   ├── index.ts              # Main CLI entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── db.ts                 # SQLite database layer
│   ├── persistence-merger.ts # 12-hour window matching logic
│   ├── rss.ts                # RSS feed + AI summary generation
│   ├── html-generator.ts     # Minimal HTML page generator
│   └── scrapers/
│       ├── techmeme.ts       # Techmeme web scraper
│       └── hackernews.ts     # Hacker News API client
├── .github/workflows/
│   └── update-feed.yml       # Hourly scraper + deployment
├── dist/                     # Compiled JavaScript output
├── mergelines.db             # SQLite database (gitignored)
├── feed.xml                  # Generated RSS feed
├── index.html                # Generated HTML page
├── .env                      # API keys (gitignored)
└── package.json
```

## Deployment

The project includes GitHub Actions for free deployment:

1. **Hourly Updates**: Runs scraper every hour
2. **GitHub Pages**: Serves RSS feed and HTML at `https://<username>.github.io/mergelines/`

Setup:
1. Add `OPENAI_API_KEY` to GitHub Secrets
2. Enable GitHub Pages (Source: GitHub Actions)
3. Feed will be live at `https://<username>.github.io/mergelines/feed.xml`

## License

ISC
