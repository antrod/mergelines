import axios from 'axios';
import * as cheerio from 'cheerio';
import { Headline } from '../types';

export async function scrape9to5Mac(): Promise<Headline[]> {
  try {
    const response = await axios.get('https://9to5mac.com/feed/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const headlines: Headline[] = [];

    // Parse RSS feed items
    $('item').each((index, element) => {
      const item = $(element);

      const title = item.find('title').text().trim();
      const link = item.find('link').text().trim();
      const pubDate = item.find('pubDate').text().trim();
      const creator = item.find('dc\\:creator, creator').text().trim();
      const commentCount = parseInt(item.find('slash\\:comments').text().trim() || '0', 10);

      // Filter out promoted/sponsored posts
      if (creator.toLowerCase().includes('sponsored')) {
        return; // Skip this item
      }

      // Skip if missing essential data
      if (!title || !link) {
        return;
      }

      headlines.push({
        title,
        url: link,
        source: '9to5mac',
        timestamp: new Date(pubDate),
        popularity: commentCount, // Use comment count as popularity
        commentCount,
      });
    });

    return headlines;
  } catch (error) {
    console.error('Error scraping 9to5Mac:', error);
    return [];
  }
}
