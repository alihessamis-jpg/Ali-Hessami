import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

// supabase.auth.getUser() always revalidates the JWT with a network round
// trip, so a transient network hiccup (or calling it right as the app
// loads) makes it resolve a null user even though a valid session is
// already sitting in local storage -- surfacing as a false "Not
// authenticated" error. getSession() reads that local session with no
// network call, so check it first and only fall back to getUser() when
// there is truly no local session to trust.
export async function getAuthUser(): Promise<{ data: { user: User | null } }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.user) return { data: { user: session.user } }
  return supabase.auth.getUser()
}
