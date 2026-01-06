import { ApifyClient } from 'apify-client';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';

interface ProfileData {
  profileUrl?: string;
  basic_info?: {
    public_identifier?: string;
    profile_url?: string;
  };
}

// Extract username from LinkedIn URL or return as-is if already a username
function extractUsername(input: string): string {
  const trimmed = input.trim();
  
  // Handle full LinkedIn URLs
  // Matches: https://linkedin.com/in/username, https://www.linkedin.com/in/username, linkedin.com/in/username
  const linkedinPattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^\/\?\s]+)/i;
  const match = trimmed.match(linkedinPattern);
  
  if (match) {
    return match[1].toLowerCase();
  }
  
  // Already a username, return lowercase for consistent comparison
  return trimmed.toLowerCase();
}

// Get all existing usernames from profile data
function getExistingUsernames(profiles: ProfileData[]): Set<string> {
  const usernames = new Set<string>();
  
  for (const profile of profiles) {
    // Check profileUrl field
    if (profile.profileUrl) {
      const username = extractUsername(profile.profileUrl);
      if (username) usernames.add(username);
    }
    
    // Check basic_info.public_identifier
    if (profile.basic_info?.public_identifier) {
      usernames.add(profile.basic_info.public_identifier.toLowerCase());
    }
    
    // Check basic_info.profile_url
    if (profile.basic_info?.profile_url) {
      const username = extractUsername(profile.basic_info.profile_url);
      if (username) usernames.add(username);
    }
  }
  
  return usernames;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlsParam = searchParams.get('urls');

    if (!urlsParam) {
      return NextResponse.json(
        { error: 'URLs or usernames are required' },
        { status: 400 }
      );
    }

    // Parse URLs/usernames from query param and extract usernames
    const rawInputs = urlsParam.split(',').map(url => url.trim()).filter(url => url.length > 0);
    const requestedUsernames = rawInputs.map(extractUsername);

    // Setup data directory and file path
    const dataDir = path.join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });
    const profileFilePath = path.join(dataDir, 'profile_data.json');

    // Read existing data
    let existingData: ProfileData[] = [];
    try {
      const fileContent = await readFile(profileFilePath, 'utf-8');
      existingData = JSON.parse(fileContent);
      if (!Array.isArray(existingData)) {
        existingData = [];
      }
    } catch {
      // File doesn't exist or is invalid, start with empty array
      existingData = [];
    }

    // Get existing usernames
    const existingUsernames = getExistingUsernames(existingData);
    
    // Filter out usernames that already exist
    const newUsernames = requestedUsernames.filter(username => !existingUsernames.has(username));
    const alreadyExistingUsernames = requestedUsernames.filter(username => existingUsernames.has(username));

    // If all profiles already exist, return cached data
    if (newUsernames.length === 0) {
      // Find the existing profiles that match the requested usernames
      const cachedProfiles = existingData.filter(profile => {
        const profileUsername = profile.basic_info?.public_identifier?.toLowerCase() || 
                               extractUsername(profile.profileUrl || '');
        return requestedUsernames.includes(profileUsername);
      });

      return NextResponse.json({ 
        success: true, 
        data: cachedProfiles,
        savedTo: 'data/profile_data.json',
        totalProfiles: existingData.length,
        newProfiles: 0,
        cached: true,
        message: `All ${requestedUsernames.length} profile(s) already exist in cache`,
        alreadyExisting: alreadyExistingUsernames
      });
    }

    // Initialize the ApifyClient with API token
    const client = new ApifyClient({
      token: process.env.APIFY_TOKEN || '<YOUR_API_TOKEN>',
    });

    // Prepare Actor input - only fetch new profiles
    const input = {
      includeEmail: false,
      usernames: newUsernames,
    };

    console.log(`Fetching ${newUsernames.length} new profile(s): ${newUsernames.join(', ')}`);
    if (alreadyExistingUsernames.length > 0) {
      console.log(`Skipping ${alreadyExistingUsernames.length} existing profile(s): ${alreadyExistingUsernames.join(', ')}`);
    }

    // Run the Actor and wait for it to finish
    const run = await client.actor("5fajYOBUfeb6fgKlB").call(input);

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Append only new items to existing data
    const combinedData = [...existingData, ...items];
    
    await writeFile(profileFilePath, JSON.stringify(combinedData, null, 2), 'utf-8');
    console.log(`Profile data updated: ${profileFilePath} (Total: ${combinedData.length} profiles, New: ${items.length})`);

    // Also return cached profiles that were requested
    const cachedProfiles = existingData.filter(profile => {
      const profileUsername = profile.basic_info?.public_identifier?.toLowerCase() || 
                             extractUsername(profile.profileUrl || '');
      return alreadyExistingUsernames.includes(profileUsername);
    });

    // Return combined results (new + cached)
    return NextResponse.json({ 
      success: true, 
      data: [...items, ...cachedProfiles],
      savedTo: 'data/profile_data.json',
      totalProfiles: combinedData.length,
      newProfiles: items.length,
      cachedProfiles: cachedProfiles.length,
      fetched: newUsernames,
      alreadyExisting: alreadyExistingUsernames
    });
  } catch (error: unknown) {
    console.error('Error fetching LinkedIn data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch LinkedIn data', message: errorMessage }, { status: 500 });
  }
}

