import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { Post, PostsDataFile, extractUsername, getPostAuthor, getPostTimestamp } from '@/lib/types';

function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

    if (!postsData.metadata[normalizedUsername]) {
      return NextResponse.json({
        error: 'User not found',
        message: `No data found for user "${username}". Please fetch posts for this user first.`,
        userNotFound: true,
        guidelines: {
          note: 'This endpoint works from stored data. You need to fetch posts first:',
          fetchPosts: 'GET /api/posts?urls=linkedin.com/in/username',
          thenRetry: 'Then retry this endpoint: GET /api/stats/history?username=username'
        }
      }, { status: 404 });
    }

    const userPosts = postsData.posts.filter(post => getPostAuthor(post) === normalizedUsername);

    // Group by month for trend analysis
    const byMonth: Record<string, { 
      likes: number; 
      comments: number; 
      reposts: number; 
      posts: number;
      cumulativeLikes: number;
      cumulativeComments: number;
      cumulativeReposts: number;
    }> = {};

    // Sort posts by date ascending
    const sortedPosts = [...userPosts].sort((a, b) => getPostTimestamp(a) - getPostTimestamp(b));

    let cumulativeLikes = 0;
    let cumulativeComments = 0;
    let cumulativeReposts = 0;

    sortedPosts.forEach(post => {
      const timestamp = getPostTimestamp(post);
      if (!timestamp) return;

      const monthKey = getMonthKey(timestamp);
      const likes = post.numLikes || 0;
      const comments = post.numComments || 0;
      const reposts = post.numShares || 0;

      cumulativeLikes += likes;
      cumulativeComments += comments;
      cumulativeReposts += reposts;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { 
          likes: 0, comments: 0, reposts: 0, posts: 0,
          cumulativeLikes: 0, cumulativeComments: 0, cumulativeReposts: 0
        };
      }
      
      byMonth[monthKey].likes += likes;
      byMonth[monthKey].comments += comments;
      byMonth[monthKey].reposts += reposts;
      byMonth[monthKey].posts += 1;
      byMonth[monthKey].cumulativeLikes = cumulativeLikes;
      byMonth[monthKey].cumulativeComments = cumulativeComments;
      byMonth[monthKey].cumulativeReposts = cumulativeReposts;
    });

    // Convert to sorted array with formatted month names
    const data = Object.entries(byMonth)
      .map(([month, stats]) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        });
        return {
          month,
          monthName,
          ...stats,
          engagement: stats.likes + stats.comments + stats.reposts,
          cumulativeEngagement: stats.cumulativeLikes + stats.cumulativeComments + stats.cumulativeReposts
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      success: true,
      username: normalizedUsername,
      data
    });
  } catch (error) {
    console.error('Error fetching history stats:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

