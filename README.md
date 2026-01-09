# Mergelines

A TypeScript-based news aggregator that fetches and ranks headlines from Techmeme and Hacker News, highlighting stories that appear on both platforms using AI-powered semantic matching.

## Features

- **AI-Powered Story Matching**: Uses Mastra and OpenAI to understand if stories are about the same topic, even with different headlines
- **Fallback String Matching**: Automatically falls back to Levenshtein distance and word overlap when AI is unavailable
- **Parallel Scraping**: Fetches headlines from both sources simultaneously
- **Smart Filtering**: Removes navigation links, ads, and duplicate entries
- **Intelligent Ranking**: Prioritizes cross-platform stories, then by popularity
- **Beautiful CLI**: Color-coded output with metrics and timestamps
- **Time Window**: 24-hour matching window for breaking news

## Installation

```bash
npm install
```

## Setup

### 1. Configure OpenAI API (Optional but Recommended)

For AI-powered story matching, create a `.env` file:

```bash
cp .env.example .env
```

Then add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-api-key-here
```

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys).

**Note**: The app works without an API key using string-based matching, but AI matching provides significantly better results.

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
- **Hacker News**: Official Firebase API (top 30 stories)

### 2. AI-Powered Matching (with API key)
Uses Mastra agents with GPT-4o-mini to:
- Understand semantic similarity between headlines
- Identify same stories with different framing
- Account for different editorial angles
- Match top 15 Techmeme × top 20 HN stories

### 3. String-Based Matching (fallback)
Uses multiple signals:
- Domain matching (same source URL)
- Levenshtein similarity (45% threshold)
- Word overlap with stop-word filtering (35% threshold)
- 24-hour time window

### 4. Ranking
- Stories on both sites appear first (🔥 BOTH)
- Then sorted by combined popularity score
- HN points + Techmeme position

## Output

The CLI displays:
- 🔥 **BOTH** badge for cross-platform stories
- Source indicator for single-platform stories
- Complete URLs for each source
- Hacker News metrics (points, comments)
- Timestamps
- Match type indicator (AI vs String matching)

## Dependencies

### Core
- **@mastra/core**: AI agent framework for story matching
- **@ai-sdk/openai**: OpenAI integration
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
│   ├── index.ts           # Main CLI entry point
│   ├── types.ts           # TypeScript interfaces
│   ├── ai-matcher.ts      # Mastra AI agent for story matching
│   ├── merger.ts          # Ranking and merging logic (AI + string)
│   └── scrapers/
│       ├── techmeme.ts    # Techmeme web scraper
│       └── hackernews.ts  # Hacker News API client
├── dist/                  # Compiled JavaScript output
├── .env                   # API keys (gitignored)
├── .env.example           # Example environment file
├── package.json
└── tsconfig.json
```

## About Mastra

This project uses [Mastra](https://mastra.ai/), an open-source TypeScript framework for building AI agents, developed by the team behind Gatsby. Mastra enables:

- **Semantic Understanding**: AI agents that understand context and meaning
- **Intelligent Matching**: Beyond simple string comparison
- **Graceful Degradation**: Falls back to algorithms when AI unavailable
- **Type Safety**: Full TypeScript support

## License

ISC
