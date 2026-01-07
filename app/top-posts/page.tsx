'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOutsideClick } from '@/hooks/use-outside-click';

// Post interfaces matching actual Apify response (supports both new and legacy formats)
interface PostAuthor {
  // New format
  first_name?: string;
  last_name?: string;
  headline?: string;
  username?: string;
  profile_url?: string;
  profile_picture?: string;
  public_id?: string;
  // Legacy format
  firstName?: string;
  lastName?: string;
  occupation?: string;
  id?: string;
  publicId?: string;
  trackingId?: string;
  profileId?: string;
  picture?: string;
}

interface LinkedInPost {
  // Identifiers
  urn?: string | { activity_urn?: string; share_urn?: string; ugcPost_urn?: string | null };
  full_urn?: string;
  shareUrn?: string; // Legacy
  url?: string;
  inputUrl?: string; // Legacy
  
  // Content
  text?: string;
  post_type?: string; // New format
  type?: string; // Legacy format
  
  // Timing (new format)
  posted_at?: {
    date?: string;
    relative?: string;
    timestamp?: number;
  };
  // Legacy timing
  timeSincePosted?: string;
  postedAtTimestamp?: number;
  postedAtISO?: string;
  
  // Author (new format - nested)
  author?: PostAuthor;
  // Legacy author (flat)
  authorName?: string;
  authorProfileId?: string;
  authorProfilePicture?: string;
  authorProfileUrl?: string;
  authorUrn?: string;
  authorType?: string;
  
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
  // Legacy media
  images?: string[];
  
  // Post settings (legacy)
  canReact?: boolean;
  canPostComments?: boolean;
  canShare?: boolean;
  commentingDisabled?: boolean;
  shareAudience?: string;
}

interface AggregateStats {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}

interface TopPostsData {
  username: string;
  totalPosts: number;
  aggregateStats?: AggregateStats;
  topByLikes: LinkedInPost[];
  topByComments: LinkedInPost[];
  topByShares: LinkedInPost[];
  topByEngagement: LinkedInPost[];
}

// Close Icon Component
const CloseIcon = () => {
  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.05 } }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-black dark:text-white"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </motion.svg>
  );
};

// Helper function to get a unique post identifier for keys
function getPostId(post: LinkedInPost): string {
  if (typeof post.urn === 'string') {
    return post.urn;
  }
  if (typeof post.urn === 'object' && post.urn !== null) {
    return post.urn.activity_urn || post.urn.share_urn || post.urn.ugcPost_urn || '';
  }
  return post.full_urn || post.shareUrn || post.url || '';
}

// Helper function to get post data (handles both new and legacy formats)
function getPostData(post: LinkedInPost) {
  // Author name - handle both new and legacy formats
  const authorName = post.authorName || 
    (post.author?.first_name && post.author?.last_name 
      ? `${post.author.first_name} ${post.author.last_name}`
      : (post.author?.firstName && post.author?.lastName 
        ? `${post.author.firstName} ${post.author.lastName}` 
        : 'Unknown Author'));
  
  // Author occupation/headline - new format uses headline, legacy uses occupation
  const authorOccupation = post.author?.headline || post.author?.occupation || '';
  
  // Author profile URL - new format uses profile_url, legacy uses authorProfileUrl
  const authorProfileUrl = post.author?.profile_url || post.authorProfileUrl;
  
  // Author profile picture - new format uses profile_picture, legacy uses picture or authorProfilePicture
  const authorProfilePicture = post.author?.profile_picture || post.author?.picture || post.authorProfilePicture;
  
  const authorType = post.authorType || 'Person';
  
  // Author profile ID - new format uses username or public_id, legacy uses publicId or authorProfileId
  const authorProfileId = post.author?.username || post.author?.public_id || post.author?.publicId || post.authorProfileId;
  
  const postUrl = post.url;
  
  // Stats - handle both new and legacy formats
  const likes = post.stats?.like ?? post.stats?.total_reactions ?? post.numLikes ?? 0;
  const comments = post.stats?.comments ?? post.numComments ?? 0;
  const shares = post.stats?.reposts ?? post.numShares ?? 0;
  
  // Post text - handle both new and legacy formats, including reshared posts
  let postText = post.text || '';
  
  // If this is a reshared post and text is empty, try to get text from reshared_post
  if (!postText && (post as any).reshared_post?.text) {
    postText = (post as any).reshared_post.text;
  }
  
  // Images - new format has media.images array, legacy has images array
  const images: string[] = [];
  if (post.media?.images && Array.isArray(post.media.images)) {
    // New format: extract URLs from media.images array
    images.push(...post.media.images.map(img => img.url || '').filter(Boolean));
  } else if (Array.isArray(post.images)) {
    // Legacy format: direct images array
    images.push(...post.images);
  }
  
  // Post type - new format uses post_type, legacy uses type
  const postType = post.post_type || post.type || 'text';
  
  // Time since posted - new format uses posted_at.relative, legacy uses timeSincePosted
  const timeSincePosted = post.posted_at?.relative || post.timeSincePosted;
  
  // Posted date - new format uses posted_at.date or posted_at.timestamp, legacy uses postedAtISO or postedAtTimestamp
  let postedDate: Date | null = null;
  if (post.posted_at?.timestamp) {
    postedDate = new Date(post.posted_at.timestamp);
  } else if (post.posted_at?.date) {
    postedDate = new Date(post.posted_at.date);
  } else if (post.postedAtISO) {
    postedDate = new Date(post.postedAtISO);
  } else if (post.postedAtTimestamp) {
    postedDate = new Date(post.postedAtTimestamp);
  }
  
  const shareAudience = post.shareAudience;

  return {
    authorName,
    authorOccupation,
    authorProfileUrl,
    authorProfilePicture,
    authorType,
    authorProfileId,
    postUrl,
    likes,
    comments,
    shares,
    postText,
    images,
    postType,
    timeSincePosted,
    postedDate,
    shareAudience,
  };
}

// Compact Post Card for the grid
function TopPostCard({ 
  post, 
  onClick, 
  rank, 
  highlight 
}: { 
  post: LinkedInPost; 
  onClick: () => void; 
  rank: number;
  highlight: 'likes' | 'comments' | 'shares' | 'engagement';
}) {
  const id = useId();
  const data = getPostData(post);
  const truncatedText = data.postText.length > 100 ? `${data.postText.substring(0, 100)}...` : data.postText;

  const highlightColors = {
    likes: 'from-rose-500 to-pink-500',
    comments: 'from-blue-500 to-cyan-500',
    shares: 'from-violet-500 to-purple-500',
    engagement: 'from-amber-500 to-orange-500',
  };

  const highlightBgColors = {
    likes: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
    comments: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    shares: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
    engagement: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  };

  const postId = getPostId(post);
  
  return (
    <motion.div
      layoutId={`card-${postId}-${highlight}-${id}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        "relative rounded-xl border shadow-sm overflow-hidden hover:shadow-lg transition-all cursor-pointer group",
        highlightBgColors[highlight]
      )}
    >
      {/* Rank Badge */}
      <div className={cn(
        "absolute top-3 left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg bg-gradient-to-br",
        highlightColors[highlight]
      )}>
        #{rank}
      </div>

      {/* Image */}
      {data.images.length > 0 && (
        <motion.div layoutId={`image-${postId}-${highlight}-${id}`} className="relative">
          <img
            src={data.images[0]}
            alt="Post"
            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {data.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
              +{data.images.length - 1}
            </div>
          )}
        </motion.div>
      )}

      <div className="p-3">
        {/* Post Text Preview */}
        {truncatedText && (
          <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed line-clamp-2 mb-3">
            {truncatedText}
          </p>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-1 text-xs",
            highlight === 'likes' ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
          )}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
            </svg>
            <span>{data.likes.toLocaleString()}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs",
            highlight === 'comments' ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
          )}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
            </svg>
            <span>{data.comments.toLocaleString()}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs",
            highlight === 'shares' ? "text-violet-600 dark:text-violet-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
          )}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            <span>{data.shares.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Expanded Post Modal
function ExpandedPostModal({ post, onClose }: { post: LinkedInPost; onClose: () => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const data = getPostData(post);
  const postId = getPostId(post);

  useOutsideClick(ref, onClose);

  return (
    <div className="fixed inset-0 grid place-items-center z-[100] p-4">
      <motion.button
        key={`button-${postId}-${id}`}
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.05 } }}
        className="flex absolute top-4 right-4 lg:hidden items-center justify-center bg-white dark:bg-zinc-800 rounded-full h-8 w-8 shadow-lg z-10"
        onClick={onClose}
      >
        <CloseIcon />
      </motion.button>
      
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Images */}
        {data.images.length > 0 && (
          <div className="relative">
            <img
              src={data.images[0]}
              alt="Post"
              className="w-full h-64 md:h-80 object-cover"
            />
            {data.images.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-2">
                {data.images.slice(1, 4).map((img, idx) => (
                  <a
                    key={idx}
                    href={img}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg hover:scale-110 transition-transform"
                  >
                    <img src={img} alt={`Image ${idx + 2}`} className="w-full h-full object-cover" />
                  </a>
                ))}
                {data.images.length > 4 && (
                  <div className="w-12 h-12 rounded-lg bg-black/70 flex items-center justify-center text-white text-sm font-semibold">
                    +{data.images.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Author Header */}
          <div className="flex justify-between items-start p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex gap-3">
              {data.authorProfilePicture ? (
                <img
                  src={data.authorProfilePicture}
                  alt={data.authorName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">{data.authorName.charAt(0)}</span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">
                  {data.authorName}
                </h3>
                {data.authorOccupation && (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">{data.authorOccupation}</p>
                )}
                <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-0.5 flex items-center gap-2">
                  {data.timeSincePosted && <span>{data.timeSincePosted}</span>}
                  {data.postedDate && (
                    <span>
                      · {data.postedDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {data.postUrl && (
              <motion.a
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                href={data.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm rounded-full font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-colors"
              >
                View on LinkedIn
              </motion.a>
            )}
          </div>

          {/* Post Text */}
          <div className="p-4">
            <div className="text-zinc-700 dark:text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-line max-h-[300px] overflow-auto pr-2 [scrollbar-width:thin]">
              {data.postText || <span className="text-zinc-400 italic">No text content</span>}
            </div>
          </div>

          {/* Engagement Stats */}
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                  </svg>
                  <span className="font-semibold">{data.likes.toLocaleString()}</span>
                  <span className="text-zinc-400">likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                  <span className="font-semibold">{data.comments.toLocaleString()}</span>
                  <span className="text-zinc-400">comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                  <span className="font-semibold">{data.shares.toLocaleString()}</span>
                  <span className="text-zinc-400">shares</span>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <CloseIcon />
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Section for top posts category
function TopPostsSection({ 
  title, 
  icon, 
  iconColor,
  posts, 
  highlight, 
  onPostClick 
}: { 
  title: string; 
  icon: React.ReactNode;
  iconColor: string;
  posts: LinkedInPost[]; 
  highlight: 'likes' | 'comments' | 'shares' | 'engagement';
  onPostClick: (post: LinkedInPost) => void;
}) {
  if (posts.length === 0) return null;

  return (
    <div className="mb-10">
      <h3 className={cn("text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2", iconColor)}>
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {posts.map((post, index) => {
          const postKey = getPostId(post) || `post-${index}`;
          
          return (
            <TopPostCard
              key={postKey}
              post={post}
              onClick={() => onPostClick(post)}
              rank={index + 1}
              highlight={highlight}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TopPostsPage() {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [topPostsData, setTopPostsData] = useState<TopPostsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<LinkedInPost | null>(null);

  // Handle escape key and body scroll
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePost(null);
      }
    }

    if (activePost) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePost]);

  const handleFetchTopPosts = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setError(null);
    setTopPostsData(null);

    try {
      const url = `/api/top-posts?url=${encodeURIComponent(profileUrl)}&limit=5`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        // Store the full error response for better error handling
        const errorData = {
          error: result.error || 'Failed to fetch top posts',
          message: result.message || result.error,
          guidelines: result.guidelines
        };
        throw new Error(JSON.stringify(errorData));
      }

      setTopPostsData(result.data);
      console.log('Top Posts Data:', result.data);
    } catch (err: unknown) {
      try {
        // Try to parse as JSON error with guidelines
        const errorData = JSON.parse(err instanceof Error ? err.message : '{}');
        if (errorData.guidelines || errorData.message) {
          // Store error data for display
          setError(JSON.stringify(errorData));
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } catch {
        // If not JSON, use the error message as is
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      console.error('Error fetching top posts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-400/20 dark:bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-orange-400/20 dark:bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-rose-400/15 dark:bg-rose-500/10 rounded-full blur-3xl" />
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
        )}
      </AnimatePresence>

      {/* Expanded Post Modal */}
      <AnimatePresence>
        {activePost && (
          <ExpandedPostModal post={activePost} onClose={() => setActivePost(null)} />
        )}
      </AnimatePresence>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Back Link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Home
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Top Performing Posts
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Discover the most liked, commented, and shared posts from any LinkedIn profile
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 mb-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
                LinkedIn Profile URL
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="https://www.linkedin.com/in/username"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchTopPosts();
                }
              }}
                  className="flex-1 h-12 text-base border-zinc-200 dark:border-zinc-700 focus:ring-amber-500"
                  disabled={loading}
                />
                <Button
                  onClick={handleFetchTopPosts}
                  disabled={loading || !profileUrl.trim()}
                  className="h-12 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium shadow-lg shadow-amber-500/25"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                      </svg>
                      Find Top Posts
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
            This feature works from stored data. Please fetch posts first using the Posts page.
          </p>
        </div>

        {/* Error */}
        {error && (() => {
          let errorObj: { error?: string; message?: string; guidelines?: any } = {};
          try {
            errorObj = JSON.parse(error);
          } catch {
            errorObj = { error, message: error };
          }
          
          const isNoDataError = errorObj.error?.includes('No posts') || 
                                errorObj.message?.includes('No posts') ||
                                errorObj.message?.includes('No data') ||
                                errorObj.message?.includes('fetch posts first');
          
          return (
            <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl max-w-2xl mx-auto">
              <div className="flex items-start gap-2 mb-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-700 dark:text-red-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-700 dark:text-red-300 text-sm font-medium mb-1">
                    {isNoDataError ? 'No Posts Found' : (errorObj.error || 'Error')}
                  </p>
                  {isNoDataError ? (
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      No posts data found for this user. Please fetch the profile and posts first.
                    </p>
                  ) : errorObj.message ? (
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {errorObj.message}
                    </p>
                  ) : null}
                </div>
              </div>
              {isNoDataError && (
                <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-3 font-medium">
                    This feature works from stored data. Please fetch the data first:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/">
                      <Button variant="outline" size="sm" className="text-xs">
                        Fetch Profile
                      </Button>
                    </Link>
                    <Link href="/posts">
                      <Button variant="outline" size="sm" className="text-xs">
                        Fetch Posts
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Results */}
        {topPostsData && topPostsData.totalPosts > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Aggregate Stats */}
            {topPostsData.aggregateStats && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      @{topPostsData.username}
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                      Analyzed {topPostsData.totalPosts} posts
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {topPostsData.aggregateStats.totalLikes.toLocaleString()}
                    </p>
                    <p className="text-xs text-rose-600/70 dark:text-rose-400/70">Total Likes</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {topPostsData.aggregateStats.totalComments.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Total Comments</p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                      {topPostsData.aggregateStats.totalShares.toLocaleString()}
                    </p>
                    <p className="text-xs text-violet-600/70 dark:text-violet-400/70">Total Shares</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {topPostsData.aggregateStats.avgLikes.toLocaleString()}
                    </p>
                    <p className="text-xs text-rose-600/70 dark:text-rose-400/70">Avg Likes</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {topPostsData.aggregateStats.avgComments.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Avg Comments</p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                      {topPostsData.aggregateStats.avgShares.toLocaleString()}
                    </p>
                    <p className="text-xs text-violet-600/70 dark:text-violet-400/70">Avg Shares</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top by Overall Engagement */}
            <TopPostsSection
              title="Top by Overall Engagement"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
              }
              iconColor="text-amber-500"
              posts={topPostsData.topByEngagement}
              highlight="engagement"
              onPostClick={setActivePost}
            />

            {/* Top by Likes */}
            <TopPostsSection
              title="Most Liked Posts"
              icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                </svg>
              }
              iconColor="text-rose-500"
              posts={topPostsData.topByLikes}
              highlight="likes"
              onPostClick={setActivePost}
            />

            {/* Top by Comments */}
            <TopPostsSection
              title="Most Commented Posts"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
              }
              iconColor="text-blue-500"
              posts={topPostsData.topByComments}
              highlight="comments"
              onPostClick={setActivePost}
            />

            {/* Top by Shares */}
            <TopPostsSection
              title="Most Shared Posts"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              }
              iconColor="text-violet-500"
              posts={topPostsData.topByShares}
              highlight="shares"
              onPostClick={setActivePost}
            />
          </motion.div>
        )}

        {/* Empty State */}
        {topPostsData && topPostsData.totalPosts === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto">
            <svg className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">No posts found for this user</p>
            <div className="max-w-md mx-auto p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-2">
                This feature works from stored data
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                Please fetch the profile and posts first using the links below:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/">
                  <Button variant="outline" size="sm" className="text-xs">
                    Fetch Profile
                  </Button>
                </Link>
                <Link href="/posts">
                  <Button variant="outline" size="sm" className="text-xs">
                    Fetch Posts
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Initial State */}
        {!topPostsData && !loading && !error && (
          <div className="text-center py-16 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 max-w-2xl mx-auto">
            <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">Enter a LinkedIn profile URL to find their top posts</p>
            
            {/* Info Note */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
                📝 Note: This feature works from stored data
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Top posts are determined from posts data that have already been fetched and stored. 
                If you haven't fetched posts yet, please do so first using the{' '}
                <Link href="/posts" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-200">
                  Posts
                </Link>{' '}
                page.
              </p>
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">We&apos;ll analyze their posts and show the best performers</p>
          </div>
        )}
      </div>
    </div>
  );
}

