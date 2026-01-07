import { ApifyClient } from 'apify-client';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { Post, PostsDataFile, UserMetadata, extractUsername, getPostAuthor, getPostTimestamp } from '@/lib/types';

// Helper to get unique post identifier
function getPostId(post: Post): string {
  return post.urn || post.postUrl || post.url || JSON.stringify(post);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlsParam = searchParams.get('urls');
    // scrapeUntil = START date (fetches all posts FROM this date TO today, no end date)
    // Example: scrapeUntil="2022-02-01" fetches all posts from Feb 2022 to present
    const scrapeUntilDate = searchParams.get('scrapeUntil');

    if (!urlsParam) {
      return NextResponse.json(
        { error: 'URLs are required' },
        { status: 400 }
      );
    }

    // Parse URLs from query param
    const urls = urlsParam.split(',').map(url => url.trim()).filter(url => url.length > 0);
    const requestedUsernames = urls.map(extractUsername);

    // Initialize the ApifyClient with API token
    const client = new ApifyClient({
      token: process.env.APIFY_TOKEN || '<YOUR_API_TOKEN>',
    });

    // Setup data directory and file path
    const dataDir = path.join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });
    const postsFilePath = path.join(dataDir, 'posts_data.json');

    // Read existing data from file (with new structure)
    let postsData: PostsDataFile = { metadata: {}, posts: [] };
    try {
      const fileContent = await readFile(postsFilePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      // Handle migration from old format (array) to new format (object with metadata)
      if (Array.isArray(parsed)) {
        // Old format: just an array of posts
        postsData = { metadata: {}, posts: parsed };
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        // New format
        postsData = parsed;
      }
    } catch {
      postsData = { metadata: {}, posts: [] };
    }

    const { metadata, posts: existingPosts } = postsData;

    // Filter existing posts for the requested user(s)
    const userExistingPosts = existingPosts.filter(post => {
      const postUsername = getPostAuthor(post);
      return requestedUsernames.includes(postUsername);
    });

    // Find date range of existing posts for this user
    let oldestExistingDate: number | null = null;
    let newestExistingDate: number | null = null;
    
    if (userExistingPosts.length > 0) {
      const timestamps = userExistingPosts
        .map(getPostTimestamp)
        .filter(ts => ts > 0);
      
      if (timestamps.length > 0) {
        oldestExistingDate = Math.min(...timestamps);
        newestExistingDate = Math.max(...timestamps);
      }
    }

    // Get user metadata (for the first requested user - primary user)
    const primaryUsername = requestedUsernames[0];
    const userMetadata = metadata[primaryUsername];
    const lastFetchTimestamp = userMetadata?.lastFetchDate 
      ? new Date(userMetadata.lastFetchDate).getTime() 
      : null;

    // Determine what to fetch
    const requestedUntilTimestamp = scrapeUntilDate 
      ? new Date(scrapeUntilDate).getTime() 
      : null;
    
    const today = new Date();
    const todayTimestamp = today.getTime();
    const todayDateStr = today.toISOString().split('T')[0];
    
    let fetchOlderPosts = false;
    let fetchNewerPosts = false;
    let effectiveScrapeUntil: string | null = scrapeUntilDate || null;
    
    // Check if lastFetchDate is TODAY - if so, we already checked today, return cached data
    const lastFetchDateStr = userMetadata?.lastFetchDate;
    const fetchedToday = lastFetchDateStr === todayDateStr;

    // Check if we need more posts (when no scrapeUntil, we should have 100 posts)
    const needMorePosts = !scrapeUntilDate && userExistingPosts.length < 100;

    if (userExistingPosts.length === 0) {
      // No existing posts - fetch everything requested
      console.log('No existing posts for user, fetching all...');
    } else if (fetchedToday) {
      // Already fetched today - but check if we still need to fetch
      console.log(`Already fetched posts today (${todayDateStr}), checking if additional fetch needed...`);
      
      // Check if user wants older posts than what we have
      if (requestedUntilTimestamp && oldestExistingDate && requestedUntilTimestamp < oldestExistingDate) {
        fetchOlderPosts = true;
        console.log(`But user wants older posts: requested ${scrapeUntilDate}, oldest we have is ${new Date(oldestExistingDate).toISOString().split('T')[0]}`);
      }
      
      // Check if we need more posts (when no scrapeUntil provided, should have 100)
      if (!fetchOlderPosts && needMorePosts) {
        fetchNewerPosts = true; // Fetch more posts to reach 100
        console.log(`Only have ${userExistingPosts.length} posts, need to fetch more to reach 100`);
      }
      
      // If requesting a specific date, check if that date is actually covered
      if (!fetchOlderPosts && !fetchNewerPosts && requestedUntilTimestamp && oldestExistingDate) {
        // If requested date is earlier than oldest cached post, we need to fetch older posts
        if (requestedUntilTimestamp < oldestExistingDate) {
          fetchOlderPosts = true;
          console.log(`Requested date ${scrapeUntilDate} is earlier than cached oldest date ${new Date(oldestExistingDate).toISOString().split('T')[0]}, need to fetch older posts`);
        }
      }
    } else {
      // Haven't fetched today - check what we need to fetch
      
      // Check if we need to fetch older posts
      if (requestedUntilTimestamp && oldestExistingDate && requestedUntilTimestamp < oldestExistingDate) {
        fetchOlderPosts = true;
        console.log(`Need older posts: requested ${scrapeUntilDate}, oldest we have is ${new Date(oldestExistingDate).toISOString().split('T')[0]}`);
      }

      // Check if we need more posts (when no scrapeUntil provided, should have 100)
      if (!fetchOlderPosts && needMorePosts) {
        fetchNewerPosts = true;
        console.log(`Only have ${userExistingPosts.length} posts, need to fetch more to reach 100`);
      }

      // Check if we need to fetch newer posts based on LAST FETCH DATE
      if (!fetchNewerPosts && lastFetchTimestamp) {
        const timeSinceLastFetch = todayTimestamp - lastFetchTimestamp;
        if (timeSinceLastFetch > 24 * 60 * 60 * 1000) { // More than 1 day since last fetch
          fetchNewerPosts = true;
          console.log(`Last fetch was ${lastFetchDateStr}, checking for newer posts...`);
        }
      } else if (!fetchNewerPosts && newestExistingDate) {
        // No lastFetchDate in metadata, fall back to newest post date
        const timeSinceNewestPost = todayTimestamp - newestExistingDate;
        if (timeSinceNewestPost > 24 * 60 * 60 * 1000) {
          fetchNewerPosts = true;
          console.log(`No lastFetchDate, checking for posts since ${new Date(newestExistingDate).toISOString().split('T')[0]}`);
        }
      }

      // If requested date range is already covered and no newer posts check needed, return cached
      if (!fetchOlderPosts && !fetchNewerPosts && requestedUntilTimestamp && oldestExistingDate) {
        if (requestedUntilTimestamp >= oldestExistingDate) {
          console.log(`Already have posts from ${new Date(oldestExistingDate).toISOString().split('T')[0]} to present, returning cached data`);
          // Don't set fetchNewerPosts - just return cached data
        }
      }
    }
    
    // If nothing to fetch, return cached data immediately
    if (userExistingPosts.length > 0 && !fetchOlderPosts && !fetchNewerPosts) {
      // Filter posts by the requested scrapeUntil date (posts FROM that date onwards)
      let filteredPosts = userExistingPosts;
      if (requestedUntilTimestamp) {
        filteredPosts = userExistingPosts.filter(post => {
          const postTimestamp = getPostTimestamp(post);
          return postTimestamp >= requestedUntilTimestamp;
        });
      }
      
      console.log(`Returning ${filteredPosts.length} cached posts for ${requestedUsernames.join(', ')} (filtered from ${userExistingPosts.length} total)`);
      
      return NextResponse.json({ 
        success: true, 
        data: filteredPosts,
        savedTo: 'data/posts_data.json',
        cached: true,
        stats: {
          totalPostsInFile: existingPosts.length,
          userPostsCount: filteredPosts.length,
          totalCachedForUser: userExistingPosts.length,
          newPostsFetched: 0,
          actualNewPosts: 0,
          existingPostsForUser: userExistingPosts.length,
          oldestPostDate: oldestExistingDate ? new Date(oldestExistingDate).toISOString() : null,
          newestPostDate: newestExistingDate ? new Date(newestExistingDate).toISOString() : null,
          lastFetchDate: lastFetchDateStr || null,
          fetchedOlderPosts: false,
          fetchedNewerPosts: false,
          scrapeUntilUsed: scrapeUntilDate || null,
          filteredFrom: scrapeUntilDate || null
        },
        userMetadata: userMetadata || null,
        message: fetchedToday 
          ? `Already fetched today, returning ${filteredPosts.length} cached posts${scrapeUntilDate ? ` from ${scrapeUntilDate}` : ''}`
          : `Posts already cached, returning ${filteredPosts.length} posts${scrapeUntilDate ? ` from ${scrapeUntilDate}` : ''}`
      });
    }

    // Prepare Actor input for LinkedIn Posts Scraper
    const input: Record<string, unknown> = {
      urls: urls,
      limitPerSource: 100,
      deepScrape: false,
      rawData: false,
    };

    // Smart scrapeUntil logic (remember: scrapeUntil is START date, fetches from that date to TODAY)
    if (fetchOlderPosts && effectiveScrapeUntil) {
      // User wants older posts than we have - use their requested start date
      // This fetches from user's date to today (will include duplicates, we dedupe later)
      input.scrapeUntil = effectiveScrapeUntil;
    } else if (fetchNewerPosts && !fetchOlderPosts) {
      // Fetching newer posts or more posts to reach 100
      if (effectiveScrapeUntil) {
        // If user provided a date, use it
        input.scrapeUntil = effectiveScrapeUntil;
      } else if (lastFetchTimestamp) {
        // Only checking for newer posts - use LAST FETCH DATE (not newest post date)
        // This is more efficient: if we fetched on Jan 6 and today is Jan 10, only fetch Jan 6 → today
        const startFromDate = new Date(lastFetchTimestamp);
        startFromDate.setDate(startFromDate.getDate() - 1); // 1 day overlap for safety
        input.scrapeUntil = startFromDate.toISOString().split('T')[0];
        console.log(`Using lastFetchDate: fetching from ${input.scrapeUntil}`);
      } else if (newestExistingDate) {
        // Fallback to newest post date if no lastFetchDate
        const startFromDate = new Date(newestExistingDate);
        startFromDate.setDate(startFromDate.getDate() - 1);
        input.scrapeUntil = startFromDate.toISOString().split('T')[0];
        console.log(`Fallback to newestPostDate: fetching from ${input.scrapeUntil}`);
      }
      // If no scrapeUntil set and no existing posts, actor will use its default behavior (fetch recent posts)
    } else if (effectiveScrapeUntil) {
      // Default: use user's requested start date
      input.scrapeUntil = effectiveScrapeUntil;
    }
    // If no scrapeUntil set, actor will use its default behavior

    console.log('Fetching posts with scrapeUntil:', input.scrapeUntil || 'not set');

    // Run the LinkedIn Posts Scraper Actor
    const run = await client.actor("Wpp1BZ6yGWjySadk3").call(input);

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const newPosts = items as Post[];

    console.log({ fetchedPostsCount: newPosts.length });

    // Deduplicate: merge existing + new posts, removing duplicates by post ID
    const postMap = new Map<string, Post>();
    
    // Add existing posts first
    for (const post of existingPosts) {
      const id = getPostId(post);
      postMap.set(id, post);
    }
    
    // Add/update with new posts
    let actualNewCount = 0;
    for (const post of newPosts) {
      const id = getPostId(post);
      if (!postMap.has(id)) {
        actualNewCount++;
      }
      postMap.set(id, post);
    }

    // Convert back to array and sort by date (newest first)
    const combinedPosts = Array.from(postMap.values()).sort((a, b) => {
      return getPostTimestamp(b) - getPostTimestamp(a);
    });

    // Update metadata for each requested user
    const updatedMetadata = { ...metadata };
    for (const username of requestedUsernames) {
      const userPosts = combinedPosts.filter(p => getPostAuthor(p) === username);
      const userTimestamps = userPosts.map(getPostTimestamp).filter(ts => ts > 0);
      
      updatedMetadata[username] = {
        lastFetchDate: todayDateStr,
        oldestPostDate: userTimestamps.length > 0 
          ? new Date(Math.min(...userTimestamps)).toISOString().split('T')[0] 
          : null,
        newestPostDate: userTimestamps.length > 0 
          ? new Date(Math.max(...userTimestamps)).toISOString().split('T')[0] 
          : null,
        postCount: userPosts.length
      };
    }

    // Save to file with updated structure
    const dataToSave: PostsDataFile = {
      metadata: updatedMetadata,
      posts: combinedPosts
    };
    
    await writeFile(postsFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log(`Posts data saved to: ${postsFilePath} (Total: ${combinedPosts.length} posts, ${actualNewCount} new)`);

    // Get posts for requested user to return
    let userPosts = combinedPosts.filter(post => {
      const postUsername = getPostAuthor(post);
      return requestedUsernames.includes(postUsername);
    });
    
    // Filter by scrapeUntil date if provided (posts FROM that date onwards)
    if (requestedUntilTimestamp) {
      userPosts = userPosts.filter(post => {
        const postTimestamp = getPostTimestamp(post);
        return postTimestamp >= requestedUntilTimestamp;
      });
    }

    // Count total user posts before filtering (for stats)
    const totalUserPosts = combinedPosts.filter(post => {
      const postUsername = getPostAuthor(post);
      return requestedUsernames.includes(postUsername);
    }).length;

    // Return the results
    return NextResponse.json({ 
      success: true, 
      data: userPosts,
      savedTo: 'data/posts_data.json',
      stats: {
        totalPostsInFile: combinedPosts.length,
        userPostsCount: userPosts.length,
        totalUserPostsCached: totalUserPosts,
        newPostsFetched: newPosts.length,
        actualNewPosts: actualNewCount,
        existingPostsForUser: userExistingPosts.length,
        oldestPostDate: oldestExistingDate ? new Date(oldestExistingDate).toISOString() : null,
        newestPostDate: newestExistingDate ? new Date(newestExistingDate).toISOString() : null,
        lastFetchDate: userMetadata?.lastFetchDate || null,
        newLastFetchDate: todayDateStr,
        fetchedOlderPosts: fetchOlderPosts,
        fetchedNewerPosts: fetchNewerPosts,
        scrapeUntilUsed: input.scrapeUntil || null,
        filteredFrom: scrapeUntilDate || null
      },
      userMetadata: updatedMetadata[primaryUsername]
    });
  } catch (error: unknown) {
    console.error('Error fetching LinkedIn posts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn posts', message: errorMessage },
      { status: 500 }
    );
  }
}
