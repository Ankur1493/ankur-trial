import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Post, PostsDataFile, ProfileData, extractUsername, getPostAuthor, getPostLikes, getPostComments } from '@/lib/types';

// Answer with evidence structure
interface AnswerWithEvidence {
  answer: string | null;
  evidence: string[];
}

// Identity response structure with evidence
interface IdentityResponse {
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

// Helper function to sanitize text and remove invalid Unicode characters
function sanitizeText(text: string): string {
  if (!text) return '';
  // Remove invalid UTF-16 surrogate pairs and other problematic characters
  return text
    .replace(/[\uD800-\uDFFF]/g, '') // Remove unpaired surrogates
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

// Build the prompt for Claude
function buildPrompt(profile: ProfileData | null, posts: Post[]): string {
  let context = '';

    // Add profile information
    if (profile) {
      context += '=== LINKEDIN PROFILE ===\n';
      context += `[Evidence ID: PROFILE]\n`;
      if (profile.basic_info?.fullname) {
        context += `Name: ${sanitizeText(profile.basic_info.fullname)}\n`;
      }
      if (profile.basic_info?.headline) {
        context += `Headline: ${sanitizeText(profile.basic_info.headline)}\n`;
      }
      if (profile.basic_info?.about) {
        context += `About: ${sanitizeText(profile.basic_info.about)}\n`;
      }
    if (profile.basic_info?.location?.full) {
      context += `Location: ${profile.basic_info.location.full}\n`;
    }
    if (profile.basic_info?.current_company) {
      context += `Current Company: ${profile.basic_info.current_company}\n`;
    }
    if (profile.basic_info?.creator_hashtags?.length) {
      context += `Topics: ${profile.basic_info.creator_hashtags.join(', ')}\n`;
    }

    // Experience
    if (profile.experience?.length) {
      context += '\n--- Experience ---\n';
      for (const exp of profile.experience.slice(0, 5)) {
        context += `• ${exp.title} at ${exp.company}`;
        if (exp.duration) context += ` (${exp.duration})`;
        context += '\n';
        if (exp.description) {
          const desc = sanitizeText(exp.description);
          context += `  ${desc.substring(0, 300)}${desc.length > 300 ? '...' : ''}\n`;
        }
      }
    }

    // Projects
    if (profile.projects?.length) {
      context += '\n--- Projects ---\n';
      for (const proj of profile.projects.slice(0, 3)) {
        const projName = sanitizeText(proj.name || '');
        const projDesc = proj.description ? sanitizeText(proj.description).substring(0, 200) : 'No description';
        context += `• ${projName}: ${projDesc}\n`;
      }
    }

    // Top Skills
    if (profile.skills?.length) {
      const topSkills = profile.skills.slice(0, 10).map(s => s.name).join(', ');
      context += `\nTop Skills: ${topSkills}\n`;
    }
  }

  // Add posts with URLs as evidence IDs
  if (posts.length > 0) {
    context += '\n\n=== LINKEDIN POSTS ===\n';
    // Sort by engagement and take most relevant posts
    const sortedPosts = [...posts].sort((a, b) => {
      const engagementA = getPostLikes(a) + getPostComments(a) * 2;
      const engagementB = getPostLikes(b) + getPostComments(b) * 2;
      return engagementB - engagementA;
    });

    // Take top 60 posts to provide more context (increased from 30 for users with many posts)
    const topPosts = sortedPosts.slice(0, 60);
    
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      if (post.text) {
        // Get post URL - check both new and legacy formats
        const postUrl = post.url || post.postUrl || `POST_${i + 1}`;
        // Sanitize post text to remove invalid Unicode characters
        const sanitizedText = sanitizeText(post.text);
        if (!sanitizedText) continue; // Skip if text becomes empty after sanitization
        
        context += `\n--- Post ${i + 1} ---\n`;
        context += `[Evidence ID: ${postUrl}]\n`;
        context += `Post URL: ${postUrl}\n`;
        context += `Engagement: ${getPostLikes(post)} likes, ${getPostComments(post)} comments\n`;
        // Include full post text (or up to 2000 chars for very long posts)
        const postText = sanitizedText.length > 2000 ? sanitizedText.substring(0, 2000) + '...' : sanitizedText;
        context += postText;
        context += '\n';
      }
    }
  }

  return context;
}

const SYSTEM_PROMPT = `You are an expert at analyzing LinkedIn profiles and posts to extract identity insights about a person.

Your job is to answer specific questions about who they are, what they do, who they help, and what they offer — based ONLY on the provided content.

IMPORTANT RULES (FOLLOW STRICTLY):

1. Only answer a question if there is clear, explicit evidence in the provided profile or posts.
2. If the answer is unclear, indirect, or speculative, return null.
3. Prefer returning null over guessing or extrapolating.
4. Do NOT fabricate facts, achievements, titles, metrics, timelines, or recognition.
5. Do NOT claim authorship, first-ever status, guarantees, or external recognition
   (e.g. "I coined…", "I pioneered…", "featured by…", revenue numbers, view counts)
   unless it appears verbatim in the content.
6. When evidence is indirect, use grounded phrasing such as:
   - "I often talk about…"
   - "My posts focus heavily on…"
   - "I share ideas around…"
7. Write answers in the first person, as if the person is describing themselves.
8. Limit each answer to a maximum of 1–2 short sentences.
9. Avoid marketing language, hype, or sales copy.
10. For EVERY non-null answer, you MUST attach supporting evidence.
11. Evidence must be 2–3 specific LinkedIn post URLs or "PROFILE" that directly support the answer.
    - Provide 2–3 pieces of evidence for each answer to ensure accuracy and credibility.
    - If you can only find 1 piece of evidence, still include it, but prefer 2–3 when available.
12. If you cannot attach at least one specific piece of evidence, return null for that answer.
13. Do NOT invent URLs. Use only the [Evidence ID: ...] values from the provided content (these are the Post URL values).
14. Do NOT reuse the same post as evidence for more than 3 answers unless it clearly supports multiple distinct claims.

You must respond with a valid JSON object matching this EXACT structure:

{
  "aboutYou": {
    "whatYouDo": { "answer": "string or null", "evidence": ["string"] },
    "topicsYouTalkAbout": { "answer": "string or null", "evidence": ["string"] },
    "whatMakesYouStandOut": { "answer": "string or null", "evidence": ["string"] }
  },
  "myStory": {
    "howYouStarted": { "answer": "string or null", "evidence": ["string"] },
    "pivotalMoment": { "answer": "string or null", "evidence": ["string"] },
    "earlyLessons": { "answer": "string or null", "evidence": ["string"] },
    "whatKeepsYouExcited": { "answer": "string or null", "evidence": ["string"] }
  },
  "targetAudience": {
    "audienceName": { "answer": "string or null", "evidence": ["string"] },
    "idealPerson": { "answer": "string or null", "evidence": ["string"] },
    "theirSituation": { "answer": "string or null", "evidence": ["string"] },
    "theirProblems": { "answer": "string or null", "evidence": ["string"] },
    "desiredOutcome": { "answer": "string or null", "evidence": ["string"] },
    "howYouHelp": { "answer": "string or null", "evidence": ["string"] }
  },
  "myOffer": {
    "offerName": { "answer": "string or null", "evidence": ["string"] },
    "whatYouOffer": { "answer": "string or null", "evidence": ["string"] },
    "clientExperience": { "answer": "string or null", "evidence": ["string"] },
    "websiteUrl": { "answer": "string or null", "evidence": ["string"] }
  }
}

Return ONLY the JSON object.
Do not include explanations, markdown, or extra text.`;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const usernameParam = searchParams.get('username');
    const force = searchParams.get('force') === 'true';

    if (!usernameParam) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const username = extractUsername(usernameParam).toLowerCase();
    const dataDir = path.join(process.cwd(), 'data');

    // Read posts data
    let userPosts: Post[] = [];
    
    try {
      const postsFilePath = path.join(dataDir, 'posts_data.json');
      const postsContent = await readFile(postsFilePath, 'utf-8');
      const parsed = JSON.parse(postsContent);
      
      let postsData: PostsDataFile;
      if (Array.isArray(parsed)) {
        postsData = { metadata: {}, posts: parsed };
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        postsData = parsed;
      } else {
        postsData = { metadata: {}, posts: [] };
      }

      userPosts = postsData.posts.filter(post => {
        const postUsername = getPostAuthor(post);
        return postUsername === username;
      });
    } catch {
      userPosts = [];
    }

    // Read profile data
    let userProfile: ProfileData | null = null;
    
    try {
      const profileFilePath = path.join(dataDir, 'profile_data.json');
      const profileContent = await readFile(profileFilePath, 'utf-8');
      const profiles: ProfileData[] = JSON.parse(profileContent);
      
      userProfile = profiles.find(profile => {
        const profileUsername = profile.basic_info?.public_identifier?.toLowerCase() || 
                               extractUsername(profile.profileUrl || '');
        return profileUsername === username;
      }) || null;
    } catch {
      userProfile = null;
    }

    // Check if we have enough data
    const postCount = userPosts.length;
    const hasProfile = userProfile !== null;

    if (postCount === 0 && !hasProfile) {
      return NextResponse.json({
        success: false,
        error: 'No data found for this user',
        username,
        postCount: 0,
        hasProfile: false,
        message: `No profile or posts data found for "${username}". Please fetch the profile and posts first using the /api/profile and /api/posts endpoints before extracting identity.`,
        guidelines: {
          step1: 'Fetch profile: GET /api/profile?urls=linkedin.com/in/username',
          step2: 'Fetch posts: GET /api/posts?urls=linkedin.com/in/username',
          step3: 'Then retry this endpoint: GET /api/identity?username=username'
        }
      }, { status: 404 });
    }

    // Check threshold (unless force is true)
    if (!force && postCount < 20) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient posts for accurate identity extraction',
        username,
        postCount,
        hasProfile,
        meetsThreshold: false,
        threshold: 20,
        message: `Found only ${postCount} posts. At least 20 posts are recommended for accurate results. Use force=true to generate anyway.`,
        guidelines: {
          note: 'This endpoint works from stored data. If you need more posts, fetch them first:',
          fetchPosts: 'GET /api/posts?urls=linkedin.com/in/username',
          thenRetry: 'Then retry this endpoint: GET /api/identity?username=username'
        }
      }, { status: 400 });
    }

    // Build context for Claude
    const context = buildPrompt(userProfile, userPosts);

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Claude API key not configured',
        message: 'Please set ANTHROPIC_API_KEY in your environment variables'
      }, { status: 500 });
    }

    // Call Claude using Vercel AI SDK
    const { text: responseText } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: SYSTEM_PROMPT,
      prompt: `Analyze the following LinkedIn profile and posts to extract identity insights:\n\n${context}`,
    });

    // Parse Claude's response
    let identity: IdentityResponse;
    try {
      // Sanitize response text before parsing
      const sanitizedResponse = sanitizeText(responseText);
      
      // Try to extract JSON from the response
      const jsonMatch = sanitizedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Parse with better error handling
        const jsonString = jsonMatch[0];
        // Try to fix common JSON issues
        const cleanedJson = jsonString
          .replace(/[\u0000-\u001F]/g, '') // Remove control characters
          .replace(/[\uD800-\uDFFF]/g, ''); // Remove unpaired surrogates
        
        identity = JSON.parse(cleanedJson);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      console.error('Response text length:', responseText?.length);
      console.error('Response text preview:', responseText?.substring(0, 500));
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        message: parseError instanceof Error ? parseError.message : 'The AI response was not in the expected format',
        details: 'The response may contain invalid Unicode characters or malformed JSON'
      }, { status: 500 });
    }

    // Sanitize identity object before returning (recursively clean strings)
    const sanitizeObject = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') return sanitizeText(obj);
      if (Array.isArray(obj)) return obj.map(sanitizeObject);
      if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    const sanitizedIdentity = sanitizeObject(identity);

    return NextResponse.json({
      success: true,
      username,
      postCount,
      hasProfile,
      profileName: userProfile?.basic_info?.fullname ? sanitizeText(userProfile.basic_info.fullname) : null,
      identity: sanitizedIdentity,
      generatedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error generating identity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate identity', message: errorMessage },
      { status: 500 }
    );
  }
}
