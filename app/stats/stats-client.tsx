'use client';

import Link from 'next/link';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

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
}

const chartConfig = {
  likes: {
    label: 'Likes',
    color: 'hsl(45, 93%, 47%)',
  },
  comments: {
    label: 'Comments',
    color: 'hsl(199, 89%, 48%)',
  },
  reposts: {
    label: 'Reposts',
    color: 'hsl(142, 71%, 45%)',
  },
  engagement: {
    label: 'Engagement',
    color: 'hsl(280, 87%, 65%)',
  },
  posts: {
    label: 'Posts',
    color: 'hsl(0, 84%, 60%)',
  },
  cumulativeEngagement: {
    label: 'Cumulative',
    color: 'hsl(320, 87%, 55%)',
  },
} satisfies ChartConfig;

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function StatsClient({
  username,
  totals,
  byDate,
  history,
}: {
  username: string;
  totals: TotalsData;
  byDate: ByDateData;
  history: HistoryData;
}) {
  const stats = [
    { label: 'Total Likes', value: totals.totals?.totalLikes || 0, icon: '❤️', gradient: 'from-amber-500 to-orange-600' },
    { label: 'Total Comments', value: totals.totals?.totalComments || 0, icon: '💬', gradient: 'from-sky-500 to-blue-600' },
    { label: 'Total Reposts', value: totals.totals?.totalReposts || 0, icon: '🔄', gradient: 'from-emerald-500 to-green-600' },
    { label: 'Total Engagement', value: totals.totals?.totalEngagement || 0, icon: '📊', gradient: 'from-violet-500 to-purple-600' },
  ];

  const averages = [
    { label: 'Avg Likes/Post', value: totals.averages?.avgLikes || 0 },
    { label: 'Avg Comments/Post', value: totals.averages?.avgComments || 0 },
    { label: 'Avg Reposts/Post', value: totals.averages?.avgReposts || 0 },
    { label: 'Avg Engagement/Post', value: totals.averages?.avgEngagement || 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link 
              href="/stats" 
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Stats
            </Link>
            <h1 className="text-4xl font-bold">
              Analytics for <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">@{username}</span>
            </h1>
            <p className="text-slate-400 mt-2">
              {totals.postCount} posts analyzed
            </p>
          </div>
        </div>

        {/* Disclaimer Note */}
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-amber-200 font-medium text-sm">Note about data</p>
              <p className="text-amber-200/70 text-sm mt-1">
                These metrics show engagement totals grouped by <strong>when posts were published</strong>, not when the engagement occurred. 
                Real-time daily engagement tracking requires periodic data snapshots (not yet implemented).
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 backdrop-blur-sm"
            >
              <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${stat.gradient}`} />
              <div className="relative">
                <span className="text-3xl mb-2 block">{stat.icon}</span>
                <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold font-mono tracking-tight">
                  {formatNumber(stat.value)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Averages */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {averages.map((avg) => (
            <div
              key={avg.label}
              className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center backdrop-blur-sm"
            >
              <p className="text-slate-500 text-xs mb-1">{avg.label}</p>
              <p className="text-xl font-semibold font-mono">
                {formatNumber(avg.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Engagement by Post Date - Area Chart */}
          {byDate.data && byDate.data.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-1">Engagement by Post Date</h3>
              <p className="text-slate-500 text-sm mb-4">Total engagement for posts published on each date</p>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={byDate.data} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 14%, 25%)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                    tickFormatter={formatNumber}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="likes"
                    stackId="1"
                    stroke="var(--color-likes)"
                    fill="var(--color-likes)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="comments"
                    stackId="1"
                    stroke="var(--color-comments)"
                    fill="var(--color-comments)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="reposts"
                    stackId="1"
                    stroke="var(--color-reposts)"
                    fill="var(--color-reposts)"
                    fillOpacity={0.6}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            </div>
          )}

          {/* Monthly Engagement - Bar Chart */}
          {history.data && history.data.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-1">Monthly Engagement</h3>
              <p className="text-slate-500 text-sm mb-4">Engagement breakdown by month of publication</p>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={history.data} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 14%, 25%)" />
                  <XAxis 
                    dataKey="monthName" 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                    tickFormatter={formatNumber}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="likes" fill="var(--color-likes)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comments" fill="var(--color-comments)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reposts" fill="var(--color-reposts)" radius={[4, 4, 0, 0]} />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {/* Posting Frequency */}
          {history.data && history.data.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-1">Posting Frequency</h3>
              <p className="text-slate-500 text-sm mb-4">Number of posts published per month</p>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={history.data} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 14%, 25%)" />
                  <XAxis 
                    dataKey="monthName" 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="posts" fill="var(--color-posts)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {/* Cumulative Engagement Growth - Line Chart */}
          {history.data && history.data.length > 0 && (
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-1">Cumulative Engagement</h3>
              <p className="text-slate-500 text-sm mb-4">Running total of all engagement over time</p>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <LineChart data={history.data} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 14%, 25%)" />
                  <XAxis 
                    dataKey="monthName" 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(215, 14%, 55%)', fontSize: 11 }}
                    tickFormatter={formatNumber}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeEngagement" 
                    stroke="var(--color-cumulativeEngagement)" 
                    strokeWidth={3}
                    dot={{ fill: 'var(--color-cumulativeEngagement)', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

