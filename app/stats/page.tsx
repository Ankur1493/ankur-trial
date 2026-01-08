'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { StatsClient } from './stats-client';

// Zod schema for LinkedIn URL validation
const linkedInUrlSchema = z.string()
  .min(1, 'LinkedIn URL is required')
  .refine(
    (val) => {
      const linkedinPattern = /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^\/\?\s]+)\/?$/i;
      return linkedinPattern.test(val.trim());
    },
    { message: 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)' }
  );

// Helper to extract username from validated LinkedIn URL
function extractUsernameFromUrl(url: string): string {
  const match = url.trim().match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^\/\?\s]+)/i);
  return match ? match[1].toLowerCase() : '';
}

interface TotalsData {
  success?: boolean;
  username?: string;
  postCount?: number;
  totals?: {
    totalLikes: number;
    totalComments: number;
    totalReposts: number;
    totalEngagement: number;
  };
  averages?: {
    avgLikes: number;
    avgComments: number;
    avgReposts: number;
    avgEngagement: number;
  };
  userNotFound?: boolean;
  message?: string;
  error?: string;
}

interface ByDateData {
  success?: boolean;
  data?: Array<{
    date: string;
    likes: number;
    comments: number;
    reposts: number;
    posts: number;
    engagement: number;
  }>;
  userNotFound?: boolean;
  error?: string;
}

interface HistoryData {
  success?: boolean;
  data?: Array<{
    month: string;
    monthName: string;
    likes: number;
    comments: number;
    reposts: number;
    posts: number;
    engagement: number;
    cumulativeEngagement: number;
  }>;
  userNotFound?: boolean;
  error?: string;
}

async function fetchStats(username: string): Promise<{
  totals: TotalsData;
  byDate: ByDateData;
  history: HistoryData;
}> {
  const baseUrl = window.location.origin;
  
  // Helper function to safely parse JSON responses
  async function safeJsonParse(response: Response): Promise<any> {
    if (!response.ok) {
      const text = await response.text();
      try {
        // Try to parse as JSON first
        return JSON.parse(text);
      } catch {
        // If not JSON, return error object
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: text.substring(0, 200) // Limit error message length
        };
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        error: 'Invalid response format',
        message: text.substring(0, 200)
      };
    }

    try {
      return await response.json();
    } catch (error) {
      const text = await response.text();
      return {
        success: false,
        error: 'Failed to parse JSON response',
        message: text.substring(0, 200)
      };
    }
  }
  
  // Fetch all 3 routes in parallel using Promise.all
  const [totalsRes, byDateRes, historyRes] = await Promise.all([
    fetch(`${baseUrl}/api/stats/totals?username=${username}`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/stats/by-date?username=${username}`, { cache: 'no-store' }),
    fetch(`${baseUrl}/api/stats/history?username=${username}`, { cache: 'no-store' }),
  ]);

  const [totals, byDate, history] = await Promise.all([
    safeJsonParse(totalsRes),
    safeJsonParse(byDateRes),
    safeJsonParse(historyRes),
  ]);

  return { totals, byDate, history };
}

function StatsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username');
  
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<TotalsData | null>(null);
  const [byDate, setByDate] = useState<ByDateData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      setLoading(true);
      setError(null);
      fetchStats(username)
        .then((data) => {
          setTotals(data.totals);
          setByDate(data.byDate);
          setHistory(data.history);
        })
        .catch((err) => {
          setError(err.message || 'Failed to fetch stats');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [username]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);
    
    const formData = new FormData(e.currentTarget);
    const urlValue = formData.get('linkedinUrl') as string;
    
    // Validate using Zod
    const result = linkedInUrlSchema.safeParse(urlValue);
    
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message || 'Invalid LinkedIn URL');
      return;
    }
    
    // Extract username from validated URL
    const extractedUsername = extractUsernameFromUrl(urlValue);
    if (extractedUsername) {
      router.push(`/stats?username=${encodeURIComponent(extractedUsername)}`);
    }
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6 border border-amber-300">
              <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Analytics & Aggregations
            </h1>
            <p className="text-slate-600 text-lg mb-4">
              Enter a LinkedIn profile URL to view engagement analytics
            </p>
            <div className="max-w-md mx-auto mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 font-medium mb-1">
                📝 Note: This feature works from stored data
              </p>
              <p className="text-xs text-blue-600">
                These analytics use posts data that have already been fetched and stored. 
                If you haven&apos;t fetched posts yet, please do so first using the{' '}
                <Link href="/posts" className="underline font-medium hover:text-blue-800">
                  Posts
                </Link>{' '}
                page.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
              <div className="flex gap-3">
                <input
                  type="url"
                  name="linkedinUrl"
                  placeholder="https://linkedin.com/in/username"
                  className={`flex-1 px-4 py-3 rounded-xl bg-white border ${validationError ? 'border-red-400' : 'border-slate-300'} focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-slate-900 placeholder:text-slate-400 transition-all shadow-sm`}
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold transition-all shadow-lg shadow-amber-500/25"
                >
                  View Stats
                </button>
              </div>
              {validationError && (
                <p className="text-red-500 text-sm mt-2 text-left">{validationError}</p>
              )}
            </form>
            <p className="text-sm text-slate-500 mt-6">
              Example: <span className="text-slate-700">https://linkedin.com/in/jakezward</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6 border border-amber-300">
              <svg className="w-10 h-10 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Loading Stats...</h1>
            <p className="text-slate-600">Fetching analytics for {username}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 border border-red-300">
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Error Loading Stats</h1>
            <p className="text-slate-600 text-lg mb-4">{error}</p>
            <Link
              href="/stats"
              className="inline-block px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if user not found
  if (totals?.userNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 border border-red-300">
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Profile Not Found</h1>
            <p className="text-slate-600 text-lg mb-4">
              No data found for <span className="text-slate-900 font-semibold">{username}</span>
            </p>
            <p className="text-slate-500 mb-4">
              This endpoint works from stored data. You need to fetch posts for this profile first.
            </p>
            <div className="max-w-md mx-auto mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-sm text-blue-700 font-medium mb-2">Guidelines:</p>
              <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                <li>Fetch posts: Use the <Link href="/posts" className="underline font-medium hover:text-blue-800">Posts page</Link> or API endpoint <code className="bg-slate-200 px-1 rounded">GET /api/posts?urls=linkedin.com/in/{username}</code></li>
                <li>Then retry: Return to this stats page with the LinkedIn URL</li>
              </ol>
            </div>
            <div className="flex gap-4 justify-center">
              <Link
                href="/posts"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold transition-all shadow-lg shadow-amber-500/25"
              >
                Generate Posts
              </Link>
              <Link
                href="/stats"
                className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
              >
                Try Another Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have data but postCount is 0 (data inconsistency)
  if (totals && totals.success && totals.postCount === 0 && !totals.userNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6 border border-amber-300">
              <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">No Posts Found</h1>
            <p className="text-slate-600 text-lg mb-4">
              Metadata exists for <span className="text-slate-900 font-semibold">{username}</span>, but no posts were found when filtering.
            </p>
            <p className="text-slate-500 mb-4">
              This might indicate a data inconsistency. Please try refreshing the posts data.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/posts"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold transition-all shadow-lg shadow-amber-500/25"
              >
                Refresh Posts Data
              </Link>
              <Link
                href="/stats"
                className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
              >
                Try Another Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!totals || !byDate || !history) {
    return null;
  }

  return (
    <StatsClient
      username={username}
      totals={totals}
      byDate={byDate}
      history={history}
    />
  );
}

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
          <div className="container mx-auto px-6 py-12">
            <Link 
              href="/stats" 
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Stats
            </Link>
            <div className="max-w-2xl mx-auto text-center py-24">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6 border border-amber-300">
                <svg className="w-10 h-10 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-4">Loading...</h1>
            </div>
          </div>
        </div>
      }
    >
      <StatsPageContent />
    </Suspense>
  );
}

