'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
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
  PenTool,
  FileText,
  Copy,
  CheckCircle2
} from 'lucide-react';

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

interface WritingStyleResponse {
  success: boolean;
  username: string;
  postCount: number;
  hasProfile: boolean;
  profileName: string | null;
  writingStyle: {
    tone: string | null;
    format: string | null;
    averageLength: string | null;
    hooks: string | null;
    ctas: string | null;
    emojiUsage: string | null;
    structure: string | null;
    commonPatterns: string | null;
    samplePosts: string[];
  };
  generatedAt: string;
  error?: string;
  message?: string;
}

interface CheckResponse {
  success: boolean;
  username: string;
  postCount: number;
  hasProfile: boolean;
  profileName: string | null;
  meetsThreshold: boolean;
  threshold: number;
}

export default function WritingStylePage() {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkData, setCheckData] = useState<CheckResponse | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [writingStyleData, setWritingStyleData] = useState<WritingStyleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Extract username from LinkedIn URL
  const extractUsername = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1].toLowerCase() : '';
  };

  // Check data availability
  const handleCheck = async () => {
    setValidationError(null);
    
    // Validate using Zod
    const result = linkedInUrlSchema.safeParse(linkedinUrl);
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message || 'Invalid LinkedIn URL');
      return;
    }
    
    const username = extractUsername(linkedinUrl);
    if (!username) {
      setValidationError('Could not extract username from URL');
      return;
    }

    setLoading(true);
    setError(null);
    setWritingStyleData(null);

    try {
      const response = await fetch(`/api/identity/check?username=${encodeURIComponent(username)}`);
      const data: CheckResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.profileName || 'Failed to check data');
      }

      setCheckData(data);

      // If no data at all (0 posts and no profile), show error directly
      if (data.postCount === 0 && !data.hasProfile) {
        setError(`No data found for @${username}. Please fetch the profile and posts first using the Profile and Posts pages.`);
        return;
      }

      if (!data.meetsThreshold) {
        // Show warning modal for insufficient data
        setShowWarningModal(true);
      } else {
        // Proceed directly to generate
        await generateWritingStyle(username, false);
      }
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

  // Generate writing style
  const generateWritingStyle = async (username: string, force: boolean) => {
    setLoading(true);
    setError(null);
    setShowWarningModal(false);

    try {
      const url = `/api/writing-style?username=${encodeURIComponent(username)}${force ? '&force=true' : ''}`;
      const response = await fetch(url);
      const data: WritingStyleResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate writing style');
      }

      setWritingStyleData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate writing style';
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
    generateWritingStyle(username, true);
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
            <PenTool className="w-5 h-5 text-purple-500" />
            Writing Style Analysis
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">Analyze Writing Style</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Enter a LinkedIn profile URL to analyze their writing style patterns and generate sample posts in their style.
          </p>
          
          {/* Info Note */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">
              📝 Note: This feature works from stored data
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              This analysis uses profile and posts data that have already been fetched and stored. 
              If you haven&apos;t fetched the profile and posts yet, please do so first using the{' '}
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
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className={`flex-1 ${validationError ? 'border-red-400' : ''}`}
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
          {validationError && (
            <p className="text-red-500 text-sm mt-2">{validationError}</p>
          )}

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
        {writingStyleData && writingStyleData.success && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {writingStyleData.profileName || writingStyleData.username}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    @{writingStyleData.username}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Analyzed from <span className="font-medium text-foreground">{writingStyleData.postCount}</span> posts
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-purple-600 dark:text-purple-400">{writingStyleData.writingStyle.samplePosts.length}</span> sample posts generated
                  </p>
                </div>
              </div>
            </div>

            {/* Writing Style Analysis */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Accordion type="multiple" defaultValue={['analysis']} className="w-full">
                <AccordionItem value="analysis" className="border-b last:border-b-0">
                  <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="font-medium">Writing Style Analysis</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="pl-11 pt-2 space-y-5">
                      {writingStyleData.writingStyle.tone && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Tone</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.tone}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.format && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Format</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.format}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.averageLength && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Average Length</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.averageLength}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.hooks && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Hooks</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.hooks}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.ctas && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Call-to-Actions</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.ctas}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.emojiUsage && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Emoji Usage</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.emojiUsage}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.structure && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Structure</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.structure}</p>
                        </div>
                      )}
                      {writingStyleData.writingStyle.commonPatterns && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1.5">Common Patterns</p>
                          <p className="text-sm text-foreground">{writingStyleData.writingStyle.commonPatterns}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Sample Posts */}
            {writingStyleData.writingStyle.samplePosts && writingStyleData.writingStyle.samplePosts.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PenTool className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold">Sample Posts</h3>
                  <Badge variant="secondary" className="ml-2">
                    {writingStyleData.writingStyle.samplePosts.length} posts
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  These posts are written in the identified writing style, matching the tone, format, and patterns analyzed from the user's actual posts.
                </p>
                <div className="space-y-4">
                  {writingStyleData.writingStyle.samplePosts.map((post, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50 relative group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-foreground whitespace-pre-line flex-1 leading-relaxed">
                          {post}
                        </p>
                        <button
                          onClick={() => copyToClipboard(post, index)}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedIndex === index ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Sample {index + 1}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generated timestamp */}
            <p className="text-center text-xs text-muted-foreground">
              Generated on {new Date(writingStyleData.generatedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !writingStyleData && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <PenTool className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No writing style data yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Enter a LinkedIn profile URL above to analyze their writing style patterns 
              and generate sample posts in their style.
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
                    For more accurate writing style analysis, we recommend at least <span className="font-semibold text-foreground">{checkData.threshold} posts</span>.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                      More posts = Better style analysis
                    </p>
                    <p className="text-amber-700 dark:text-amber-400 mb-3">
                      With limited posts, the style patterns may be less accurate, and sample posts may not fully capture the writing style.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/posts" className="inline-block">
                        <Button variant="outline" size="sm" className="text-xs w-full">
                          Fetch More Posts
                        </Button>
                      </Link>
                    </div>
                  </div>
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

