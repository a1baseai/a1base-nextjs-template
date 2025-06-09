/**
 * Example component showing how to use real-time profile updates
 * This demonstrates the useRealtimeProfile hook
 */

"use client";

import { useRealtimeProfile } from '@/hooks/useRealtimeProfile';
import { formatDistanceToNow } from 'date-fns';

export function RealtimeHomepage() {
  const { profile, loading, error, lastUpdated } = useRealtimeProfile();

  if (loading) {
    return <div>Loading profile...</div>;
  }

  if (error) {
    return <div>Error loading profile: {error.message}</div>;
  }

  if (!profile) {
    return <div>No profile data available</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{profile.name}</h1>
      <p className="text-lg text-gray-600 mb-2">{profile.role}</p>
      <p className="text-sm text-gray-500 mb-4">{profile.companyName}</p>
      
      {profile.profileImageUrl && (
        <img 
          src={profile.profileImageUrl} 
          alt={profile.name}
          className="w-32 h-32 rounded-full mb-4"
        />
      )}
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">About</h2>
        <p className="text-sm">{profile.companyDescription}</p>
      </div>
      
      {lastUpdated && (
        <p className="text-xs text-gray-400 mt-4">
          Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </p>
      )}
    </div>
  );
} 