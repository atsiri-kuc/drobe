// Season-aware utilization scoring for wardrobe items

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];

export const SEASON_EMOJI = {
  Spring: '🌸',
  Summer: '☀️',
  Fall: '🍂',
  Winter: '❄️',
};

// Which months each season covers
const SEASON_MONTHS = {
  Spring: [2, 3, 4],   // Mar, Apr, May
  Summer: [5, 6, 7],   // Jun, Jul, Aug
  Fall: [8, 9, 10],     // Sep, Oct, Nov
  Winter: [11, 0, 1],   // Dec, Jan, Feb
};

/**
 * Calculate how many "active months" an item has been through
 * based on its seasons and ownership duration.
 */
export function getActiveMonths(seasons, purchaseDate, createdAt) {
  let startDate = null;
  if (purchaseDate) {
    startDate = new Date(purchaseDate);
  } else if (createdAt) {
    startDate = createdAt.seconds
      ? new Date(createdAt.seconds * 1000)
      : new Date(createdAt);
  }
  if (!startDate || isNaN(startDate.getTime())) return 0;

  const itemSeasons = seasons && seasons.length > 0 ? seasons : SEASONS; // all-season if none specified
  const activeMonthNumbers = new Set();
  itemSeasons.forEach(s => {
    (SEASON_MONTHS[s] || []).forEach(m => activeMonthNumbers.add(m));
  });

  let count = 0;
  const now = new Date();
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (current <= now) {
    if (activeMonthNumbers.has(current.getMonth())) {
      count++;
    }
    current.setMonth(current.getMonth() + 1);
  }

  return count;
}

/**
 * Calculate how many full active seasons the item has been through
 */
export function getActiveSeasonsCount(seasons, purchaseDate, createdAt) {
  const months = getActiveMonths(seasons, purchaseDate, createdAt);
  // Roughly 3 months per season
  return Math.floor(months / 3);
}

/**
 * Get utilization level: HIGH, MEDIUM, LOW
 * Only items that have been through 2+ active seasons are evaluated.
 */
export function getUtilization(item) {
  const seasons = item.seasons || [];
  const activeMonths = getActiveMonths(seasons, item.purchaseDate, item.createdAt);
  const activeSeasonsCount = getActiveSeasonsCount(seasons, item.purchaseDate, item.createdAt);
  const wears = item.totalWears || 0;

  // Too new to judge — needs at least 2 active seasons
  if (activeSeasonsCount < 2) {
    return { level: 'NEW', label: 'Too new', color: '#9A9590', emoji: '🆕', wearsPerMonth: null };
  }

  const wearsPerMonth = activeMonths > 0 ? wears / activeMonths : 0;

  if (wearsPerMonth >= 2) {
    return { level: 'HIGH', label: 'High use', color: '#7D9B8A', emoji: '🟢', wearsPerMonth };
  }
  if (wearsPerMonth >= 0.5) {
    return { level: 'MEDIUM', label: 'Moderate', color: '#C4A97D', emoji: '🟡', wearsPerMonth };
  }
  return { level: 'LOW', label: 'Consider donating?', color: '#D47070', emoji: '🔴', wearsPerMonth };
}

/**
 * Check if item is currently in-season
 */
export function isInSeason(seasons) {
  if (!seasons || seasons.length === 0) return true; // all-season
  const currentMonth = new Date().getMonth();
  return seasons.some(s => (SEASON_MONTHS[s] || []).includes(currentMonth));
}

/**
 * Get the current season name
 */
export function getCurrentSeason() {
  const month = new Date().getMonth();
  if ([2, 3, 4].includes(month)) return 'Spring';
  if ([5, 6, 7].includes(month)) return 'Summer';
  if ([8, 9, 10].includes(month)) return 'Fall';
  return 'Winter';
}
