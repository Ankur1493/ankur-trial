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
  User, 
  BookOpen, 
  Target, 
  Package,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';

// Answer with evidence structure
interface AnswerWithEvidence {
  answer: string | null;
  evidence: string[];
}

// Identity response structure with evidence
interface IdentityData {
  aboutYou: {
    whatYouDo: AnswerWithEvidence;
    topicsYouTalkAbout: AnswerWithEvidence;
    whatMakesYouStandOut: AnswerWithEvidence;
  };
  myStory: {
    howYouStarted: AnswerWithEvidence;
    pivotalMoment: AnswerWithEvidence;
    earlyLessons: AnswerWithEvidence;
    whatKeepsYouExcited: AnswerWithEvidence;
  };
  targetAudience: {
    audienceName: AnswerWithEvidence;
    idealPerson: AnswerWithEvidence;
    theirSituation: AnswerWithEvidence;
    theirProblems: AnswerWithEvidence;
    desiredOutcome: AnswerWithEvidence;
    howYouHelp: AnswerWithEvidence;
  };
  myOffer: {
    offerName: AnswerWithEvidence;
    whatYouOffer: AnswerWithEvidence;
    clientExperience: AnswerWithEvidence;
    websiteUrl: AnswerWithEvidence;
  };
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

interface IdentityResponse {
  success: boolean;
  username: string;
  postCount: number;
  hasProfile: boolean;
  profileName: string | null;
  identity: IdentityData;
  generatedAt: string;
  error?: string;
  message?: string;
}

// Question labels for display
const QUESTIONS = {
  aboutYou: {
    title: 'About You',
    icon: User,
    questions: {
      whatYouDo: 'If we were at a party and someone asked what you do, how would you answer?',
      topicsYouTalkAbout: 'If people only remembered you for talking about a few topics, what would those be?',
      whatMakesYouStandOut: 'Lots of people do what you do — what makes you stand out?',
    },
  },
  myStory: {
    title: 'My Story',
    icon: BookOpen,
    questions: {
      howYouStarted: "What got you started doing what you do in the first place?",
      pivotalMoment: 'Was there a moment that changed the direction you were heading in?',
      earlyLessons: 'Did you hit any bumps early on that ended up teaching you a lot?',
      whatKeepsYouExcited: 'What keeps you excited about doing this work now?',
    },
  },
  targetAudience: {
    title: 'Target Audience',
    icon: Target,
    questions: {
      audienceName: 'What would you call this audience? (Keep it short)',
      idealPerson: "If you had to pick one type of person you'd love to reach first, who would it be?",
      theirSituation: "What's usually going on in their world when they come to you?",
      theirProblems: 'What are the problems or frustrations they have that you help with?',
      desiredOutcome: "If things went perfectly for them, what's the outcome they'd love to get?",
      howYouHelp: 'How do you usually help this type of person?',
    },
  },
  myOffer: {
    title: 'My Offer',
    icon: Package,
    questions: {
      offerName: 'What would you call this offer? (Keep it short)',
      whatYouOffer: "What do you actually offer people? What's the main thing you help them with?",
      clientExperience: 'If I signed up as a client tomorrow, what does that usually look like in practice?',
      websiteUrl: "What's your website URL?",
    },
  },
};

// Evidence badge component
function EvidenceBadge({ evidence, index }: { evidence: string; index: number }) {
  const isUrl = evidence.startsWith('http');
  const isProfile = evidence === 'PROFILE';
  
  if (isUrl) {
    return (
      <a
        href={evidence}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center"
      >
        <Badge 
          variant="secondary" 
          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors gap-1"
        >
          {index + 1}
          <ExternalLink className="w-2.5 h-2.5" />
        </Badge>
      </a>
    );
  }
  
  return (
    <Badge 
      variant="outline" 
      className="text-xs"
      title={isProfile ? 'LinkedIn Profile' : evidence}
    >
      {index + 1}
      {isProfile && <span className="ml-1 text-[10px] opacity-70">Profile</span>}
    </Badge>
  );
}

function AnswerCard({ question, data }: { question: string; data: AnswerWithEvidence }) {
  const hasAnswer = data.answer !== null && data.answer.trim() !== '';
  const hasEvidence = data.evidence && data.evidence.length > 0;
  
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-sm text-muted-foreground mb-1.5 flex items-center gap-2">
        {hasAnswer ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        )}
        {question}
      </p>
      <div className="pl-5.5">
        <p className={`text-sm ${hasAnswer ? 'text-foreground' : 'text-muted-foreground/60 italic'}`}>
          {hasAnswer ? data.answer : 'Not determinable from available data'}
        </p>
        {hasAnswer && hasEvidence && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Evidence:</span>
            <div className="flex gap-1">
              {data.evidence.map((ev, idx) => (
                <EvidenceBadge key={idx} evidence={ev} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IdentityPage() {
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkData, setCheckData] = useState<CheckResponse | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [identityData, setIdentityData] = useState<IdentityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract username from input
  const extractUsername = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/linkedin\.com\/in\/([^/?]+)/);
    return match ? match[1].toLowerCase() : trimmed.toLowerCase();
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
    setIdentityData(null);

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
        await generateIdentity(username, false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check data availability');
    } finally {
      setLoading(false);
    }
  };

  // Generate identity
  const generateIdentity = async (username: string, force: boolean) => {
    setLoading(true);
    setError(null);
    setShowWarningModal(false);

    try {
      const url = `/api/identity?username=${encodeURIComponent(username)}${force ? '&force=true' : ''}`;
      const response = await fetch(url);
      const data: IdentityResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate identity');
      }

      setIdentityData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate identity');
    } finally {
      setLoading(false);
    }
  };

  // Handle force generate from modal
  const handleForceGenerate = () => {
    const username = extractUsername(linkedinUrl);
    generateIdentity(username, true);
  };

  // Count answered questions
  const countAnswers = (identity: IdentityData): { answered: number; total: number } => {
    let answered = 0;
    let total = 0;

    Object.values(identity).forEach((section) => {
      Object.values(section).forEach((item) => {
        total++;
        const typedItem = item as AnswerWithEvidence;
        if (typedItem.answer !== null && typedItem.answer.trim() !== '') {
          answered++;
        }
      });
    });

    return { answered, total };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
            <Sparkles className="w-5 h-5 text-cyan-500" />
            Identity Extraction
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">Analyze LinkedIn Identity</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Enter a LinkedIn profile URL or username to extract identity insights using AI analysis of their posts and profile data.
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
        {identityData && identityData.success && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {identityData.profileName || identityData.username}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    @{identityData.username}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Analyzed from <span className="font-medium text-foreground">{identityData.postCount}</span> posts
                  </p>
                  {(() => {
                    const { answered, total } = countAnswers(identityData.identity);
                    return (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{answered}</span> of {total} questions answered
                      </p>
                    );
                  })()}
                </div>
              </div>
              
              {/* Evidence Legend */}
              <div className="flex items-center gap-4 pt-4 border-t text-xs text-muted-foreground">
                <span>Evidence badges:</span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs gap-1">
                    1
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Badge>
                  <span>= Link to post</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    1 <span className="ml-1 text-[10px] opacity-70">Profile</span>
                  </Badge>
                  <span>= Profile section</span>
                </div>
              </div>
            </div>

            {/* Accordion Sections */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Accordion type="multiple" defaultValue={['aboutYou', 'myStory', 'targetAudience', 'myOffer']} className="w-full">
                {(Object.entries(QUESTIONS) as [keyof typeof QUESTIONS, typeof QUESTIONS[keyof typeof QUESTIONS]][]).map(([key, section]) => {
                  const Icon = section.icon;
                  const sectionData = identityData.identity[key as keyof IdentityData];
                  
                  return (
                    <AccordionItem key={key} value={key} className="border-b last:border-b-0">
                      <AccordionTrigger className="px-6 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <span className="font-medium">{section.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="pl-11 pt-2">
                          {Object.entries(section.questions).map(([qKey, question]) => (
                            <AnswerCard
                              key={qKey}
                              question={question}
                              data={sectionData[qKey as keyof typeof sectionData] as AnswerWithEvidence}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Generated timestamp */}
            <p className="text-center text-xs text-muted-foreground">
              Generated on {new Date(identityData.generatedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !identityData && !error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No identity data yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Enter a LinkedIn username above to analyze their posts and profile, 
              and extract identity insights using AI.
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
                    For more accurate identity extraction, we recommend at least <span className="font-semibold text-foreground">{checkData.threshold} posts</span>.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                      More posts = Better results
                    </p>
                    <p className="text-amber-700 dark:text-amber-400 mb-3">
                      With limited posts, some identity questions may not be answerable, and insights may be less accurate.
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
