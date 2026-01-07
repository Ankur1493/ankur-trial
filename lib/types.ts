// Centralized types for LinkedIn data structures

// Post interface - supports both old and new Apify response formats
export interface Post {
  // Identifiers (new format)
  urn?: string;
  full_urn?: string;
  url?: string;
  postUrl?: string; // Legacy
  
  // Content
  text?: string;
  post_type?: string;
  type?: string; // Legacy
  
  // Timing (new format)
  posted_at?: {
    date?: string;
    relative?: string;
    timestamp?: number;
  };
  // Legacy timing fields
  postedAtTimestamp?: number;
  postedAt?: string;
  postedAtISO?: string;
  timeSincePosted?: string;
  
  // Author (new format)
  author?: {
    first_name?: string;
    lastName?: string; // Legacy
    firstName?: string; // Legacy
    last_name?: string;
    headline?: string;
    username?: string;
    profile_url?: string;
    profile_picture?: string;
    occupation?: string; // Legacy
    publicId?: string; // Legacy
    public_id?: string;
    picture?: string; // Legacy
    id?: string;
    trackingId?: string; // Legacy
    profileId?: string; // Legacy
  };
  // Legacy author fields
  authorProfileUrl?: string;
  authorUsername?: string;
  authorProfileId?: string;
  authorName?: string;
  
  // Stats (new format)
  stats?: {
    total_reactions?: number;
    like?: number;
    support?: number;
    love?: number;
    insight?: number;
    celebrate?: number;
    comments?: number;
    reposts?: number;
  };
  // Legacy stats
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  
  // Media (new format)
  media?: {
    type?: string;
    url?: string;
    thumbnail?: string;
    images?: Array<{
      url?: string;
      width?: number;
      height?: number;
    }>;
  };
  images?: string[]; // Legacy
  
  // Reshared post (new format)
  reshared_post?: Post;
  
  // Article (new format)
  article?: {
    url?: string;
    title?: string;
    subtitle?: string;
    thumbnail?: string;
  };
  
  // Document (new format)
  document?: {
    title?: string;
    page_count?: number;
    url?: string;
    thumbnail?: string;
  };
  
  // Post settings (legacy)
  canReact?: boolean;
  canPostComments?: boolean;
  canShare?: boolean;
  commentingDisabled?: boolean;
  shareAudience?: string;
  
  // Allow additional properties
  [key: string]: unknown;
}

// Posts data file structure with metadata
export interface UserMetadata {
  lastFetchDate: string;
  oldestPostDate: string | null;
  newestPostDate: string | null;
  postCount: number;
}

export interface PostsDataFile {
  metadata: Record<string, UserMetadata>;
  posts: Post[];
}

// Profile data structure
export interface ProfileData {
  profileUrl?: string;
  basic_info?: {
    fullname?: string;
    first_name?: string;
    last_name?: string;
    headline?: string;
    public_identifier?: string;
    profile_url?: string;
    about?: string;
    location?: {
      full?: string;
    };
    current_company?: string;
    creator_hashtags?: string[];
  };
  experience?: Array<{
    title?: string;
    company?: string;
    description?: string;
    duration?: string;
    is_current?: boolean;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field_of_study?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
  }>;
  skills?: Array<{
    name?: string;
  }>;
}

// Helper function to extract username from LinkedIn URL or return as-is if already a username
export function extractUsername(input: string): string {
  const trimmed = input.trim();
  
  // Handle full LinkedIn URLs
  // Matches: https://linkedin.com/in/username, https://www.linkedin.com/in/username, linkedin.com/in/username
  const linkedinPattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^\/\?\s]+)/i;
  const match = trimmed.match(linkedinPattern);
  
  if (match) {
    return match[1].toLowerCase();
  }
  
  // Already a username, return lowercase for consistent comparison
  return trimmed.toLowerCase();
}

// Helper function to get post author username
export function getPostAuthor(post: Post): string {
  // New format
  if (post.author?.username) {
    return post.author.username.toLowerCase();
  }
  if (post.author?.profile_url) {
    return extractUsername(post.author.profile_url);
  }
  // Legacy format
  return post.authorUsername?.toLowerCase() || 
    post.authorProfileId?.toLowerCase() || 
    (post.authorProfileUrl ? extractUsername(post.authorProfileUrl) : '');
}

// Helper function to get post timestamp
export function getPostTimestamp(post: Post): number {
  // New format
  if (post.posted_at?.timestamp) {
    return post.posted_at.timestamp;
  }
  if (post.posted_at?.date) {
    return new Date(post.posted_at.date).getTime();
  }
  // Legacy format
  if (post.postedAtTimestamp) return post.postedAtTimestamp;
  if (post.postedAtISO) return new Date(post.postedAtISO).getTime();
  if (post.postedAt) return new Date(post.postedAt).getTime();
  return 0;
}

// Helper function to get post date as string
export function getPostDate(post: Post): string | null {
  // New format
  if (post.posted_at?.date) {
    return post.posted_at.date.split(' ')[0]; // Extract date part from "YYYY-MM-DD HH:MM:SS"
  }
  if (post.posted_at?.timestamp) {
    return new Date(post.posted_at.timestamp).toISOString().split('T')[0];
  }
  // Legacy format
  if (post.postedAtTimestamp) {
    return new Date(post.postedAtTimestamp).toISOString().split('T')[0];
  }
  if (post.postedAtISO) {
    return post.postedAtISO.split('T')[0];
  }
  if (post.postedAt) {
    return new Date(post.postedAt).toISOString().split('T')[0];
  }
  return null;
}

// Helper function to get post likes count (handles both new and legacy formats)
export function getPostLikes(post: Post): number {
  // New format: stats.like or stats.total_reactions as fallback
  if (post.stats?.like !== undefined) {
    return post.stats.like;
  }
  if (post.stats?.total_reactions !== undefined) {
    return post.stats.total_reactions;
  }
  // Legacy format
  return post.numLikes ?? 0;
}

// Helper function to get post comments count (handles both new and legacy formats)
export function getPostComments(post: Post): number {
  // New format: stats.comments
  if (post.stats?.comments !== undefined) {
    return post.stats.comments;
  }
  // Legacy format
  return post.numComments ?? 0;
}

// Helper function to get post shares/reposts count (handles both new and legacy formats)
export function getPostShares(post: Post): number {
  // New format: stats.reposts
  if (post.stats?.reposts !== undefined) {
    return post.stats.reposts;
  }
  // Legacy format
  return post.numShares ?? 0;
}

// Helper function to get post engagement score (weighted: shares*3 + comments*2 + likes)
export function getPostEngagementScore(post: Post): number {
  const likes = getPostLikes(post);
  const comments = getPostComments(post);
  const shares = getPostShares(post);
  return (shares * 3) + (comments * 2) + likes;
}

