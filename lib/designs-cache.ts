import { DesignConversation, rowToConversation } from '@/lib/design-conversation';
import { createClient } from '@/lib/supabase/client';

// Short-lived, in-memory (per browser tab) cache for the /design grid's list
// query — switching Explore/Design/Home repeatedly would otherwise re-hit
// Supabase for the same list every time. Any create/delete/update explicitly
// refreshes the cache instead of waiting out the TTL, so it never shows
// stale data after an action the user just took themselves.
const TTL_MS = 60_000;

let cache: { data: DesignConversation[]; timestamp: number } | null = null;

export async function fetchDesignsList(): Promise<DesignConversation[]> {
  if (cache && Date.now() - cache.timestamp < TTL_MS) {
    return cache.data;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const list = (data as Parameters<typeof rowToConversation>[0][]).map(rowToConversation);
  cache = { data: list, timestamp: Date.now() };
  return list;
}

// Call after any create/delete/update so the cache reflects it immediately
// rather than waiting out the TTL or forcing a full refetch.
export function setDesignsListCache(list: DesignConversation[]) {
  cache = { data: list, timestamp: Date.now() };
}
