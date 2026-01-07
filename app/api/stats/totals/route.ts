import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

interface Post {
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  authorProfileId?: string;
  authorProfileUrl?: string;
}

interface PostsDataFile {
  metadata: Record<string, { postCount: number }>;
  posts: Post[];
}

function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1].toLowerCase() : url.toLowerCase();
}

function getPostAuthor(post: Post): string {
  return post.authorProfileId?.toLowerCase() || 
    (post.authorProfileUrl ? extractUsername(post.authorProfileUrl) : '');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();
    const postsFilePath = path.join(process.cwd(), 'data', 'posts_data.json');

    let postsData: PostsDataFile;
    try {
      const fileContent = await readFile(postsFilePath, 'utf-8');
      postsData = JSON.parse(fileContent);
    } catch {
      return NextResponse.json({ error: 'Posts data file not found' }, { status: 404 });
    }

    // Check if user exists in metadata
    if (!postsData.metadata[normalizedUsername]) {
      return NextResponse.json({
        error: 'User not found',
        message: `No data found for user "${username}". Please fetch posts for this user first.`,
        userNotFound: true,
        guidelines: {
          note: 'This endpoint works from stored data. You need to fetch posts first:',
          fetchPosts: 'GET /api/posts?urls=linkedin.com/in/username',
          thenRetry: 'Then retry this endpoint: GET /api/stats/totals?username=username'
        }
      }, { status: 404 });
    }

    // Filter posts for this user
    const userPosts = postsData.posts.filter(post => getPostAuthor(post) === normalizedUsername);

    // Calculate totals
    const totals = userPosts.reduce((acc, post) => ({
      totalLikes: acc.totalLikes + (post.numLikes || 0),
      totalComments: acc.totalComments + (post.numComments || 0),
      totalReposts: acc.totalReposts + (post.numShares || 0),
    }), { totalLikes: 0, totalComments: 0, totalReposts: 0 });

    const totalEngagement = totals.totalLikes + totals.totalComments + totals.totalReposts;
    const postCount = userPosts.length;

    return NextResponse.json({
      success: true,
      username: normalizedUsername,
      postCount,
      totals: {
        ...totals,
        totalEngagement
      },
      averages: {
        avgLikes: postCount > 0 ? Math.round(totals.totalLikes / postCount) : 0,
        avgComments: postCount > 0 ? Math.round(totals.totalComments / postCount) : 0,
        avgReposts: postCount > 0 ? Math.round(totals.totalReposts / postCount) : 0,
        avgEngagement: postCount > 0 ? Math.round(totalEngagement / postCount) : 0,
      }
    });
  } catch (error) {
    console.error('Error fetching totals:', error);
    return NextResponse.json({ error: 'Failed to fetch totals' }, { status: 500 });
  }
}

