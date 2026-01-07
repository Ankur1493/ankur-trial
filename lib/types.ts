// Centralized types for LinkedIn data structures

// Post interface - used across multiple routes
export interface Post {
  // Identifiers
  postUrl?: string;
  url?: string;
  urn?: string;
  
  // Author info
  authorProfileUrl?: string;
  authorUsername?: string;
  authorProfileId?: string;
  authorName?: string;
  
  // Content
  text?: string;
  images?: string[];
  type?: string;
  
  // Timing
  postedAtTimestamp?: number;
  postedAt?: string;
  postedAtISO?: string;
  timeSincePosted?: string;
  
  // Engagement stats
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  
  // Author nested object
  author?: {
    firstName?: string;
    lastName?: string;
    occupation?: string;
    publicId?: string;
    picture?: string;
    id?: string;
    trackingId?: string;
    profileId?: string;
  };
  
  // Post settings
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
  return post.authorUsername?.toLowerCase() || 
    post.authorProfileId?.toLowerCase() || 
    (post.authorProfileUrl ? extractUsername(post.authorProfileUrl) : '');
}

// Helper function to get post timestamp
export function getPostTimestamp(post: Post): number {
  if (post.postedAtTimestamp) return post.postedAtTimestamp;
  if (post.postedAtISO) return new Date(post.postedAtISO).getTime();
  if (post.postedAt) return new Date(post.postedAt).getTime();
  return 0;
}

// Helper function to get post date as string
export function getPostDate(post: Post): string | null {
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

