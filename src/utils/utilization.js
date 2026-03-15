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

/**
 * Generate actionable utilization suggestions for an item
 */
export function getSuggestions(item) {
  const tips = [];
  const wears = item.totalWears || 0;
  const price = item.purchasePrice || 0;
  const seasons = item.seasons || [];
  const itemSeasons = seasons.length > 0 ? seasons : SEASONS;
  const currentSeason = getCurrentSeason();
  const inSeason = isInSeason(seasons);
  const util = getUtilization(item);

  // 1. Cost-per-wear target (only if price > 0)
  if (price > 0) {
    const currentCPW = wears > 0 ? price / wears : price;
    // Target: $1/wear or 50% of current CPW
    const targetCPW = Math.max(1, Math.floor(currentCPW * 0.5));
    const wearsNeeded = Math.ceil(price / targetCPW) - wears;

    if (wearsNeeded > 0 && currentCPW > 2) {
      tips.push({
        icon: '💰',
        text: `Wear ${wearsNeeded} more time${wearsNeeded !== 1 ? 's' : ''} to bring cost to $${targetCPW.toFixed(0)}/wear`,
        type: 'value',
      });
    }

    // Best value milestone
    if (wears > 0) {
      const nextMilestone = price > 50
        ? [5, 3, 2, 1].find(t => price / (wears + Math.ceil(price / t - wears)) <= t && Math.ceil(price / t) > wears)
        : null;
      if (nextMilestone && Math.ceil(price / nextMilestone) - wears > 0) {
        const moreNeeded = Math.ceil(price / nextMilestone) - wears;
        tips.push({
          icon: '🎯',
          text: `${moreNeeded} more wear${moreNeeded !== 1 ? 's' : ''} to hit $${nextMilestone}/wear — great value!`,
          type: 'milestone',
        });
      }
    }
  }

  // 2. Seasonal wear targets
  if (inSeason) {
    const seasonMonthsLeft = SEASON_MONTHS[currentSeason]
      ?.filter(m => m >= new Date().getMonth()).length || 1;
    const targetPerMonth = 2; // aim for "high use"
    const suggestedWears = targetPerMonth * seasonMonthsLeft;

    tips.push({
      icon: SEASON_EMOJI[currentSeason],
      text: `Try to wear ${suggestedWears}x this ${currentSeason.toLowerCase()} (${targetPerMonth}/month) for high utilization`,
      type: 'seasonal',
    });
  } else if (seasons.length > 0) {
    // Find next active season
    const seasonOrder = ['Spring', 'Summer', 'Fall', 'Winter'];
    const currentIdx = seasonOrder.indexOf(currentSeason);
    let nextSeason = null;
    for (let i = 1; i <= 4; i++) {
      const candidate = seasonOrder[(currentIdx + i) % 4];
      if (itemSeasons.includes(candidate)) {
        nextSeason = candidate;
        break;
      }
    }
    if (nextSeason) {
      tips.push({
        icon: SEASON_EMOJI[nextSeason],
        text: `This item is best for ${nextSeason.toLowerCase()} — plan outfits ahead!`,
        type: 'seasonal',
      });
    }
  }

  // 3. Utilization-level encouragement
  if (util.level === 'HIGH') {
    tips.push({
      icon: '⭐',
      text: 'This is one of your best-utilized items. Keep it up!',
      type: 'positive',
    });
  } else if (util.level === 'MEDIUM') {
    const wearsToHigh = Math.ceil(2 * (getActiveMonths(seasons, item.purchaseDate, item.createdAt) || 1)) - wears;
    if (wearsToHigh > 0) {
      tips.push({
        icon: '📈',
        text: `${wearsToHigh} more wear${wearsToHigh !== 1 ? 's' : ''} to reach high utilization`,
        type: 'encourage',
      });
    }
  } else if (util.level === 'LOW') {
    tips.push({
      icon: '💡',
      text: 'Try pairing this with your most-worn items to get more use from it',
      type: 'encourage',
    });
  } else if (util.level === 'NEW') {
    tips.push({
      icon: '🌱',
      text: 'Still getting to know this piece — wear it regularly to build its value!',
      type: 'neutral',
    });
  }

  // 4. Never worn nudge
  if (wears === 0) {
    tips.push({
      icon: '👋',
      text: 'You haven\'t worn this yet! Plan it into an outfit this week',
      type: 'action',
    });
  }

  return tips;
}
