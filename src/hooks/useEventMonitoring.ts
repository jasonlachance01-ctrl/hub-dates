import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MonitoredEvent {
  id: string;
  organization_name: string;
  event_name: string;
  date_found: string | null;
  notification_sent: boolean;
}

export const useEventMonitoring = (organizationName?: string) => {
  const [newDates, setNewDates] = useState<MonitoredEvent[]>([]);
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    const fetchMonitoring = async () => {
      let query = supabase
        .from('event_monitoring')
        .select('*')
        .not('date_found', 'is', null)
        .eq('notification_sent', false);

      if (organizationName) {
        query = query.eq('organization_name', organizationName);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching monitoring data:', error);
        return;
      }

      if (data && data.length > 0) {
        setNewDates(data);
        setHasNotifications(true);

        // Update badge API for app icon if supported
        if ('setAppBadge' in navigator) {
          try {
            await (navigator as any).setAppBadge(data.length);
          } catch (e) {
            console.log('Badge API not supported');
          }
        }
      }
    };

    fetchMonitoring();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('event-monitoring-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_monitoring',
        },
        (payload) => {
          const updated = payload.new as MonitoredEvent;
          if (updated.date_found && !updated.notification_sent) {
            if (!organizationName || updated.organization_name === organizationName) {
              setNewDates(prev => [...prev, updated]);
              setHasNotifications(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationName]);

  const markAsNotified = async (eventIds: string[]) => {
    const { error } = await supabase
      .from('event_monitoring')
      .update({ notification_sent: true })
      .in('id', eventIds);

    if (!error) {
      setNewDates(prev => prev.filter(e => !eventIds.includes(e.id)));
      if (newDates.length === eventIds.length) {
        setHasNotifications(false);
        // Clear app badge
        if ('clearAppBadge' in navigator) {
          try {
            await (navigator as any).clearAppBadge();
          } catch (e) {
            console.log('Badge API not supported');
          }
        }
      }
    }
  };

  return {
    newDates,
    hasNotifications,
    markAsNotified,
  };
};
