/**
 * Custom hook for real-time agent profile updates
 * Uses Server-Sent Events to watch for changes in the profile settings file
 */

import { useEffect, useState } from 'react';
import { AgentProfileSettings } from '@/lib/agent-profile/types';
import { getAgentProfileSettings } from '@/lib/agent-profile/agent-profile-settings';

export function useRealtimeProfile() {
  const [profile, setProfile] = useState<AgentProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const setupEventSource = () => {
      try {
        // Use EventSource for real-time updates
        eventSource = new EventSource('/api/profile-settings/watch');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.settings) {
              setProfile(data.settings);
              setLastUpdated(new Date());
              setLoading(false);
              setError(null);
            }
          } catch (err) {
            console.error('Error parsing SSE data:', err);
            setError(err as Error);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE error:', err);
          
          // Fall back to regular fetch on error
          getAgentProfileSettings()
            .then((settings) => {
              setProfile(settings);
              setLoading(false);
            })
            .catch((err) => {
              setError(err);
              setLoading(false);
            });
          
          // Close the connection
          eventSource?.close();
          eventSource = null;
        };
      } catch (err) {
        // If SSE is not supported or fails, fall back to regular fetch
        console.error('Failed to setup SSE:', err);
        
        getAgentProfileSettings()
          .then((settings) => {
            setProfile(settings);
            setLoading(false);
          })
          .catch((err) => {
            setError(err);
            setLoading(false);
          });
      }
    };

    // Initial setup
    setupEventSource();

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return { profile, loading, error, lastUpdated };
} 