import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Post interface for type safety
interface Post {
  postUrl?: string;
  url?: string;
  urn?: string;
  authorProfileUrl?: string;
  authorUsername?: string;
  authorProfileId?: string;
  authorName?: string;
  postedAtTimestamp?: number;
  postedAt?: string;
  postedAtISO?: string;
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  text?: string;
  images?: string[];
  type?: string;
  author?: {
    firstName?: string;
    lastName?: string;
    occupation?: string;
    publicId?: string;
    picture?: string;
  };
  [key: string]: unknown;
}

// Metadata per user to track fetch history
interface UserMetadata {
  lastFetchDate: string;
  oldestPostDate: string | null;
  newestPostDate: string | null;
  postCount: number;
}

// File structure with metadata
interface PostsDataFile {
  metadata: Record<string, UserMetadata>;
  posts: Post[];
}

// Helper to extract username from LinkedIn URL
function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1].toLowerCase() : url.toLowerCase();
}

// Helper to get post's author username
function getPostAuthor(post: Post): string {
  return post.authorProfileId?.toLowerCase() || 
    post.authorUsername?.toLowerCase() || 
    (post.authorProfileUrl ? extractUsername(post.authorProfileUrl) : '');
}

// Get engagement score for ranking
function getEngagementScore(post: Post): number {
  const likes = post.numLikes ?? 0;
  const comments = post.numComments ?? 0;
  const shares = post.numShares ?? 0;
  // Weighted score: shares are most valuable, then comments, then likes
  return (shares * 3) + (comments * 2) + likes;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlParam = searchParams.get('url');
    const limitParam = searchParams.get('limit');
    const forceRefresh = searchParams.get('force') === 'true';
    const limit = limitParam ? parseInt(limitParam, 10) : 5; // Default to top 5 per category

    if (!urlParam) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const username = extractUsername(urlParam);

    // Setup data file path
    const dataDir = path.join(process.cwd(), 'data');
    const postsFilePath = path.join(dataDir, 'posts_data.json');

    // Read existing data from file
    let postsData: PostsDataFile = { metadata: {}, posts: [] };
    let userPosts: Post[] = [];
    let userExistsInMetadata = false;

    try {
      const fileContent = await readFile(postsFilePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      // Handle migration from old format (array) to new format (object with metadata)
      if (Array.isArray(parsed)) {
        postsData = { metadata: {}, posts: parsed };
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        postsData = parsed;
      }

      // Check if user exists in metadata (means we've already fetched for this user)
      userExistsInMetadata = username in postsData.metadata;

      // Filter posts for the requested user
      userPosts = postsData.posts.filter(post => {
        const postUsername = getPostAuthor(post);
        return postUsername === username;
      });
    } catch {
      // File doesn't exist or is invalid
      postsData = { metadata: {}, posts: [] };
    }

    // Only fetch if:
    // 1. User doesn't exist in metadata AND has no posts, OR
    // 2. Force refresh is requested AND user has no posts
    const shouldFetch = userPosts.length === 0 && (!userExistsInMetadata || forceRefresh);
    
    if (shouldFetch) {
      console.log(`${forceRefresh ? 'Force refreshing' : 'No cached posts for'} ${username}, fetching from posts API...`);
      
      // Build the internal URL to call our existing posts route
      const baseUrl = request.nextUrl.origin;
      const postsUrl = `${baseUrl}/api/posts?urls=${encodeURIComponent(urlParam)}`;
      
      try {
        const response = await fetch(postsUrl);
        const result = await response.json();

        if (!response.ok) {
          return NextResponse.json(
            { 
              error: 'Failed to fetch posts for user', 
              message: result.error || result.message 
            },
            { status: response.status }
          );
        }

        // Get the posts from the response
        userPosts = result.data || [];
        console.log(`Fetched ${userPosts.length} posts for ${username}`);
      } catch (fetchError) {
        console.error('Error calling posts API:', fetchError);
        return NextResponse.json(
          { 
            error: 'Failed to fetch posts', 
            message: fetchError instanceof Error ? fetchError.message : 'Unknown error' 
          },
          { status: 500 }
        );
      }
    } else if (userExistsInMetadata && userPosts.length === 0 && !forceRefresh) {
      // User exists in metadata but has no posts - we've already tried fetching
      // Skip if force refresh is requested
      console.log(`User ${username} exists in metadata but has no posts (previously fetched). Use ?force=true to re-fetch.`);
      return NextResponse.json({
        success: true,
        data: {
          username,
          totalPosts: 0,
          topByLikes: [],
          topByComments: [],
          topByShares: [],
          topByEngagement: [],
        },
        cached: true,
        userMetadata: postsData.metadata[username] || null,
        message: 'No posts found for this user (previously checked). Add ?force=true to re-fetch.'
      });
    } else {
      console.log(`Found ${userPosts.length} cached posts for ${username}`);
    }

    // If still no posts, return empty result
    if (userPosts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          username,
          totalPosts: 0,
          topByLikes: [],
          topByComments: [],
          topByShares: [],
          topByEngagement: [],
        },
        message: 'No posts found for this user'
      });
    }

    // Sort and get top posts by different metrics
    const topByLikes = [...userPosts]
      .sort((a, b) => (b.numLikes ?? 0) - (a.numLikes ?? 0))
      .slice(0, limit);

    const topByComments = [...userPosts]
      .sort((a, b) => (b.numComments ?? 0) - (a.numComments ?? 0))
      .slice(0, limit);

    const topByShares = [...userPosts]
      .sort((a, b) => (b.numShares ?? 0) - (a.numShares ?? 0))
      .slice(0, limit);

    // Top by overall engagement (weighted score)
    const topByEngagement = [...userPosts]
      .sort((a, b) => getEngagementScore(b) - getEngagementScore(a))
      .slice(0, limit);

    // Calculate aggregate stats
    const totalLikes = userPosts.reduce((sum, p) => sum + (p.numLikes ?? 0), 0);
    const totalComments = userPosts.reduce((sum, p) => sum + (p.numComments ?? 0), 0);
    const totalShares = userPosts.reduce((sum, p) => sum + (p.numShares ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        username,
        totalPosts: userPosts.length,
        aggregateStats: {
          totalLikes,
          totalComments,
          totalShares,
          avgLikes: Math.round(totalLikes / userPosts.length),
          avgComments: Math.round(totalComments / userPosts.length),
          avgShares: Math.round(totalShares / userPosts.length),
        },
        topByLikes,
        topByComments,
        topByShares,
        topByEngagement,
      },
      cached: userPosts.length > 0 && postsData.metadata[username] !== undefined,
      userMetadata: postsData.metadata[username] || null,
    });
  } catch (error: unknown) {
    console.error('Error fetching top posts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch top posts', message: errorMessage },
      { status: 500 }
    );
  }
}

