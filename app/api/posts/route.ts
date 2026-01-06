import { ApifyClient } from 'apify-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlsParam = searchParams.get('urls');
    const scrapeUntilDate = searchParams.get('scrapeUntil'); // How far back in the past to scrape

    if (!urlsParam) {
      return NextResponse.json(
        { error: 'URLs are required' },
        { status: 400 }
      );
    }

    // Parse URLs from query param
    const urls = urlsParam.split(',').map(url => url.trim()).filter(url => url.length > 0);

    // Initialize the ApifyClient with API token
    const client = new ApifyClient({
      token: process.env.APIFY_TOKEN || '<YOUR_API_TOKEN>',
    });

    // Prepare Actor input for LinkedIn Posts Scraper
    const input: Record<string, unknown> = {
      urls: urls,
      limitPerSource: 100, // Fetch past 100 posts
      deepScrape: false, // Keep deepScrape off by default
      rawData: false,
    };

    // Only add scrapeUntil if date is provided (how far back in the past to go)
    if (scrapeUntilDate) {
      input.scrapeUntil = scrapeUntilDate;
    }

    // Run the LinkedIn Posts Scraper Actor
    const run = await client.actor("Wpp1BZ6yGWjySadk3").call(input);

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log({ postsCount: JSON.stringify(items, null, 2) });
    
    // Return the results
    return NextResponse.json({ success: true, data: items });
  } catch (error: unknown) {
    console.error('Error fetching LinkedIn posts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn posts', message: errorMessage },
      { status: 500 }
    );
  }
}

