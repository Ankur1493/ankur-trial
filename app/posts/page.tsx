'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useOutsideClick } from '@/hooks/use-outside-click';

// Post interfaces matching actual Apify response
interface PostAuthor {
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
  // Post identifiers
  urn?: string;
  shareUrn?: string;
  url?: string;
  inputUrl?: string;
  
  // Post content
  type?: string;
  text?: string;
  images?: string[];
  
  // Timing
  timeSincePosted?: string;
  postedAtTimestamp?: number;
  postedAtISO?: string;
  
  // Author info (flat)
  authorName?: string;
  authorProfileId?: string;
  authorProfilePicture?: string;
  authorProfileUrl?: string;
  authorUrn?: string;
  authorType?: string;
  
  // Author info (nested)
  author?: PostAuthor;
  
  // Engagement stats
  numLikes?: number;
  numComments?: number;
  numShares?: number;
  
  // Post settings/permissions
  canReact?: boolean;
  canPostComments?: boolean;
  canShare?: boolean;
  commentingDisabled?: boolean;
  shareAudience?: string;
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

// Helper function to get post data
function getPostData(post: LinkedInPost) {
  const authorName = post.authorName || 
    (post.author?.firstName && post.author?.lastName 
      ? `${post.author.firstName} ${post.author.lastName}` 
      : 'Unknown Author');
  const authorOccupation = post.author?.occupation || '';
  const authorProfileUrl = post.authorProfileUrl;
  const authorProfilePicture = post.authorProfilePicture || post.author?.picture;
  const authorType = post.authorType || 'Person';
  const authorProfileId = post.authorProfileId || post.author?.publicId;
  const postUrl = post.url;
  const likes = post.numLikes ?? 0;
  const comments = post.numComments ?? 0;
  const shares = post.numShares ?? 0;
  const postText = post.text || '';
  const images = post.images || [];
  const postType = post.type || 'text';
  const timeSincePosted = post.timeSincePosted;
  const postedDate = post.postedAtISO ? new Date(post.postedAtISO) : 
    (post.postedAtTimestamp ? new Date(post.postedAtTimestamp) : null);
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

// Post Card Grid Item (Compact view)
function PostCardCompact({ post, onClick }: { post: LinkedInPost; onClick: () => void }) {
  const id = useId();
  const data = getPostData(post);
  const truncatedText = data.postText.length > 120 ? `${data.postText.substring(0, 120)}...` : data.postText;

  return (
    <motion.div
      layoutId={`card-${post.urn}-${id}`}
      onClick={onClick}
      className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group"
    >
      {/* Image */}
      {data.images.length > 0 && (
        <motion.div layoutId={`image-${post.urn}-${id}`} className="relative">
          <img
            src={data.images[0]}
            alt="Post"
            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {data.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
              +{data.images.length - 1}
            </div>
          )}
        </motion.div>
      )}

      <div className="p-3">
        {/* Author Row */}
        <div className="flex items-center gap-2 mb-2">
          {data.authorProfilePicture ? (
            <img
              src={data.authorProfilePicture}
              alt={data.authorName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">{data.authorName.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <motion.h3
              layoutId={`title-${post.urn}-${id}`}
              className="font-semibold text-zinc-900 dark:text-white text-sm truncate"
            >
              {data.authorName}
            </motion.h3>
            <motion.p
              layoutId={`time-${post.urn}-${id}`}
              className="text-zinc-400 dark:text-zinc-500 text-xs"
            >
              {data.timeSincePosted || (data.postedDate ? format(data.postedDate, 'MMM d') : '')}
            </motion.p>
          </div>
        </div>

        {/* Post Text Preview */}
        {truncatedText && (
          <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed line-clamp-3">
            {truncatedText}
          </p>
        )}

        {/* Engagement Stats */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
            </svg>
            <span>{data.likes.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
            </svg>
            <span>{data.comments.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
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

  useOutsideClick(ref, onClose);

  return (
    <div className="fixed inset-0 grid place-items-center z-[100] p-4">
      <motion.button
        key={`button-${post.urn}-${id}`}
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
        layoutId={`card-${post.urn}-${id}`}
        ref={ref}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Images */}
        {data.images.length > 0 && (
          <motion.div layoutId={`image-${post.urn}-${id}`} className="relative">
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
          </motion.div>
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">{data.authorName.charAt(0)}</span>
                </div>
              )}
              <div>
                <motion.h3
                  layoutId={`title-${post.urn}-${id}`}
                  className="font-semibold text-zinc-900 dark:text-white"
                >
                  {data.authorName}
                </motion.h3>
                {data.authorOccupation && (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">{data.authorOccupation}</p>
                )}
                <motion.p
                  layoutId={`time-${post.urn}-${id}`}
                  className="text-zinc-400 dark:text-zinc-500 text-xs mt-0.5 flex items-center gap-2"
                >
                  {data.timeSincePosted && <span>{data.timeSincePosted}</span>}
                  {data.postedDate && (
                    <span>
                      · {data.postedDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                  {data.shareAudience && (
                    <span className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium rounded",
                      data.shareAudience === 'PUBLIC' 
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                        : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                    )}>
                      {data.shareAudience}
                    </span>
                  )}
                </motion.p>
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
                className="px-4 py-2 text-sm rounded-full font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-colors"
              >
                View on LinkedIn
              </motion.a>
            )}
          </div>

          {/* Post Text */}
          <div className="p-4">
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-zinc-700 dark:text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-line max-h-[300px] overflow-auto pr-2 [scrollbar-width:thin]"
            >
              {data.postText || <span className="text-zinc-400 italic">No text content</span>}
            </motion.div>
          </div>

          {/* Engagement Stats */}
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                  </svg>
                  <span className="font-semibold">{data.likes.toLocaleString()}</span>
                  <span className="text-zinc-400">likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                  <span className="font-semibold">{data.comments.toLocaleString()}</span>
                  <span className="text-zinc-400">comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

export default function PostsPage() {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [postsData, setPostsData] = useState<LinkedInPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrapeUntil, setScrapeUntil] = useState<Date | undefined>(undefined);
  const [activePost, setActivePost] = useState<LinkedInPost | null>(null);
  const [sortBy, setSortBy] = useState<'likes' | 'comments' | 'shares' | null>(null);

  // Sorted posts based on selected criteria
  const sortedPosts = postsData ? [...postsData].sort((a, b) => {
    if (!sortBy) return 0;
    const aData = getPostData(a);
    const bData = getPostData(b);
    if (sortBy === 'likes') return bData.likes - aData.likes;
    if (sortBy === 'comments') return bData.comments - aData.comments;
    if (sortBy === 'shares') return bData.shares - aData.shares;
    return 0;
  }) : null;

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

  const handleFetchPosts = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setError(null);
    setPostsData(null);

    try {
      let url = `/api/posts?urls=${encodeURIComponent(profileUrl)}`;
      
      if (scrapeUntil) {
        url += `&scrapeUntil=${scrapeUntil.toISOString()}`;
      }

      const response = await fetch(url);
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      let result;
      if (isJson) {
        try {
          result = await response.json();
        } catch (parseError) {
          const text = await response.text();
          throw new Error(`Invalid response format: ${text.substring(0, 100)}`);
        }
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to fetch posts');
      }

      const posts = Array.isArray(result.data) ? result.data : [result.data];
      setPostsData(posts);
      console.log('LinkedIn Posts:', posts);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-3xl" />
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

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        {/* Back Link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Profile Viewer
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            LinkedIn Posts Scraper
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Fetch and explore LinkedIn posts beautifully
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 mb-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
                LinkedIn Profile URL
              </label>
              <Input
                type="text"
                placeholder="https://www.linkedin.com/in/username"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFetchPosts();
                  }
                }}
                className="h-12 text-base border-zinc-200 dark:border-zinc-700 focus:ring-emerald-500"
                disabled={loading}
              />
            </div>

            {/* Date Picker and Button Row */}
            <div className="flex flex-wrap gap-3 items-end">
              {/* Scrape Until Date Picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Scrape Until Date (optional)
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] h-10 justify-start text-left font-normal",
                        !scrapeUntil && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scrapeUntil ? format(scrapeUntil, "MMM dd, yyyy") : "How far back?"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scrapeUntil}
                      onSelect={setScrapeUntil}
                      disabled={(date) => date > new Date()}
                    />
                    {scrapeUntil && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setScrapeUntil(undefined)}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fetch Posts Button */}
              <Button
                onClick={handleFetchPosts}
                disabled={loading || !profileUrl.trim()}
                className="h-10 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-500/25 flex-1 sm:flex-none"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Fetching...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Fetch Posts (100)
                  </span>
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
            Leave date empty to fetch the most recent 100 posts. Select a date to scrape posts back to that date.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl max-w-2xl mx-auto">
            <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Posts Results - 3 Column Grid */}
        {postsData && postsData.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Posts
                </h2>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                  {postsData.length} posts
                </span>
              </div>
              
              {/* Sorting Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-1">Sort by:</span>
                <Button
                  variant={sortBy === 'likes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sortBy === 'likes' ? null : 'likes')}
                  className={cn(
                    "h-8 px-3 text-xs font-medium transition-all",
                    sortBy === 'likes' 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                      : "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                  )}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
                  </svg>
                  Likes
                </Button>
                <Button
                  variant={sortBy === 'comments' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sortBy === 'comments' ? null : 'comments')}
                  className={cn(
                    "h-8 px-3 text-xs font-medium transition-all",
                    sortBy === 'comments' 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                      : "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                  )}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                  </svg>
                  Comments
                </Button>
                <Button
                  variant={sortBy === 'shares' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sortBy === 'shares' ? null : 'shares')}
                  className={cn(
                    "h-8 px-3 text-xs font-medium transition-all",
                    sortBy === 'shares' 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                      : "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                  )}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                  Shares
                </Button>
              </div>
            </div>
            
            {/* 3 Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPosts?.map((post, index) => (
                <PostCardCompact
                  key={post.urn || post.shareUrn || index}
                  post={post}
                  onClick={() => setActivePost(post)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Posts Empty State */}
        {postsData && postsData.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto">
            <svg className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400">No posts found</p>
          </div>
        )}

        {/* Initial State */}
        {!postsData && !loading && !error && (
          <div className="text-center py-16 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 max-w-2xl mx-auto">
            <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Enter a LinkedIn profile URL to fetch posts</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Example: linkedin.com/in/username</p>
          </div>
        )}
      </div>
    </div>
  );
}
