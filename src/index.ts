import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { scrapeTechmeme } from './scrapers/techmeme';
import { scrapeHackerNews } from './scrapers/hackernews';
import { scrape9to5Mac } from './scrapers/9to5mac';
import { storeAndMatchHeadlines } from './persistence-merger';
import { writeRSSFeed, getRSSFeedPath } from './rss';
import { generateHTML } from './html-generator';
import { closeDB } from './db';

// Load environment variables
dotenv.config();

const TIME_WINDOW_HOURS = 12;

async function main() {
  console.log(chalk.bold.cyan('\n🔄 Mergelines - Tech News Aggregator\n'));
  console.log(chalk.gray('Fetching headlines from Techmeme, Hacker News, and 9to5Mac...\n'));

  try {
    // Fetch headlines in parallel
    const [techmemeHeadlines, hnHeadlines, nineToFiveMacHeadlines] = await Promise.all([
      scrapeTechmeme(),
      scrapeHackerNews(),
      scrape9to5Mac()
    ]);

    console.log(chalk.green(`✓ Fetched ${techmemeHeadlines.length} headlines from Techmeme`));
    console.log(chalk.green(`✓ Fetched ${hnHeadlines.length} headlines from Hacker News`));
    console.log(chalk.green(`✓ Fetched ${nineToFiveMacHeadlines.length} headlines from 9to5Mac\n`));

    // Check if OpenAI API key is available
    const useAI = !!process.env.OPENAI_API_KEY;

    if (!useAI) {
      console.log(chalk.yellow('⚠️  No OpenAI API key found. Summaries will be basic.'));
      console.log(chalk.yellow('   Set OPENAI_API_KEY in .env for AI-generated summaries.\n'));
    }

    // Store headlines and find matches within 12-hour window
    console.log(chalk.cyan(`🕐 Using ${TIME_WINDOW_HOURS}-hour time window for matching...`));
    const { stored, newMatches, allMerged: mergedHeadlines } = await storeAndMatchHeadlines(
      techmemeHeadlines,
      hnHeadlines,
      nineToFiveMacHeadlines,
      TIME_WINDOW_HOURS
    );

    console.log(chalk.green(`✓ Stored ${stored.techmeme} Techmeme + ${stored.hackernews} HN + ${stored.nineToFiveMac} 9to5Mac headlines`));
    if (newMatches > 0) {
      console.log(chalk.bold.green(`🎉 Found ${newMatches} new cross-source ${newMatches === 1 ? 'story' : 'stories'}!\n`));
    } else {
      console.log(chalk.gray(`No new cross-source stories found.\n`));
    }

    // Generate RSS feed and HTML page (always, with top 10 stories)
    console.log(chalk.cyan('📡 Generating RSS feed with top 10 stories...'));
    await writeRSSFeed(mergedHeadlines);
    console.log(chalk.green(`✓ RSS feed available at: ${getRSSFeedPath()}`));

    console.log(chalk.cyan('🎨 Generating HTML page...'));
    await generateHTML(mergedHeadlines);
    console.log(chalk.green(`✓ HTML page generated\n`));

    console.log(chalk.bold.yellow('📰 Top Headlines:\n'));
    console.log(chalk.gray('─'.repeat(80)) + '\n');

    // Display results
    mergedHeadlines.forEach((headline, index) => {
      const rank = index + 1;
      const badge = headline.inBothSites
        ? chalk.bold.red(`🔥 ${headline.urls.length} SOURCES`)
        : chalk.gray(`[${headline.urls[0].source}]`);

      console.log(chalk.bold(`${rank}. ${badge}`));
      console.log(chalk.white(`   ${headline.title}`));

      // Show sources
      headline.urls.forEach(urlInfo => {
        let sourceColor = chalk.gray;
        if (urlInfo.source === 'Techmeme') sourceColor = chalk.blue;
        else if (urlInfo.source === 'Hacker News') sourceColor = chalk.yellow;
        else if (urlInfo.source === '9to5Mac') sourceColor = chalk.magenta;

        console.log(sourceColor(`   ${urlInfo.source}: ${urlInfo.url}`));
      });

      // Show metrics
      const metrics: string[] = [];
      if (headline.hackernewsData?.points) {
        metrics.push(chalk.yellow(`${headline.hackernewsData.points} pts`));
      }
      if (headline.hackernewsData?.commentCount) {
        metrics.push(chalk.gray(`HN: ${headline.hackernewsData.commentCount} comments`));
      }
      if (headline.nineToFiveMacData?.commentCount) {
        metrics.push(chalk.magenta(`9to5Mac: ${headline.nineToFiveMacData.commentCount} comments`));
      }
      if (metrics.length > 0) {
        console.log(`   ${metrics.join(' • ')}`);
      }

      console.log(chalk.gray(`   ${headline.timestamp.toLocaleString()}`));
      console.log('');
    });

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.cyan(`\n✨ Total: ${mergedHeadlines.length} headlines`));
    console.log(chalk.cyan(`   ${mergedHeadlines.filter(h => h.inBothSites).length} stories in 2+ sources`));
    console.log(chalk.gray(`   (within ${TIME_WINDOW_HOURS}-hour window)\n`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    closeDB();
    process.exit(1);
  } finally {
    closeDB();
  }
}

main();
