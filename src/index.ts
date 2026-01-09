import chalk from 'chalk';
import { scrapeTechmeme } from './scrapers/techmeme';
import { scrapeHackerNews } from './scrapers/hackernews';
import { mergeAndRankHeadlines } from './merger';

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

    // Merge and rank
    const mergedHeadlines = mergeAndRankHeadlines(techmemeHeadlines, hnHeadlines);

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
    console.log(chalk.cyan(`   ${mergedHeadlines.filter(h => h.inBothSites).length} stories on both sites\n`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

main();
