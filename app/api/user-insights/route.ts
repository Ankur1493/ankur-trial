import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { Post, PostsDataFile, ProfileData, extractUsername, getPostAuthor, getPostLikes, getPostComments } from '@/lib/types';

interface UserInsightsResponse {
  role: string | null;
  company: string | null;
  interests: string[] | null;
  topics: string[] | null;
  expertise: string[] | null;
  background: string | null;
  achievements: string[] | null;
  values: string[] | null;
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
      context += `Location: ${sanitizeText(profile.basic_info.location.full)}\n`;
    }
    if (profile.basic_info?.current_company) {
      context += `Current Company: ${sanitizeText(profile.basic_info.current_company)}\n`;
    }
    if (profile.basic_info?.creator_hashtags?.length) {
      context += `Topics: ${profile.basic_info.creator_hashtags.map(t => sanitizeText(t)).join(', ')}\n`;
    }

    // Experience
    if (profile.experience?.length) {
      context += '\n--- Experience ---\n';
      for (const exp of profile.experience.slice(0, 10)) {
        context += `• ${exp.title} at ${exp.company}`;
        if (exp.duration) context += ` (${exp.duration})`;
        context += '\n';
        if (exp.description) {
          const desc = sanitizeText(exp.description);
          context += `  ${desc.substring(0, 300)}${desc.length > 300 ? '...' : ''}\n`;
        }
      }
    }

    // Education
    if (profile.education?.length) {
      context += '\n--- Education ---\n';
      for (const edu of profile.education) {
        context += `• ${edu.degree} in ${edu.field_of_study} from ${edu.school}\n`;
      }
    }

    // Projects
    if (profile.projects?.length) {
      context += '\n--- Projects ---\n';
      for (const proj of profile.projects.slice(0, 5)) {
        const projName = sanitizeText(proj.name || '');
        const projDesc = proj.description ? sanitizeText(proj.description).substring(0, 200) : 'No description';
        context += `• ${projName}: ${projDesc}\n`;
      }
    }

    // Skills
    if (profile.skills?.length) {
      const skills = profile.skills.slice(0, 20).map(s => sanitizeText(s.name || '')).join(', ');
      context += `\nSkills: ${skills}\n`;
    }
  }

  // Add posts
  if (posts.length > 0) {
    context += '\n\n=== LINKEDIN POSTS ===\n';
    // Sort by engagement and take most relevant posts
    const sortedPosts = [...posts].sort((a, b) => {
      const engagementA = getPostLikes(a) + getPostComments(a) * 2;
      const engagementB = getPostLikes(b) + getPostComments(b) * 2;
      return engagementB - engagementA;
    });

    // Take top 30 posts to stay within context limits
    const topPosts = sortedPosts.slice(0, 30);
    
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      if (post.text) {
        // Sanitize post text to remove invalid Unicode characters
        const sanitizedText = sanitizeText(post.text);
        if (!sanitizedText) continue; // Skip if text becomes empty after sanitization
        
        context += `\n--- Post ${i + 1} ---\n`;
        context += `Engagement: ${getPostLikes(post)} likes, ${getPostComments(post)} comments\n`;
        const postText = sanitizedText.length > 1500 ? sanitizedText.substring(0, 1500) + '...' : sanitizedText;
        context += postText;
        context += '\n';
      }
    }
  }

  return context;
}

const SYSTEM_PROMPT = `You are an expert at analyzing LinkedIn profiles and posts to extract factual insights about a user.

Your job is to extract concrete facts about:
1. Role - their current or primary role/title
2. Company - their current or primary company
3. Interests - topics they're interested in (based on what they post about)
4. Topics - main topics/subjects they cover in their posts
5. Expertise - areas of expertise/specialization
6. Background - professional background summary
7. Achievements - notable achievements mentioned (only if explicitly stated)
8. Values - values or principles they express

IMPORTANT RULES (FOLLOW STRICTLY):

1. Only extract facts that are clearly stated or strongly implied in the provided content.
2. If information is unclear or not available, return null for that field.
3. For arrays (interests, topics, expertise, achievements, values), return an empty array [] if none found, or null if completely unclear.
4. Do NOT fabricate facts, achievements, or information.
5. Do NOT infer information that isn't supported by the content.
6. Be specific and concrete - avoid vague generalizations.
7. For topics, list the main subjects they write about (e.g., ["AI", "Product Management", "Startups"]).
8. For interests, list what they seem interested in based on post content.
9. For expertise, list their areas of specialization.
10. For achievements, only include things explicitly mentioned (not inferred).
11. For values, extract principles or values they express in their writing.

You must respond with a valid JSON object matching this EXACT structure:

{
  "role": "string or null",
  "company": "string or null",
  "interests": ["string"] or null,
  "topics": ["string"] or null,
  "expertise": ["string"] or null,
  "background": "string or null",
  "achievements": ["string"] or null,
  "values": ["string"] or null
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
        message: `No profile or posts data found for "${username}". Please fetch the profile and posts first using the /api/profile and /api/posts endpoints before extracting user insights.`,
        guidelines: {
          step1: 'Fetch profile: GET /api/profile?urls=linkedin.com/in/username',
          step2: 'Fetch posts: GET /api/posts?urls=linkedin.com/in/username',
          step3: 'Then retry this endpoint: GET /api/user-insights?username=username'
        }
      }, { status: 404 });
    }

    // Check threshold (unless force is true) - user-insights can work with less data
    if (!force && postCount < 5 && !hasProfile) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient data for user insights',
        username,
        postCount,
        hasProfile,
        meetsThreshold: false,
        threshold: 5,
        message: `Found only ${postCount} posts and no profile. At least 5 posts or a profile are recommended. Use force=true to generate anyway.`,
        guidelines: {
          note: 'This endpoint works from stored data. If you need more data, fetch it first:',
          fetchProfile: 'GET /api/profile?urls=linkedin.com/in/username',
          fetchPosts: 'GET /api/posts?urls=linkedin.com/in/username',
          thenRetry: 'Then retry this endpoint: GET /api/user-insights?username=username'
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
      prompt: `Analyze the following LinkedIn profile and posts to extract user insights:\n\n${context}`,
    });

    // Parse Claude's response
    let userInsights: UserInsightsResponse;
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
        
        userInsights = JSON.parse(cleanedJson);
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

    // Sanitize user insights object before returning (recursively clean strings)
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

    const sanitizedUserInsights = sanitizeObject(userInsights);

    return NextResponse.json({
      success: true,
      username,
      postCount,
      hasProfile,
      profileName: userProfile?.basic_info?.fullname ? sanitizeText(userProfile.basic_info.fullname) : null,
      userInsights: sanitizedUserInsights,
      generatedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error generating user insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate user insights', message: errorMessage },
      { status: 500 }
    );
  }
}

