import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { scrapeTechmeme } from './scrapers/techmeme';
import { scrapeHackerNews } from './scrapers/hackernews';
import { storeAndMatchHeadlines } from './persistence-merger';
import { writeRSSFeed, getRSSFeedPath } from './rss';
import { closeDB } from './db';

// Load environment variables
dotenv.config();

const TIME_WINDOW_HOURS = 12;

async function main() {
  console.log(chalk.bold.cyan('\n🔄 Mergelines - Tech News Aggregator\n'));
  console.log(chalk.gray('Fetching headlines from Techmeme and Hacker News...\n'));

  try {
    // Fetch headlines in parallel
    const [techmemeHeadlines, hnHeadlines] = await Promise.all([
      scrapeTechmeme(),
      scrapeHackerNews()
    ]);

    console.log(chalk.green(`✓ Fetched ${techmemeHeadlines.length} headlines from Techmeme`));
    console.log(chalk.green(`✓ Fetched ${hnHeadlines.length} headlines from Hacker News\n`));

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
      TIME_WINDOW_HOURS
    );

    console.log(chalk.green(`✓ Stored ${stored.techmeme} Techmeme + ${stored.hackernews} HN headlines`));
    if (newMatches > 0) {
      console.log(chalk.bold.green(`🎉 Found ${newMatches} new cross-platform ${newMatches === 1 ? 'story' : 'stories'}!\n`));
    } else {
      console.log(chalk.gray(`No new cross-platform stories found.\n`));
    }

    // Generate RSS feed (always, with top 10 stories)
    console.log(chalk.cyan('📡 Generating RSS feed with top 10 stories...'));
    await writeRSSFeed(mergedHeadlines);
    console.log(chalk.green(`✓ RSS feed available at: ${getRSSFeedPath()}\n`));

    console.log(chalk.bold.yellow('📰 Top Headlines:\n'));
    console.log(chalk.gray('─'.repeat(80)) + '\n');

    // Display results
    mergedHeadlines.forEach((headline, index) => {
      const rank = index + 1;
      const badge = headline.inBothSites
        ? chalk.bold.red('🔥 BOTH')
        : chalk.gray(`[${headline.urls[0].source}]`);

      console.log(chalk.bold(`${rank}. ${badge}`));
      console.log(chalk.white(`   ${headline.title}`));

      // Show sources
      headline.urls.forEach(urlInfo => {
        const sourceColor = urlInfo.source === 'Techmeme' ? chalk.blue : chalk.yellow;
        console.log(sourceColor(`   ${urlInfo.source}: ${urlInfo.url}`));
      });

      // Show metrics
      const metrics: string[] = [];
      if (headline.hackernewsData?.points) {
        metrics.push(chalk.yellow(`${headline.hackernewsData.points} pts`));
      }
      if (headline.hackernewsData?.commentCount) {
        metrics.push(chalk.gray(`${headline.hackernewsData.commentCount} comments`));
      }
      if (metrics.length > 0) {
        console.log(`   ${metrics.join(' • ')}`);
      }

      console.log(chalk.gray(`   ${headline.timestamp.toLocaleString()}`));
      console.log('');
    });

    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.cyan(`\n✨ Total: ${mergedHeadlines.length} headlines`));
    console.log(chalk.cyan(`   ${mergedHeadlines.filter(h => h.inBothSites).length} stories on both sites`));
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
