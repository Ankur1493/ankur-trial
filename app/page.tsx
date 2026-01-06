'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Interfaces matching Apify data structure
interface Location {
  country: string;
  city: string;
  full: string;
  country_code: string;
}

interface BasicInfo {
  fullname: string;
  first_name: string;
  last_name: string;
  headline: string;
  public_identifier: string;
  profile_url: string;
  profile_picture_url: string;
  about: string;
  location: Location;
  creator_hashtags: string[];
  is_creator: boolean;
  is_influencer: boolean;
  is_premium: boolean;
  open_to_work: boolean;
  created_timestamp?: number;
  show_follower_count?: boolean;
  background_picture_url: string;
  follower_count: number;
  connection_count: number;
  current_company: string;
  current_company_urn?: string;
  current_company_url: string;
  top_skills?: string[];
  email: string;
  urn: string;
}

interface DateInfo {
  year: number | null;
  month: string | null;
}

interface Experience {
  title: string;
  company: string;
  description?: string;
  duration: string;
  start_date: DateInfo;
  end_date?: DateInfo;
  is_current: boolean;
  company_linkedin_url: string;
  company_logo_url: string;
  company_id?: string;
  location?: string;
  employment_type?: string;
  skills?: string[];
}

interface Education {
  school: string;
  degree: string;
  degree_name: string;
  field_of_study: string;
  duration: string;
  school_linkedin_url: string;
  school_logo_url: string;
  start_date: DateInfo;
  end_date: DateInfo;
  school_id?: string;
  description?: string;
  activities?: string;
  skills?: string[];
}

interface Project {
  name: string;
  description: string;
  is_current: boolean;
}

interface Certification {
  name: string;
  organization: string;
  organization_urn?: string;
  credential_id?: string;
  issue_date: string;
  expiration_date?: string | null;
  skills?: string[];
  credential_url?: string;
}

interface Featured {
  type: string;
  title: string;
  description: string;
  url: string;
  image_url?: string;
}

interface Skill {
  name: string;
  endorsement_count: number;
  related_experiences?: string[];
}

interface ReceivedRecommendation {
  recommender_name: string;
  recommender_title: string;
  recommender_profile_id: string;
  recommendation_date: string;
  relationship: string;
  recommendation_text: string;
}

interface GivenRecommendation {
  recommender_name: string;
  recommender_title: string;
  recommender_profile_id: string;
  recommendation_date: string;
  relationship: string;
  recommendation_text: string;
}

interface Recommendations {
  received_recommendations?: ReceivedRecommendation[];
  given_recommendations?: GivenRecommendation[];
}

interface LinkedInProfile {
  profileUrl?: string;
  basic_info: BasicInfo;
  experience: Experience[];
  education: Education[];
  projects?: Project[];
  certifications: Certification[];
  featured?: Featured[];
  skills?: Skill[];
  recommendations?: Recommendations;
}

type TabType = 'about' | 'experience' | 'education' | 'certifications' | 'featured' | 'skills' | 'recommendations';

function ProfileCard({ profile }: { profile: LinkedInProfile }) {
  const [activeTab, setActiveTab] = useState<TabType>('about');
  const [expandedExp, setExpandedExp] = useState<number | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const { basic_info, experience, education, certifications, featured, skills, recommendations } = profile;

  const totalRecs = (recommendations?.received_recommendations?.length || 0) + (recommendations?.given_recommendations?.length || 0);

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'about', label: 'About' },
    ...(experience && experience.length > 0 ? [{ id: 'experience' as TabType, label: 'Experience', count: experience.length }] : []),
    ...(education && education.length > 0 ? [{ id: 'education' as TabType, label: 'Education', count: education.length }] : []),
    ...(certifications && certifications.length > 0 ? [{ id: 'certifications' as TabType, label: 'Certs', count: certifications.length }] : []),
    ...(featured && featured.length > 0 ? [{ id: 'featured' as TabType, label: 'Featured', count: featured.length }] : []),
    ...(skills && skills.length > 0 ? [{ id: 'skills' as TabType, label: 'Skills', count: skills.length }] : []),
    ...(totalRecs > 0 ? [{ id: 'recommendations' as TabType, label: 'Recs', count: totalRecs }] : []),
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
      {/* Banner */}
      <div className="relative h-32 sm:h-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
        {basic_info.background_picture_url && (
          <img
            src={basic_info.background_picture_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Avatar & Basic Info */}
      <div className="relative px-6 pb-6 mt-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 sm:-mt-12">
          <img
            src={basic_info.profile_picture_url}
            alt={basic_info.fullname}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg object-cover bg-zinc-100 dark:bg-zinc-800"
          />
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                {basic_info.fullname}
              </h1>
              {basic_info.is_premium && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
                  Premium
                </span>
              )}
              {basic_info.is_creator && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                  Creator
                </span>
              )}
              {basic_info.is_influencer && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 rounded-full">
                  Influencer
                </span>
              )}
              {basic_info.open_to_work && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">
                  Open to Work
                </span>
              )}
              <a
                href={basic_info.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-300 mt-2 text-sm leading-relaxed">
              {basic_info.headline}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {basic_info.location?.full && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{basic_info.location.full}</span>
                </div>
              )}
              {basic_info.current_company && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{basic_info.current_company}</span>
                </div>
              )}
              {basic_info.email && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${basic_info.email}`} className="hover:text-blue-500 transition-colors">
                    {basic_info.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {basic_info.follower_count?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {basic_info.connection_count?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Connections</p>
          </div>
        </div>

        {/* Creator Hashtags */}
        {basic_info.creator_hashtags && basic_info.creator_hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {basic_info.creator_hashtags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-6 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 text-xs opacity-60">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {basic_info.about ? (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    About
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {basic_info.about}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No about section available
                </div>
              )}
            </div>
          )}

          {/* Experience Tab */}
          {activeTab === 'experience' && (
            <div className="space-y-4">
              {experience && experience.length > 0 ? (
                experience.map((exp, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      exp.is_current 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' 
                        : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700'
                    }`}
                    onClick={() => setExpandedExp(expandedExp === idx ? null : idx)}
                  >
                    <div className="flex gap-3">
                      {exp.company_logo_url ? (
                        <img
                          src={exp.company_logo_url}
                          alt={exp.company}
                          className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-zinc-700 flex-shrink-0 border border-zinc-200 dark:border-zinc-600"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-zinc-900 dark:text-white">{exp.title}</h4>
                          {exp.is_current && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <a 
                          href={exp.company_linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 dark:text-zinc-300 text-sm hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {exp.company}
                        </a>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          <span>{exp.duration}</span>
                          {exp.location && (
                            <>
                              <span>·</span>
                              <span>{exp.location}</span>
                            </>
                          )}
                          {exp.employment_type && (
                            <>
                              <span>·</span>
                              <span>{exp.employment_type}</span>
                            </>
                          )}
                        </div>
                        {exp.description && expandedExp === idx && (
                          <p className="text-zinc-600 dark:text-zinc-300 text-sm mt-3 leading-relaxed whitespace-pre-line border-t border-zinc-200 dark:border-zinc-700 pt-3">
                            {exp.description}
                          </p>
                        )}
                        {exp.description && (
                          <button 
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedExp(expandedExp === idx ? null : idx);
                            }}
                          >
                            {expandedExp === idx ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No experience found
                </div>
              )}
            </div>
          )}

          {/* Education Tab */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              {education && education.length > 0 ? (
                education.map((edu, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800"
                  >
                    <div className="flex gap-3">
                      {edu.school_logo_url ? (
                        <img
                          src={edu.school_logo_url}
                          alt={edu.school}
                          className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-zinc-700 flex-shrink-0 border border-zinc-200 dark:border-zinc-600"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 14l9-5-9-5-9 5 9 5z" />
                            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a 
                          href={edu.school_linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          {edu.school}
                        </a>
                        <p className="text-zinc-600 dark:text-zinc-300 text-sm mt-0.5">
                          {edu.degree}
                        </p>
                        {edu.field_of_study && (
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                            {edu.field_of_study}
                          </p>
                        )}
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          {edu.duration}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No education found
                </div>
              )}
            </div>
          )}

          {/* Certifications Tab */}
          {activeTab === 'certifications' && (
            <div className="space-y-4">
              {certifications && certifications.length > 0 ? (
                certifications.map((cert, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-zinc-900 dark:text-white">{cert.name}</h4>
                        <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                          {cert.organization}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          Issued: {cert.issue_date}
                          {cert.expiration_date && ` · Expires: ${cert.expiration_date}`}
                        </p>
                        {cert.credential_url && (
                          <a
                            href={cert.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 mt-2 font-medium"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            View Credential
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No certifications found
                </div>
              )}
            </div>
          )}

          {/* Featured Tab */}
          {activeTab === 'featured' && (
            <div className="space-y-4">
              {featured && featured.length > 0 ? (
                featured.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 hover:shadow-lg transition-all group"
                  >
                    <div className="flex gap-4">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-24 h-24 rounded-lg object-cover bg-white dark:bg-zinc-700 flex-shrink-0 border border-zinc-200 dark:border-zinc-600"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full capitalize">
                            {item.type}
                          </span>
                        </div>
                        <h4 className="font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 mt-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Visit Link
                        </div>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No featured items found
                </div>
              )}
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              {skills && skills.length > 0 ? (
                <>
                  {/* Skills Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {skills.map((skill, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-white text-sm">
                            {skill.name}
                          </span>
                        </div>
                        {skill.endorsement_count > 0 && (
                          <span className="px-2 py-1 text-xs font-semibold bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-full">
                            {skill.endorsement_count} endorsement{skill.endorsement_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No skills found
                </div>
              )}
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-8">
              {/* Recommendations Received */}
              {recommendations?.received_recommendations && recommendations.received_recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    Received ({recommendations.received_recommendations.length})
                  </h3>
                  <div className="space-y-4">
                    {recommendations.received_recommendations.map((rec, idx) => {
                      const recKey = `received-${idx}`;
                      const isExpanded = expandedRec === recKey;
                      const shouldTruncate = rec.recommendation_text.length > 200;
                      
                      return (
                        <div 
                          key={idx}
                          className="p-4 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800"
                        >
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold text-lg">
                                {rec.recommender_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={`https://linkedin.com/in/${rec.recommender_profile_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-zinc-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                >
                                  {rec.recommender_name}
                                </a>
                              </div>
                              <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {rec.recommender_title}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {rec.recommendation_date} · {rec.relationship}
                              </p>
                              {rec.recommendation_text && (
                                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-700">
                                  <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                                    &ldquo;{shouldTruncate && !isExpanded 
                                      ? `${rec.recommendation_text.substring(0, 200)}...` 
                                      : rec.recommendation_text
                                    }&rdquo;
                                  </p>
                                  {shouldTruncate && (
                                    <button 
                                      className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 mt-2 font-medium"
                                      onClick={() => setExpandedRec(isExpanded ? null : recKey)}
                                    >
                                      {isExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations Given */}
              {recommendations?.given_recommendations && recommendations.given_recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    Given ({recommendations.given_recommendations.length})
                  </h3>
                  <div className="space-y-4">
                    {recommendations.given_recommendations.map((rec, idx) => {
                      const recKey = `given-${idx}`;
                      const isExpanded = expandedRec === recKey;
                      const shouldTruncate = rec.recommendation_text.length > 200;
                      
                      return (
                        <div 
                          key={idx}
                          className="p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 border border-cyan-200 dark:border-cyan-800"
                        >
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold text-lg">
                                {rec.recommender_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <a
                                  href={`https://linkedin.com/in/${rec.recommender_profile_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-zinc-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                  {rec.recommender_name}
                                </a>
                              </div>
                              <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {rec.recommender_title}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {rec.recommendation_date} · {rec.relationship}
                              </p>
                              {rec.recommendation_text && (
                                <div className="mt-3 pt-3 border-t border-cyan-200 dark:border-cyan-700">
                                  <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                                    &ldquo;{shouldTruncate && !isExpanded 
                                      ? `${rec.recommendation_text.substring(0, 200)}...` 
                                      : rec.recommendation_text
                                    }&rdquo;
                                  </p>
                                  {shouldTruncate && (
                                    <button 
                                      className="text-xs text-cyan-500 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300 mt-2 font-medium"
                                      onClick={() => setExpandedRec(isExpanded ? null : recKey)}
                                    >
                                      {isExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!recommendations?.received_recommendations || recommendations.received_recommendations.length === 0) && 
               (!recommendations?.given_recommendations || recommendations.given_recommendations.length === 0) && (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No recommendations found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<LinkedInProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchProfile = async () => {
    if (!profileUrl.trim()) {
      setError('Please enter a LinkedIn URL');
      return;
    }

    setLoading(true);
    setError(null);
    setProfileData(null);

    try {
      const response = await fetch(`/api/profile?urls=${encodeURIComponent(profileUrl)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      // Normalize data to always be an array
      const profiles = Array.isArray(result.data) ? result.data : [result.data];
      setProfileData(profiles);
      console.log('LinkedIn Data:', profiles);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-[700px] mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            LinkedIn Profile Viewer
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Fetch and explore LinkedIn profiles beautifully
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 mb-4">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Enter LinkedIn profile URL..."
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchProfile();
                }
              }}
              className="flex-1 h-12 text-base border-zinc-200 dark:border-zinc-700 focus:ring-blue-500"
              disabled={loading}
            />
            <Button
              onClick={handleFetchProfile}
              disabled={loading || !profileUrl.trim()}
              className="h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Fetching...
                </span>
              ) : (
                'Fetch Profile'
              )}
            </Button>
          </div>
        </div>

        {/* Link to Posts Page */}
        <div className="mb-4">
          <Link 
            href="/posts"
            className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">LinkedIn Posts Scraper</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Fetch up to 100 posts from any profile</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Link to Top Posts Page */}
        <div className="mb-8">
          <Link 
            href="/top-posts"
            className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Top Performing Posts</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Find the most liked, commented & shared posts</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-zinc-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results */}
        {profileData && profileData.length > 0 && (
          <div className="space-y-6">
            {profileData.map((profile, index) => (
              <ProfileCard key={profile.basic_info?.urn || index} profile={profile} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {profileData && profileData.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <svg className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400">No profile found</p>
          </div>
        )}

        {/* Initial State */}
        {!profileData && !loading && !error && (
          <div className="text-center py-16 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
            <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Enter a LinkedIn profile URL to get started</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Example: linkedin.com/in/username</p>
          </div>
        )}
      </div>
    </div>
  );
}
