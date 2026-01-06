import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

interface Post {
  text?: string;
  authorUsername?: string;
  authorProfileUrl?: string;
  [key: string]: unknown;
}

interface PostsDataFile {
  metadata: Record<string, { postCount: number }>;
  posts: Post[];
}

interface ProfileData {
  profileUrl?: string;
  basic_info?: {
    fullname?: string;
    public_identifier?: string;
    profile_url?: string;
  };
}

// Extract username from LinkedIn URL
function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1].toLowerCase() : url.toLowerCase();
}

// Get post author username
function getPostAuthor(post: Post): string {
  return post.authorUsername?.toLowerCase() || 
    (post.authorProfileUrl ? extractUsername(post.authorProfileUrl) : '');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const usernameParam = searchParams.get('username');

    if (!usernameParam) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const username = extractUsername(usernameParam).toLowerCase();
    const dataDir = path.join(process.cwd(), 'data');

    // Read posts data
    let postsData: PostsDataFile = { metadata: {}, posts: [] };
    let postCount = 0;
    
    try {
      const postsFilePath = path.join(dataDir, 'posts_data.json');
      const postsContent = await readFile(postsFilePath, 'utf-8');
      const parsed = JSON.parse(postsContent);
      
      if (Array.isArray(parsed)) {
        postsData = { metadata: {}, posts: parsed };
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        postsData = parsed;
      }

      // Count posts for this user
      const userPosts = postsData.posts.filter(post => {
        const postUsername = getPostAuthor(post);
        return postUsername === username;
      });
      postCount = userPosts.length;
    } catch {
      // Posts file doesn't exist
      postCount = 0;
    }

    // Read profile data
    let hasProfile = false;
    let profileName: string | null = null;
    
    try {
      const profileFilePath = path.join(dataDir, 'profile_data.json');
      const profileContent = await readFile(profileFilePath, 'utf-8');
      const profiles: ProfileData[] = JSON.parse(profileContent);
      
      const userProfile = profiles.find(profile => {
        const profileUsername = profile.basic_info?.public_identifier?.toLowerCase() || 
                               extractUsername(profile.profileUrl || '');
        return profileUsername === username;
      });
      
      if (userProfile) {
        hasProfile = true;
        profileName = userProfile.basic_info?.fullname || null;
      }
    } catch {
      // Profile file doesn't exist
      hasProfile = false;
    }

    return NextResponse.json({
      success: true,
      username,
      postCount,
      hasProfile,
      profileName,
      meetsThreshold: postCount >= 20,
      threshold: 20
    });
  } catch (error: unknown) {
    console.error('Error checking identity data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to check identity data', message: errorMessage },
      { status: 500 }
    );
  }
}

