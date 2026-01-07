import { ApifyClient } from 'apify-client';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { Post, PostsDataFile, UserMetadata, extractUsername, getPostAuthor, getPostTimestamp, getPostDate } from '@/lib/types';

// Helper to get unique post identifier
function getPostId(post: Post): string {
  // Try to get a unique identifier from the post
  if (post.urn) {
    // If urn is an object, extract the activity_urn or share_urn
    if (typeof post.urn === 'object' && post.urn !== null) {
      const urnObj = post.urn as any;
      return urnObj.activity_urn || urnObj.share_urn || urnObj.ugcPost_urn || JSON.stringify(post.urn);
    }
    return String(post.urn);
  }
  if (post.full_urn) return post.full_urn;
  if (post.url) return post.url;
  if (post.postUrl) return post.postUrl;
  // Fallback: use a combination of text and timestamp
  const text = post.text?.substring(0, 50) || '';
  const timestamp = post.posted_at?.timestamp || post.postedAtTimestamp || 0;
  return `${text}-${timestamp}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlsParam = searchParams.get('urls');
    const filterUntilDate = searchParams.get('filterUntil'); // Date to filter until (YYYY-MM-DD)

    if (!urlsParam) {
      return NextResponse.json(
        { error: 'URLs are required' },
        { status: 400 }
      );
    }

    // Parse URLs from query param and extract username
    const urls = urlsParam.split(',').map(url => url.trim()).filter(url => url.length > 0);
    const username = extractUsername(urls[0]); // Use first URL's username

    // Setup data directory and file path
    const dataDir = path.join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });
    const postsFilePath = path.join(dataDir, 'posts_data.json');

    // Read existing data from file
    let postsData: PostsDataFile = { metadata: {}, posts: [] };
    try {
      const fileContent = await readFile(postsFilePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      if (Array.isArray(parsed)) {
        postsData = { metadata: {}, posts: parsed };
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        postsData = parsed;
      }
    } catch {
      postsData = { metadata: {}, posts: [] };
    }

    const { metadata, posts: existingPosts } = postsData;

    // Filter existing posts for the requested user
    const userExistingPosts = existingPosts.filter(post => {
      const postUsername = getPostAuthor(post);
      return postUsername === username;
    });

    // Parse filter date if provided (posts FROM this date onwards)
    const filterFromTimestamp = filterUntilDate 
      ? new Date(filterUntilDate + 'T00:00:00').getTime() // Start of the day
      : null;
    
    // Check if we have enough cached posts that cover the requested date
    let needsFetch = false;
    let needsMorePages = false;
    let pageNumber = 1;

    if (userExistingPosts.length === 0) {
      // No cached posts - need to fetch page 1
      needsFetch = true;
      pageNumber = 1;
    } else if (filterFromTimestamp) {
      // Check if we have posts FROM the requested date onwards
      const filteredCachedPosts = userExistingPosts.filter(post => {
        const postTimestamp = getPostTimestamp(post);
        return postTimestamp >= filterFromTimestamp;
      });
      
      // Check the oldest cached post to see if we need to fetch more pages
      const oldestCachedPostTimestamp = userExistingPosts.length > 0
        ? Math.min(...userExistingPosts.map(getPostTimestamp).filter(ts => ts > 0))
        : null;
      
      // If we have cached posts but the oldest is newer than requested date, we need to fetch more pages
      if (oldestCachedPostTimestamp && oldestCachedPostTimestamp > filterFromTimestamp) {
        // Our oldest cached post is newer than requested date
        // This means we need to fetch older posts (more pages) to reach the requested date
        needsFetch = true;
        needsMorePages = true;
        pageNumber = 1; // Always start from page 1 to get pagination token chain
        
        console.log(`Need older posts to reach ${filterUntilDate}. Oldest cached: ${new Date(oldestCachedPostTimestamp).toISOString()}, requested: ${new Date(filterFromTimestamp).toISOString()}, will fetch from page 1 using pagination tokens`);
      } else if (filteredCachedPosts.length > 0 && oldestCachedPostTimestamp && oldestCachedPostTimestamp <= filterFromTimestamp) {
        // We have posts from the requested date AND our oldest post is older than or equal to requested date
        // This means we likely have all posts from that date - return cached
        console.log(`Returning cached posts. Have ${filteredCachedPosts.length} posts from ${filterUntilDate} onwards, oldest cached: ${new Date(oldestCachedPostTimestamp).toISOString()}`);
        return NextResponse.json({ 
          success: true, 
          data: filteredCachedPosts,
          cached: true,
          stats: {
            totalPostsFetched: filteredCachedPosts.length,
            totalCached: userExistingPosts.length,
            message: `Returning ${filteredCachedPosts.length} cached posts from ${filterUntilDate} onwards`
          }
        });
      } else if (filteredCachedPosts.length === 0) {
        // No posts from the requested date - need to fetch
        needsFetch = true;
        needsMorePages = true;
        pageNumber = 1;
        console.log(`No cached posts from ${filterUntilDate}, will fetch from page 1`);
      } else {
        // Edge case - fetch to be safe
        needsFetch = true;
        pageNumber = 1;
      }
    } else {
      // No date filter - check if we have recent data (fetched today)
      const userMetadata = metadata[username];
      const today = new Date().toISOString().split('T')[0];
      
      if (userMetadata?.lastFetchDate === today && userExistingPosts.length >= 100) {
        // Already fetched today and have 100+ posts - return cached
        return NextResponse.json({ 
          success: true, 
          data: userExistingPosts,
          cached: true,
          stats: {
            totalPostsFetched: userExistingPosts.length,
            message: `Returning ${userExistingPosts.length} cached posts (fetched today)`
          }
        });
      } else {
        // Need to fetch or refresh - start with page 1
        needsFetch = true;
        pageNumber = 1;
      }
    }

    // Fetch from Apify if needed
    if (needsFetch) {
      console.log(`Starting fetch process. needsMorePages: ${needsMorePages}, pageNumber: ${pageNumber}, filterFromTimestamp: ${filterFromTimestamp ? new Date(filterFromTimestamp).toISOString() : 'none'}`);
      
      // Initialize the ApifyClient with API token
      const client = new ApifyClient({
        token: process.env.APIFY_TOKEN || '<YOUR_API_TOKEN>',
      });

      let allNewPosts: Post[] = [];
      let paginationToken: string | null = null;
      let currentPage = pageNumber;
      const maxPages = 5; // Safety limit to avoid infinite loops
      let hasReachedDate = false;
      let maxPagesReached = false;

      // Fetch pages until we have enough posts or reach the date
      console.log(`Starting pagination loop. Will fetch up to ${maxPages} pages.`);
      while (currentPage <= maxPages && !hasReachedDate) {
        // Prepare Actor input for new actor
        const input: any = {
          username: username,
          page_number: currentPage,
          limit: 100
        };

        // Add pagination token if we have one (for page 2+)
        if (paginationToken && currentPage > 1) {
          input.pagination_token = paginationToken;
        }

        console.log(`Fetching posts for username: ${username}, page: ${currentPage}${paginationToken ? ' (with pagination token)' : ''}`);

        // Run the new LinkedIn Posts Scraper Actor
        const run = await client.actor("LQQIXN9Othf8f7R5n").call(input);

        // Fetch Actor results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // The actor returns individual post objects, each with a pagination_token property
        let pagePosts: Post[] = [];
        let pagePaginationToken: string | null = null;
        
        if (items && items.length > 0) {
          const firstItem = items[0] as any;
          
          // Check if items are wrapped in a response structure
          if (firstItem?.success && firstItem?.data?.posts && Array.isArray(firstItem.data.posts)) {
            pagePosts = firstItem.data.posts;
            pagePaginationToken = firstItem?.data?.pagination_token || firstItem?.data?.paginationToken || null;
          } else if (firstItem?.data && Array.isArray(firstItem.data)) {
            pagePosts = firstItem.data as Post[];
            pagePaginationToken = firstItem?.pagination_token || firstItem?.paginationToken || null;
          } else if (firstItem?.urn || firstItem?.text || firstItem?.posted_at) {
            // Items are individual post objects - each post has pagination_token
            pagePosts = items as Post[];
            // Extract pagination_token from the first post (all posts should have the same token for the page)
            // Check both pagination_token and paginationToken (camelCase variant)
            pagePaginationToken = (firstItem as any)?.pagination_token || (firstItem as any)?.paginationToken || null;
            console.log(`DEBUG: Extracting from post object. First item has pagination_token: ${!!(firstItem as any)?.pagination_token}, value: ${(firstItem as any)?.pagination_token?.substring(0, 50) || 'null'}`);
          } else if (Array.isArray(firstItem)) {
            pagePosts = items as Post[];
          } else {
            // Search through items for posts
            for (const item of items) {
              const response = item as any;
              if (response?.success && response?.data?.posts && Array.isArray(response.data.posts)) {
                pagePosts = response.data.posts;
                pagePaginationToken = response?.data?.pagination_token || response?.data?.paginationToken || null;
                break;
              } else if ((response?.urn || response?.text || response?.posted_at) && response?.pagination_token) {
                // Found a post with pagination token
                pagePosts = items.filter((item: any) => item?.urn || item?.text || item?.posted_at) as Post[];
                pagePaginationToken = response.pagination_token;
                break;
              }
            }
          }
        }
        
        console.log(`Extracted ${pagePosts.length} posts, pagination_token: ${pagePaginationToken ? `YES (${pagePaginationToken.substring(0, 30)}...)` : 'NO'}`);
        
        // If we didn't get a token but have posts, try to find it in any post
        if (!pagePaginationToken && pagePosts.length > 0) {
          for (const post of pagePosts) {
            const postAny = post as any;
            if (postAny?.pagination_token) {
              pagePaginationToken = postAny.pagination_token;
              console.log(`Found pagination_token in post: ${pagePaginationToken ? pagePaginationToken.substring(0, 30) + '...' : 'null'}`);
              break;
            }
          }
        }

        // Log date range for this page
        if (pagePosts.length > 0) {
          const pageTimestamps = pagePosts.map(getPostTimestamp).filter(ts => ts > 0);
          const newestPagePost = new Date(Math.max(...pageTimestamps)).toISOString();
          const oldestPagePost = new Date(Math.min(...pageTimestamps)).toISOString();
          console.log({ 
            page: currentPage, 
            fetchedPostsCount: pagePosts.length, 
            hasPaginationToken: !!pagePaginationToken,
            dateRange: { newest: newestPagePost, oldest: oldestPagePost },
            requestedDate: filterFromTimestamp ? new Date(filterFromTimestamp).toISOString() : null
          });
        } else {
          console.log({ page: currentPage, fetchedPostsCount: 0, hasPaginationToken: !!pagePaginationToken });
        }

        // Add posts from this page
        allNewPosts.push(...pagePosts);

        // Update pagination token for next iteration
        paginationToken = pagePaginationToken;

        // If no more posts, we're done
        if (pagePosts.length === 0) {
          console.log(`No more posts. Stopping at page ${currentPage}`);
          break;
        }

        // If we don't have a date filter, just fetch one page
        if (!filterFromTimestamp) {
          break;
        }

        // Check if we've reached the requested date
        if (filterFromTimestamp && allNewPosts.length > 0) {
          // Check if we have any posts from the requested date onwards
          const postsFromDate = allNewPosts.filter(post => {
            const postTimestamp = getPostTimestamp(post);
            return postTimestamp >= filterFromTimestamp;
          });
          
          const oldestPostTimestamp = Math.min(
            ...allNewPosts.map(getPostTimestamp).filter(ts => ts > 0)
          );
          
          console.log(`Checking date: oldest fetched: ${new Date(oldestPostTimestamp).toISOString()}, requested: ${new Date(filterFromTimestamp).toISOString()}, posts from date: ${postsFromDate.length}`);
          
          // Stop if:
          // 1. We have posts from the requested date, AND
          // 2. The oldest post is older than or equal to the requested date (meaning we've gone back far enough)
          // This ensures we have posts from the date and we've fetched enough history
          if (postsFromDate.length > 0 && oldestPostTimestamp <= filterFromTimestamp) {
            hasReachedDate = true;
            console.log(`✓ Reached requested date. Found ${postsFromDate.length} posts from ${new Date(filterFromTimestamp).toISOString()}, oldest: ${new Date(oldestPostTimestamp).toISOString()}`);
            break;
          } else if (postsFromDate.length === 0) {
            // We don't have posts from the requested date yet - keep fetching
            console.log(`✗ No posts from ${new Date(filterFromTimestamp).toISOString()} yet, oldest: ${new Date(oldestPostTimestamp).toISOString()}. Continue fetching...`);
          } else if (postsFromDate.length > 0 && oldestPostTimestamp > filterFromTimestamp) {
            // We have some posts from the date, but oldest is still newer
            // This means there might be more posts between oldest and requested date
            // Continue fetching to get all posts from the requested date
            console.log(`✓ Have ${postsFromDate.length} posts from date, but continuing to get more (oldest: ${new Date(oldestPostTimestamp).toISOString()})`);
          }
        }

        // If no pagination token, we can't fetch more pages
        if (!paginationToken) {
          console.log(`No pagination token. Stopping at page ${currentPage}`);
          break;
        }

        // Move to next page
        currentPage++;
        
        // Check if we've reached max pages
        if (currentPage > maxPages) {
          maxPagesReached = true;
          console.log(`⚠️ Reached maximum page limit (${maxPages}). Stopping pagination.`);
          break;
        }
      }

      console.log({ totalFetchedPostsCount: allNewPosts.length, pagesFetched: currentPage - pageNumber, maxPagesReached });

      // Deduplicate: merge existing + new posts
    const postMap = new Map<string, Post>();
    
    // Add existing posts first
    for (const post of existingPosts) {
      const id = getPostId(post);
      postMap.set(id, post);
    }
    
    // Add/update with new posts
    let actualNewCount = 0;
      for (const post of allNewPosts) {
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

      // Update metadata
      const today = new Date().toISOString().split('T')[0];
      const userPosts = combinedPosts.filter(p => getPostAuthor(p) === username);
      const userTimestamps = userPosts.map(getPostTimestamp).filter(ts => ts > 0);
      
      const updatedMetadata: Record<string, UserMetadata> = {
        ...metadata,
        [username]: {
          lastFetchDate: today,
        oldestPostDate: userTimestamps.length > 0 
          ? new Date(Math.min(...userTimestamps)).toISOString().split('T')[0] 
          : null,
        newestPostDate: userTimestamps.length > 0 
          ? new Date(Math.max(...userTimestamps)).toISOString().split('T')[0] 
          : null,
        postCount: userPosts.length
        }
      };

      // Save to file
    const dataToSave: PostsDataFile = {
      metadata: updatedMetadata,
      posts: combinedPosts
    };
    
    await writeFile(postsFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log(`Posts data saved to: ${postsFilePath} (Total: ${combinedPosts.length} posts, ${actualNewCount} new)`);

      // Filter by date if requested (posts FROM the date onwards)
      let filteredPosts = userPosts;
      if (filterFromTimestamp) {
        filteredPosts = userPosts.filter(post => {
          const postTimestamp = getPostTimestamp(post);
          return postTimestamp >= filterFromTimestamp;
        });
      }

      // Check if we need more pages (if we still don't have posts from the requested date)
      let needsMorePagesWarning = false;
      if (filterFromTimestamp && filteredPosts.length === 0 && userPosts.length > 0) {
        // We fetched posts but none match the date filter - might need more pages
        const oldestPostTimestamp = Math.min(
          ...userPosts.map(getPostTimestamp).filter(ts => ts > 0)
        );
        if (oldestPostTimestamp > filterFromTimestamp) {
          // Our oldest post is still newer than requested date - need more pages
          needsMorePagesWarning = true;
        }
      }

      const pagesFetched = currentPage - pageNumber;
      const maxPagesMessage = maxPagesReached 
        ? ` Reached maximum page limit (${maxPages}). Some posts may be missing.`
        : '';

      return NextResponse.json({ 
        success: true, 
        data: filteredPosts,
        cached: false,
        stats: {
          totalPostsFetched: filteredPosts.length,
          totalCached: userPosts.length,
          newPostsFetched: allNewPosts.length,
          actualNewPosts: actualNewCount,
          pagesFetched: pagesFetched,
          maxPagesReached: maxPagesReached,
          needsMorePages: needsMorePagesWarning,
          message: needsMorePagesWarning 
            ? `Fetched ${filteredPosts.length} posts across ${pagesFetched} pages, but may need more pages to reach posts from ${filterUntilDate}.${maxPagesMessage}`
            : `Fetched ${filteredPosts.length} posts from ${filterUntilDate ? filterUntilDate + ' onwards' : 'all dates'} across ${pagesFetched} page(s).${maxPagesMessage}`
        }
      });
    }

    // Should not reach here, but just in case
    return NextResponse.json({ 
      success: true, 
      data: userExistingPosts,
      cached: true
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
