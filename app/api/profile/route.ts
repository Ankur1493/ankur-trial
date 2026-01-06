import { ApifyClient } from 'apify-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlsParam = searchParams.get('urls');

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

    // Prepare Actor input
    const input = {
      includeEmail: false,
      usernames: urls,
    };

    // Run the Actor and wait for it to finish, can look at this
    const run = await client.actor("5fajYOBUfeb6fgKlB").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Return the results
    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('Error fetching LinkedIn data:', error);
    return NextResponse.json({ error: 'Failed to fetch LinkedIn data', message: error.message || 'Unknown error' }, { status: 500 });
  }
}

