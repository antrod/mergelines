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

    // Techmeme structure: main stories are in divs with class "item" or similar
    // Main headlines are typically in elements with class "ii"
    $('.ii').each((_, element) => {
      const titleLink = $(element).find('a.ii_a').first();
      const title = titleLink.text().trim();
      const url = titleLink.attr('href') || '';

      if (title && url) {
        headlines.push({
          title,
          url: url.startsWith('http') ? url : `https://www.techmeme.com${url}`,
          source: 'techmeme',
          timestamp,
          popularity: headlines.length // Position on page as proxy for popularity
        });
      }
    });

    // Also get cluster headlines
    $('.ii2').each((_, element) => {
      const titleLink = $(element).find('a').first();
      const title = titleLink.text().trim();
      const url = titleLink.attr('href') || '';

      if (title && url) {
        headlines.push({
          title,
          url: url.startsWith('http') ? url : `https://www.techmeme.com${url}`,
          source: 'techmeme',
          timestamp,
          popularity: headlines.length
        });
      }
    });

    return headlines;
  } catch (error) {
    console.error('Error scraping Techmeme:', error);
    return [];
  }
}
