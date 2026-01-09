import axios from 'axios';
import * as cheerio from 'cheerio';
import { Headline } from '../types';

export async function scrapeTechmeme(): Promise<Headline[]> {
  try {
    const response = await axios.get('https://www.techmeme.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const headlines: Headline[] = [];
    const timestamp = new Date();

    // Techmeme structure: headlines are in elements with class "ii"
    // Filter out navigation links and non-article content
    $('.ii a').each((_, element) => {
      const titleLink = $(element);
      const title = titleLink.text().trim();
      const url = titleLink.attr('href') || '';

      // Skip if:
      // - Title is "Find" or other navigation text
      // - URL is an internal anchor link
      // - URL is a sponsored/ad link
      // - Title is too short (likely navigation)
      if (
        title &&
        url &&
        title !== 'Find' &&
        !url.startsWith('#') &&
        !url.includes('/r2/') && // Sponsored links
        title.length > 10 // Meaningful headlines are longer
      ) {
        headlines.push({
          title,
          url: url.startsWith('http') ? url : `https://www.techmeme.com${url}`,
          source: 'techmeme',
          timestamp,
          popularity: headlines.length // Position on page as proxy for popularity
        });
      }
    });

    return headlines;
  } catch (error) {
    console.error('Error scraping Techmeme:', error);
    return [];
  }
}
