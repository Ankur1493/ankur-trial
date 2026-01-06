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
      "username": urls[0],
    };

    // Run the Actor and wait for it to finish
    const run = await client.actor("VhxlqQXRwhW8H5hNV").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log({items: JSON.stringify(items, null, 2)});
    // Return the results
    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    console.error('Error fetching LinkedIn data:', error);
    return NextResponse.json({ error: 'Failed to fetch LinkedIn data', message: error.message || 'Unknown error' }, { status: 500 });
  }
}

