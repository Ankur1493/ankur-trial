'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  AlertTriangle, 
  ArrowLeft,
  Sparkles,
  UserCircle,
  Briefcase,
  Heart,
  BookOpen,
  Award,
  Target
} from 'lucide-react';

interface UserInsightsResponse {
  success: boolean;
  username: string;
  postCount: number;
  hasProfile: boolean;
  profileName: string | null;
  userInsights: {
    role: string | null;
    company: string | null;
    interests: string[] | null;
    topics: string[] | null;
    expertise: string[] | null;
    background: string | null;
    achievements: string[] | null;
    values: string[] | null;
  };
  generatedAt: string;
  error?: string;
  message?: string;
}

interface CheckResponse {
  success?: boolean;
  username?: string;
  postCount?: number;
  hasProfile?: boolean;
  profileName?: string | null;
  meetsThreshold?: boolean;
  threshold?: number;
  error?: string;
  message?: string;
}

export default function UserInsightsPage() {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkData, setCheckData] = useState<CheckResponse | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [userInsightsData, setUserInsightsData] = useState<UserInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract username from input
  const extractUsername = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1].toLowerCase() : trimmed.toLowerCase();
  };

  // Helper function to safely parse JSON responses
  const safeJsonParse = async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (!isJson) {
      const text = await response.text();
      return {
        success: false,
        error: 'Invalid response format',
        message: text.substring(0, 200)
      };
    }

    try {
      return await response.json();
    } catch (parseError) {
      const text = await response.text();
      return {
        success: false,
        error: 'Failed to parse JSON response',
        message: text.substring(0, 200)
      };
    }
  };

  // Check data availability
  const handleCheck = async () => {
    const username = extractUsername(linkedinUrl);
    if (!username) {
      setError('Please enter a LinkedIn URL or username');
      return;
    }

    setLoading(true);
    setError(null);
    setUserInsightsData(null);

    try {
      const response = await fetch(`/api/identity/check?username=${encodeURIComponent(username)}`);
      const data: CheckResponse = await safeJsonParse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.profileName || data.error || data.message || 'Failed to check data');
      }

      setCheckData(data);

      // If no data at all (0 posts and no profile), show error directly
      if ((data.postCount ?? 0) === 0 && !data.hasProfile) {
        setError(`No data found for @${username}. Please fetch the profile and posts first using the Profile and Posts pages.`);
        return;
      }

      // User insights can work with less data, so we proceed directly
      await generateUserInsights(username, false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check data availability';
      // Enhance error message if it's a "no data" error
      if (errorMsg.includes('not found') || errorMsg.includes('No data')) {
        setError(`${errorMsg}. Please fetch the profile and posts first using the Profile and Posts pages.`);
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Generate user insights
  const generateUserInsights = async (username: string, force: boolean) => {
    setLoading(true);
    setError(null);
    setShowWarningModal(false);

    try {
      const url = `/api/user-insights?username=${encodeURIComponent(username)}${force ? '&force=true' : ''}`;
      const response = await fetch(url);
      const data: UserInsightsResponse = await safeJsonParse(response);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate user insights');
      }

      setUserInsightsData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate user insights';
      // Enhance error message if it's a "no data" error
      if (errorMsg.includes('not found') || errorMsg.includes('No data') || errorMsg.includes('Insufficient')) {
        setError(`${errorMsg}. Please fetch the profile and posts first using the Profile and Posts pages.`);
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle force generate from modal
  const handleForceGenerate = () => {
    const username = extractUsername(linkedinUrl);
    generateUserInsights(username, true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-rose-500" />
            User Insights
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">Extract User Insights</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Enter a LinkedIn profile URL or username to extract factual insights about the user's role, interests, expertise, and more.
          </p>
          
          {/* Info Note */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
              📝 Note: This feature works from stored data
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              This analysis uses profile and posts data that have already been fetched and stored. 
              If you haven't fetched the profile and posts yet, please do so first using the{' '}
              <Link href="/" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-200">
                Profile
              </Link>{' '}
              and{' '}
              <Link href="/posts" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-200">
                Posts
              </Link>{' '}
              pages.
            </p>
          </div>

          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="linkedin.com/in/username or just username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleCheck()}
            />
            <Button 
              onClick={handleCheck} 
              disabled={loading || !linkedinUrl.trim()}
              className="min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-700 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-400 text-sm flex-1">{error}</p>
              </div>
              {(error.includes('No data found') || error.includes('not found') || error.includes('No data')) && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-red-200 dark:border-red-900">
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
              )}
            </div>
          )}
        </div>

        {/* Results Section */}
        {userInsightsData && userInsightsData.success && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {userInsightsData.profileName || userInsightsData.username}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    @{userInsightsData.username}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Analyzed from <span className="font-medium text-foreground">{userInsightsData.postCount}</span> posts
                  </p>
                </div>
              </div>
            </div>

            {/* User Insights */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Accordion type="multiple" defaultValue={['professional', 'interests', 'background']} className="w-full">
                {/* Professional Info */}
                {(userInsightsData.userInsights.role || userInsightsData.userInsights.company) && (
                  <AccordionItem value="professional" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Briefcase className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">Professional</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="pl-11 pt-2 space-y-4">
                        {userInsightsData.userInsights.role && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1.5">Role</p>
                            <p className="text-sm text-foreground">{userInsightsData.userInsights.role}</p>
                          </div>
                        )}
                        {userInsightsData.userInsights.company && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1.5">Company</p>
                            <p className="text-sm text-foreground">{userInsightsData.userInsights.company}</p>
                          </div>
                        )}
                        {userInsightsData.userInsights.expertise && userInsightsData.userInsights.expertise.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Expertise</p>
                            <div className="flex flex-wrap gap-2">
                              {userInsightsData.userInsights.expertise.map((item, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Interests & Topics */}
                {(userInsightsData.userInsights.interests || userInsightsData.userInsights.topics) && (
                  <AccordionItem value="interests" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">Interests & Topics</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="pl-11 pt-2 space-y-4">
                        {userInsightsData.userInsights.interests && userInsightsData.userInsights.interests.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Interests</p>
                            <div className="flex flex-wrap gap-2">
                              {userInsightsData.userInsights.interests.map((item, idx) => (
                                <Badge key={idx} variant="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {userInsightsData.userInsights.topics && userInsightsData.userInsights.topics.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Topics</p>
                            <div className="flex flex-wrap gap-2">
                              {userInsightsData.userInsights.topics.map((item, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Background */}
                {userInsightsData.userInsights.background && (
                  <AccordionItem value="background" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">Background</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="pl-11 pt-2">
                        <p className="text-sm text-foreground leading-relaxed">
                          {userInsightsData.userInsights.background}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Achievements */}
                {userInsightsData.userInsights.achievements && userInsightsData.userInsights.achievements.length > 0 && (
                  <AccordionItem value="achievements" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Award className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">Achievements</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="pl-11 pt-2">
                        <ul className="space-y-2">
                          {userInsightsData.userInsights.achievements.map((achievement, idx) => (
                            <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-rose-500 mt-1">•</span>
                              <span>{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Values */}
                {userInsightsData.userInsights.values && userInsightsData.userInsights.values.length > 0 && (
                  <AccordionItem value="values" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Target className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">Values</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="pl-11 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {userInsightsData.userInsights.values.map((value, idx) => (
                            <Badge key={idx} variant="outline" className="text-sm">
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>

            {/* Generated timestamp */}
            <p className="text-center text-xs text-muted-foreground">
              Generated on {new Date(userInsightsData.generatedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !userInsightsData && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <UserCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No user insights yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Enter a LinkedIn username above to extract factual insights about their role, 
              interests, expertise, and background.
            </p>
          </div>
        )}
      </main>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Limited Data Available
            </DialogTitle>
            <DialogDescription className="pt-2">
              {checkData && (
                <div className="space-y-3">
                  <p>
                    We found only <span className="font-semibold text-foreground">{checkData.postCount} posts</span> for 
                    {checkData.profileName ? (
                      <span className="font-semibold text-foreground"> {checkData.profileName}</span>
                    ) : (
                      <span className="font-semibold text-foreground"> @{checkData.username}</span>
                    )}.
                  </p>
                  <p>
                    For more accurate user insights, we recommend at least <span className="font-semibold text-foreground">{checkData.threshold} posts</span>.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowWarningModal(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleForceGenerate}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Force Generate Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

