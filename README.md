# Mergelines

A TypeScript-based news aggregator that fetches and ranks headlines from Techmeme and Hacker News, highlighting stories that appear on both platforms.

## Features

- Fetches headlines from Techmeme and Hacker News in parallel
- Intelligent story matching using title similarity algorithms
- Ranks stories with priority given to those appearing on both sites within a 4-hour window
- Beautiful CLI output with colored formatting
- Shows popularity metrics (points, comments) from Hacker News

## Installation

```bash
npm install
```

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

1. **Scraping**: Fetches the latest headlines from both Techmeme and Hacker News
2. **Matching**: Uses Levenshtein distance and word overlap to identify the same story across platforms
3. **Time Window**: Only matches stories that appeared within 4 hours of each other
4. **Ranking**: Prioritizes stories that appear on both sites, then sorts by popularity

## Output

The CLI displays:
- 🔥 Stories that appear on both sites (highlighted)
- Source URLs for each story
- Hacker News metrics (points, comments)
- Timestamps for each headline

## Dependencies

- **axios**: HTTP client for fetching web pages
- **cheerio**: HTML parsing for Techmeme
- **chalk**: Terminal styling for beautiful output
- **TypeScript**: Type-safe development

## Project Structure

```
mergelines/
├── src/
│   ├── index.ts           # Main CLI entry point
│   ├── types.ts           # TypeScript interfaces
│   ├── merger.ts          # Ranking and merging logic
│   └── scrapers/
│       ├── techmeme.ts    # Techmeme scraper
│       └── hackernews.ts  # Hacker News API client
├── dist/                  # Compiled JavaScript output
├── package.json
└── tsconfig.json
```

## License

ISC
