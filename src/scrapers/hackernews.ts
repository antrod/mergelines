import axios from 'axios';
import { Headline } from '../types';

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  time: number;
  descendants?: number;
}

export async function scrapeHackerNews(): Promise<Headline[]> {
  try {
    // Get top stories from HN API
    const topStoriesResponse = await axios.get<number[]>(
      'https://hacker-news.firebaseio.com/v0/topstories.json'
    );

    const topStoryIds = topStoriesResponse.data.slice(0, 30); // Get top 30 stories
    const headlines: Headline[] = [];

    // Fetch details for each story
    const storyPromises = topStoryIds.map(id =>
      axios.get<HNItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    );

    const storyResponses = await Promise.all(storyPromises);

    for (const response of storyResponses) {
      const story = response.data;

      if (story && story.title) {
        headlines.push({
          title: story.title,
          url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          source: 'hackernews',
          timestamp: new Date(story.time * 1000),
          popularity: story.score,
          points: story.score,
          commentCount: story.descendants || 0
        });
      }
    }

    return headlines;
  } catch (error) {
    console.error('Error scraping Hacker News:', error);
    return [];
  }
}
