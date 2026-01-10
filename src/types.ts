export interface Headline {
  title: string;
  url: string;
  source: 'techmeme' | 'hackernews';
  timestamp: Date;
  popularity?: number;
  points?: number;
  commentCount?: number;
  hnDiscussionUrl?: string; // HN discussion URL, only for HN stories
}

export interface MergedHeadline {
  title: string;
  urls: { source: string; url: string }[];
  inBothSites: boolean;
  timestamp: Date;
  popularity: number;
  techmemeData?: Headline;
  hackernewsData?: Headline;
}
