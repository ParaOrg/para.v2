// Guest contribution linking utility
const GUEST_KEY = 'para_guest_uuid';

export function getGuestUuid() {
  let uuid = localStorage.getItem(GUEST_KEY);
  if (!uuid) {
    uuid = 'guest_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(GUEST_KEY, uuid);
  }
  return uuid;
}

export function getPendingContributions() {
  try {
    return JSON.parse(localStorage.getItem('para_pending_contributions') || '[]');
  } catch {
    return [];
  }
}

export function addPendingContribution(contribution) {
  const pending = getPendingContributions();
  pending.push({
    ...contribution,
    guestUuid: getGuestUuid(),
    timestamp: Date.now(),
  });
  localStorage.setItem('para_pending_contributions', JSON.stringify(pending));
  return pending.length;
}

export function clearPendingContributions() {
  localStorage.removeItem('para_pending_contributions');
}

export async function claimContributions(userId, userEmail) {
  const pending = getPendingContributions();
  const guestUuid = getGuestUuid();
  
  // Call Supabase to link guest contributions to user
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ph_routes?submitted_by=eq.${guestUuid}`, {
      method: 'PATCH',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ user_id: userId, submitted_by: userEmail })
    });
    
    if (res.ok) {
      clearPendingContributions();
      return pending.length;
    }
    return 0;
  } catch {
    return 0;
  }
}
