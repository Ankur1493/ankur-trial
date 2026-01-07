'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatsClient } from './stats-client';

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
    const formData = new FormData(e.currentTarget);
    const usernameValue = formData.get('username') as string;
    if (usernameValue) {
      router.push(`/stats?username=${encodeURIComponent(usernameValue)}`);
    }
  };

  if (!username) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Analytics & Aggregations
            </h1>
            <p className="text-slate-400 text-lg mb-4">
              Enter a LinkedIn username to view their engagement analytics
            </p>
            <div className="max-w-md mx-auto mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300 font-medium mb-1">
                📝 Note: This feature works from stored data
              </p>
              <p className="text-xs text-blue-400">
                These analytics use posts data that have already been fetched and stored. 
                If you haven't fetched posts yet, please do so first using the{' '}
                <Link href="/posts" className="underline font-medium hover:text-blue-200">
                  Posts
                </Link>{' '}
                page.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
              <input
                type="text"
                name="username"
                placeholder="e.g. jakezward"
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder:text-slate-500 transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold transition-all shadow-lg shadow-amber-500/25"
              >
                View Stats
              </button>
            </form>
            <p className="text-sm text-slate-500 mt-6">
              Available users: <span className="text-slate-400">jakezward</span>, <span className="text-slate-400">ankursharma14</span>, <span className="text-slate-400">rob-hoffman-ceo</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
              <svg className="w-10 h-10 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Loading Stats...</h1>
            <p className="text-slate-400">Fetching analytics for @{username}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 border border-red-500/30">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Error Loading Stats</h1>
            <p className="text-slate-400 text-lg mb-4">{error}</p>
            <Link
              href="/stats"
              className="inline-block px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="container mx-auto px-6 py-12">
          <Link 
            href="/stats" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stats
          </Link>
          <div className="max-w-2xl mx-auto text-center py-24">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 border border-red-500/30">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">User Not Found</h1>
            <p className="text-slate-400 text-lg mb-4">
              No data found for user <span className="text-white font-semibold">&quot;{username}&quot;</span>
            </p>
            <p className="text-slate-500 mb-4">
              This endpoint works from stored data. You need to fetch posts for this user first.
            </p>
            <div className="max-w-md mx-auto mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
              <p className="text-sm text-blue-300 font-medium mb-2">Guidelines:</p>
              <ol className="text-xs text-blue-400 space-y-1 list-decimal list-inside">
                <li>Fetch posts: Use the <Link href="/posts" className="underline font-medium hover:text-blue-200">Posts page</Link> or API endpoint <code className="bg-slate-800 px-1 rounded">GET /api/posts?urls=linkedin.com/in/{username}</code></li>
                <li>Then retry: Return to this stats page with the username</li>
              </ol>
            </div>
            <div className="flex gap-4 justify-center">
              <Link
                href="/posts"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-semibold transition-all shadow-lg shadow-amber-500/25"
              >
                Generate Posts
              </Link>
              <Link
                href="/stats"
                className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
              >
                Try Another User
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
          <div className="container mx-auto px-6 py-12">
            <Link 
              href="/stats" 
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Stats
            </Link>
            <div className="max-w-2xl mx-auto text-center py-24">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
                <svg className="w-10 h-10 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
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

