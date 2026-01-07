import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { Post, PostsDataFile, extractUsername, getPostAuthor, getPostDate, getPostLikes, getPostComments, getPostShares } from '@/lib/types';

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
          thenRetry: 'Then retry this endpoint: GET /api/stats/by-date?username=username'
        }
      }, { status: 404 });
    }

    const userPosts = postsData.posts.filter(post => getPostAuthor(post) === normalizedUsername);

    // Group by date
    const byDate: Record<string, { likes: number; comments: number; reposts: number; posts: number }> = {};

    userPosts.forEach(post => {
      const date = getPostDate(post);
      if (!date) return;

      if (!byDate[date]) {
        byDate[date] = { likes: 0, comments: 0, reposts: 0, posts: 0 };
      }
      byDate[date].likes += getPostLikes(post);
      byDate[date].comments += getPostComments(post);
      byDate[date].reposts += getPostShares(post);
      byDate[date].posts += 1;
    });

    // Convert to sorted array
    const data = Object.entries(byDate)
      .map(([date, stats]) => ({
        date,
        ...stats,
        engagement: stats.likes + stats.comments + stats.reposts
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      username: normalizedUsername,
      data
    });
  } catch (error) {
    console.error('Error fetching by-date stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats by date' }, { status: 500 });
  }
}


