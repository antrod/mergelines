import { Agent } from '@mastra/core';
import { Headline } from './types';

// Create the story matching agent using Mastra's model configuration
const storyMatcherAgent = new Agent({
  name: 'story-matcher',
  instructions: `You are an expert at analyzing news headlines to determine if they refer to the same underlying story or event.

When comparing two headlines:
1. Look beyond exact wording - focus on the core topic, companies, people, or events mentioned
2. Consider that different news sources may frame the same story differently
3. Account for slight time differences - breaking news evolves quickly
4. Return "yes" if the headlines are about the same story, "no" if they are about different topics

Be generous in matching - if two headlines are about the same company announcement, product launch, or event, they should match even if the specific angle differs.`,
  model: 'openai/gpt-4o-mini',
});

export interface StoryMatchResult {
  isSameStory: boolean;
  confidence: number;
  reasoning: string;
}

export async function aiMatchStories(
  headline1: Headline,
  headline2: Headline
): Promise<StoryMatchResult> {
  try {
    const prompt = `Are these two headlines about the same story?

Headline 1: "${headline1.title}"
Source 1: ${headline1.source}

Headline 2: "${headline2.title}"
Source 2: ${headline2.source}

Respond with a JSON object in this exact format:
{
  "isSameStory": true or false,
  "confidence": a number between 0 and 1,
  "reasoning": "brief explanation"
}`;

    const result = await storyMatcherAgent.generate(prompt);

    // Parse the response
    const text = result.text.trim();

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isSameStory: parsed.isSameStory || false,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    }

    // Fallback: check if response contains "yes" or "no"
    const lowerText = text.toLowerCase();
    if (lowerText.includes('yes') || lowerText.includes('true')) {
      return {
        isSameStory: true,
        confidence: 0.7,
        reasoning: 'Response indicated match',
      };
    }

    return {
      isSameStory: false,
      confidence: 0.7,
      reasoning: 'Response indicated no match',
    };
  } catch (error) {
    console.error('AI matching error:', error);
    // Return a default "no match" on error
    return {
      isSameStory: false,
      confidence: 0,
      reasoning: 'Error during AI matching',
    };
  }
}

// Batch matching with rate limiting
export async function aiMatchStoriesBatch(
  techmemeHeadlines: Headline[],
  hnHeadlines: Headline[],
  confidenceThreshold: number = 0.6
): Promise<Map<string, string>> {
  const matches = new Map<string, string>();
  const matchedHN = new Set<string>();

  // Only check top stories to save on API calls
  // Reduced to 5×10 = max 50 API calls for faster performance
  const topTechmeme = techmemeHeadlines.slice(0, 5);
  const topHN = hnHeadlines.slice(0, 10);

  console.log(`Analyzing top ${topTechmeme.length} Techmeme × ${topHN.length} HN stories...`);

  for (const tmHeadline of topTechmeme) {
    for (const hnHeadline of topHN) {
      const hnKey = `${hnHeadline.title}-${hnHeadline.url}`;

      if (matchedHN.has(hnKey)) continue;

      const result = await aiMatchStories(tmHeadline, hnHeadline);

      if (result.isSameStory && result.confidence >= confidenceThreshold) {
        const tmKey = `${tmHeadline.title}-${tmHeadline.url}`;
        matches.set(tmKey, hnKey);
        matchedHN.add(hnKey);
        console.log(`✓ AI Match: "${tmHeadline.title.substring(0, 50)}..." = "${hnHeadline.title.substring(0, 50)}..." (confidence: ${result.confidence})`);
        break; // Found a match for this Techmeme headline
      }
    }
  }

  return matches;
}
