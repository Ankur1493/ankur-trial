import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Post, PostsDataFile, ProfileData, extractUsername, getPostAuthor, getPostLikes, getPostComments } from '@/lib/types';

interface WritingStyleResponse {
  tone: string | null;
  format: string | null;
  averageLength: string | null;
  hooks: string | null;
  ctas: string | null;
  emojiUsage: string | null;
  structure: string | null;
  commonPatterns: string | null;
  samplePosts: string[]; // 3-5 sample posts written in the identified style
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

  // Add profile information (brief)
  if (profile) {
    context += '=== LINKEDIN PROFILE ===\n';
    if (profile.basic_info?.fullname) {
      context += `Name: ${sanitizeText(profile.basic_info.fullname)}\n`;
    }
    if (profile.basic_info?.headline) {
      context += `Headline: ${sanitizeText(profile.basic_info.headline)}\n`;
    }
    if (profile.basic_info?.about) {
      context += `About: ${sanitizeText(profile.basic_info.about)}\n`;
    }
  }

  // Add posts - focus on writing style analysis
  if (posts.length > 0) {
    context += '\n\n=== LINKEDIN POSTS ===\n';
    // Sort by engagement and take most relevant posts for style analysis
    const sortedPosts = [...posts].sort((a, b) => {
      const engagementA = getPostLikes(a) + getPostComments(a) * 2;
      const engagementB = getPostLikes(b) + getPostComments(b) * 2;
      return engagementB - engagementA;
    });

    // Take top 30 posts to analyze writing patterns
    const topPosts = sortedPosts.slice(0, 30);
    
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      if (post.text) {
        // Sanitize post text to remove invalid Unicode characters
        const sanitizedText = sanitizeText(post.text);
        if (!sanitizedText) continue; // Skip if text becomes empty after sanitization
        
        context += `\n--- Post ${i + 1} ---\n`;
        context += `Engagement: ${getPostLikes(post)} likes, ${getPostComments(post)} comments\n`;
        context += `Length: ${sanitizedText.length} characters\n`;
        context += sanitizedText;
        context += '\n';
      }
    }
  }

  return context;
}

const SYSTEM_PROMPT = `You are an expert at analyzing LinkedIn posts to extract writing style patterns.

Your job is to analyze the provided posts and identify:
1. Tone (professional, casual, inspirational, educational, etc.)
2. Format (storytelling, list-based, question-driven, etc.)
3. Average length (character count range)
4. Hooks (how they start posts - questions, statements, stories, etc.)
5. CTAs (call-to-action patterns - if any)
6. Emoji usage (frequency, placement, types)
7. Structure (paragraph breaks, bullet points, line breaks, etc.)
8. Common patterns (recurring themes in how they write)

IMPORTANT RULES:
1. Base your analysis ONLY on the provided posts.
2. Be specific and concrete in your observations.
3. If a pattern is unclear, note it as "varies" or "not consistent".
4. For average length, provide a range (e.g., "300-800 characters").
5. For emoji usage, specify frequency and placement (e.g., "1-2 emojis per post, usually at the end").
6. After analyzing the style, generate 3-5 sample posts written in the EXACT same style, tone, format, and patterns you identified.
7. The sample posts should be on topics relevant to the user's profile/headline but be original content (not copied from their actual posts).
8. Each sample post should be a complete, realistic LinkedIn post that matches their writing style.

You must respond with a valid JSON object matching this EXACT structure:

{
  "tone": "string describing the tone (or null if unclear)",
  "format": "string describing the format/style (or null if unclear)",
  "averageLength": "string describing length range (e.g., '400-900 characters')",
  "hooks": "string describing how posts typically start (or null if unclear)",
  "ctas": "string describing call-to-action patterns (or null if none found)",
  "emojiUsage": "string describing emoji usage patterns (or null if none)",
  "structure": "string describing structural patterns (paragraphs, breaks, etc.)",
  "commonPatterns": "string describing recurring writing patterns",
  "samplePosts": [
    "First sample post written in their style",
    "Second sample post written in their style",
    "Third sample post written in their style",
    "Fourth sample post (optional)",
    "Fifth sample post (optional)"
  ]
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
        message: `No profile or posts data found for "${username}". Please fetch the profile and posts first using the /api/profile and /api/posts endpoints before analyzing writing style.`,
        guidelines: {
          step1: 'Fetch profile: GET /api/profile?urls=linkedin.com/in/username',
          step2: 'Fetch posts: GET /api/posts?urls=linkedin.com/in/username',
          step3: 'Then retry this endpoint: GET /api/writing-style?username=username'
        }
      }, { status: 404 });
    }

    // Check threshold (unless force is true)
    if (!force && postCount < 10) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient posts for accurate writing style analysis',
        username,
        postCount,
        hasProfile,
        meetsThreshold: false,
        threshold: 10,
        message: `Found only ${postCount} posts. At least 10 posts are recommended for accurate style analysis. Use force=true to generate anyway.`,
        guidelines: {
          note: 'This endpoint works from stored data. If you need more posts, fetch them first:',
          fetchPosts: 'GET /api/posts?urls=linkedin.com/in/username',
          thenRetry: 'Then retry this endpoint: GET /api/writing-style?username=username'
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
      prompt: `Analyze the following LinkedIn profile and posts to extract writing style patterns:\n\n${context}`,
    });

    // Parse Claude's response
    let writingStyle: WritingStyleResponse;
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
        
        writingStyle = JSON.parse(cleanedJson);
        
        // Ensure samplePosts is an array with 3-5 items
        if (!Array.isArray(writingStyle.samplePosts)) {
          writingStyle.samplePosts = [];
        }
        // Trim to max 5 posts
        if (writingStyle.samplePosts.length > 5) {
          writingStyle.samplePosts = writingStyle.samplePosts.slice(0, 5);
        }
        // Ensure at least 3 posts (if we have data)
        if (writingStyle.samplePosts.length < 3 && postCount > 0) {
          // If Claude didn't generate enough, we'll note it but still return what we have
          console.warn('Claude generated fewer than 3 sample posts');
        }
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

    // Sanitize writing style object before returning (recursively clean strings)
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

    const sanitizedWritingStyle = sanitizeObject(writingStyle);

    return NextResponse.json({
      success: true,
      username,
      postCount,
      hasProfile,
      profileName: userProfile?.basic_info?.fullname ? sanitizeText(userProfile.basic_info.fullname) : null,
      writingStyle: sanitizedWritingStyle,
      generatedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error generating writing style:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate writing style', message: errorMessage },
      { status: 500 }
    );
  }
}

