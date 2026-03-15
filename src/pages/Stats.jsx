import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { DollarSign, TrendingUp, ShirtIcon, AlertCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUtilization, SEASON_EMOJI, SEASONS } from '../utils/utilization';
import './Stats.css';

const CATEGORY_COLORS = {
  Tops: '#2D2D2D',
  Bottoms: '#C4A97D',
  Dresses: '#D4BC95',
  Shoes: '#6B6560',
  Outerwear: '#4A5568',
  Accessories: '#B39668',
  Activewear: '#7D9B8A',
  Other: '#9A9590',
};

const SEASON_MONTHS = {
  Spring: [2, 3, 4],
  Summer: [5, 6, 7],
  Fall: [8, 9, 10],
  Winter: [11, 0, 1],
};

// ── Pure CSS Bar Chart ──
function BarChart({ data, maxVal }) {
  if (!data || data.length === 0) return null;
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-col">
          <div className="bar-wrapper">
            <div
              className="bar-fill"
              style={{ height: `${(d.value / max) * 100}%` }}
            >
              {d.value > 0 && <span className="bar-value">{d.value}</span>}
            </div>
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut Chart ──
function DonutChart({ data, total }) {
  const size = 180;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.map(({ category, count }) => {
    const pct = count / total;
    const dashArray = `${pct * circumference} ${circumference}`;
    const dashOffset = -offset * circumference;
    offset += pct;
    return { category, count, pct, dashArray, dashOffset, color: CATEGORY_COLORS[category] || '#999' };
  });

  return (
    <div className="donut-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
          />
        ))}
        <text x={size / 2} y={size / 2 - 8} textAnchor="middle" className="donut-total">{total}</text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="donut-label">items</text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: seg.color }} />
            <span className="legend-name">{seg.category}</span>
            <span className="legend-count">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Color swatch helper ──
const COLOR_MAP = {
  black: '#2D2D2D', white: '#F5F5F5', navy: '#1B2A4A', blue: '#3B82F6',
  red: '#EF4444', green: '#22C55E', gray: '#9CA3AF', grey: '#9CA3AF',
  brown: '#92400E', beige: '#D4BC95', cream: '#FFF4E2', pink: '#EC4899',
  purple: '#A855F7', orange: '#F97316', yellow: '#EAB308', khaki: '#BDB76B',
  olive: '#6B8E23', taupe: '#B3A18C', charcoal: '#36454F', maroon: '#800000',
  burgundy: '#800020', teal: '#2DD4BF', tan: '#D2B48C', camel: '#C4A97D',
};

function getColorHex(colorName) {
  if (!colorName) return '#9A9590';
  const lower = colorName.toLowerCase().trim();
  return COLOR_MAP[lower] || '#9A9590';
}

export default function Stats() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freqView, setFreqView] = useState('month');

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try {
      const [itemsSnap, outfitsSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'items')),
        getDocs(query(collection(db, 'users', user.uid, 'outfits'), orderBy('wornAt', 'desc'))),
      ]);
      const itemList = [];
      itemsSnap.forEach(d => itemList.push({ id: d.id, ...d.data() }));
      const outfitList = [];
      outfitsSnap.forEach(d => outfitList.push({ id: d.id, ...d.data() }));
      setItems(itemList);
      setOutfits(outfitList);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Compute all stats ──
  const stats = useMemo(() => {
    if (items.length === 0) return null;

    const activeItems = items.filter(i => i.status === 'active');
    const totalValue = activeItems.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);
    const totalWears = activeItems.reduce((sum, i) => sum + (i.totalWears || 0), 0);
    const avgCostPerWear = totalWears > 0 ? totalValue / totalWears : 0;

    const topWorn = [...activeItems]
      .filter(i => (i.totalWears || 0) > 0)
      .sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0))
      .slice(0, 5);

    const bestValue = [...activeItems]
      .filter(i => (i.totalWears || 0) > 0 && (i.purchasePrice || 0) > 0)
      .map(i => ({ ...i, cpw: i.purchasePrice / i.totalWears }))
      .sort((a, b) => a.cpw - b.cpw)
      .slice(0, 5);

    const neverWorn = activeItems.filter(i => (i.totalWears || 0) === 0);
    const neverWornValue = neverWorn.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);

    const catMap = {};
    activeItems.forEach(i => {
      const cat = i.category || 'Other';
      if (!catMap[cat]) catMap[cat] = 0;
      catMap[cat]++;
    });
    const categoryData = Object.entries(catMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // ── Brand Breakdown ──
    const brandMap = {};
    activeItems.forEach(i => {
      const brand = (i.brand || '').trim();
      if (!brand) return;
      if (!brandMap[brand]) brandMap[brand] = { wears: 0, items: 0 };
      brandMap[brand].wears += (i.totalWears || 0);
      brandMap[brand].items += 1;
    });
    const brandData = Object.entries(brandMap)
      .map(([brand, d]) => ({ brand, ...d }))
      .sort((a, b) => b.wears - a.wears);

    // ── Color Palette ──
    const colorMap = {};
    activeItems.forEach(i => {
      const color = (i.color || '').trim().toLowerCase();
      if (!color) return;
      if (!colorMap[color]) colorMap[color] = 0;
      colorMap[color]++;
    });
    const totalColored = Object.values(colorMap).reduce((a, b) => a + b, 0);
    const colorData = Object.entries(colorMap)
      .map(([color, count]) => ({ color, count, pct: totalColored > 0 ? Math.round((count / totalColored) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // ── Seasonal Summary ──
    const seasonData = SEASONS.map(season => {
      const monthSet = new Set(SEASON_MONTHS[season]);
      const seasonItems = activeItems.filter(i =>
        !i.seasons || i.seasons.length === 0 || i.seasons.includes(season)
      );
      // Count outfit wears in this season's months
      let seasonWears = 0;
      outfits.forEach(o => {
        const d = o.wornAt?.seconds ? new Date(o.wornAt.seconds * 1000) : new Date(o.wornAt);
        if (monthSet.has(d.getMonth())) {
          seasonWears += (o.itemIds || []).length;
        }
      });
      return {
        season,
        emoji: SEASON_EMOJI[season],
        items: seasonItems.length,
        wears: seasonWears,
      };
    });

    // ── Cost Insights ──
    const itemsWithPrice = activeItems.filter(i => (i.purchasePrice || 0) > 0);
    const mostExpensiveNeverWorn = [...neverWorn]
      .filter(i => (i.purchasePrice || 0) > 0)
      .sort((a, b) => (b.purchasePrice || 0) - (a.purchasePrice || 0))[0] || null;
    const bestDeal = bestValue[0] || null;

    return {
      totalValue, totalWears, avgCostPerWear, topWorn, bestValue, neverWorn,
      neverWornValue, categoryData, totalItems: activeItems.length,
      brandData, colorData, seasonData, mostExpensiveNeverWorn, bestDeal,
      totalWithPrice: itemsWithPrice.length,
    };
  }, [items, outfits]);

  // ── Wear Frequency Data ──
  const freqData = useMemo(() => {
    if (outfits.length === 0) return [];
    const now = new Date();

    if (freqView === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      return days.map((label, dayIdx) => {
        const target = new Date(startOfWeek);
        target.setDate(startOfWeek.getDate() + dayIdx);
        const count = outfits.filter(o => {
          const d = o.wornAt?.seconds ? new Date(o.wornAt.seconds * 1000) : new Date(o.wornAt);
          return d.getDay() === dayIdx &&
                 d >= startOfWeek &&
                 d <= new Date(startOfWeek.getTime() + 7 * 86400000);
        }).length;
        return { label, value: count };
      });
    }

    if (freqView === 'month') {
      const weeksInMonth = [];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      let weekStart = new Date(startOfMonth);
      let weekNum = 1;
      while (weekStart <= endOfMonth) {
        const weekEnd = new Date(Math.min(weekStart.getTime() + 6 * 86400000, endOfMonth.getTime()));
        const count = outfits.filter(o => {
          const d = o.wornAt?.seconds ? new Date(o.wornAt.seconds * 1000) : new Date(o.wornAt);
          return d >= weekStart && d <= new Date(weekEnd.getTime() + 86400000);
        }).length;
        weeksInMonth.push({ label: `W${weekNum}`, value: count });
        weekStart = new Date(weekEnd.getTime() + 86400000);
        weekNum++;
      }
      return weeksInMonth;
    }

    // Year view — by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((label, mIdx) => {
      const count = outfits.filter(o => {
        const d = o.wornAt?.seconds ? new Date(o.wornAt.seconds * 1000) : new Date(o.wornAt);
        return d.getMonth() === mIdx && d.getFullYear() === now.getFullYear();
      }).length;
      return { label, value: count };
    });
  }, [outfits, freqView]);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title" style={{ paddingTop: 'var(--space-4)' }}>Stats</h1>
        <div className="stats-overview">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton stat-skeleton" />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page">
        <h1 className="page-title" style={{ paddingTop: 'var(--space-4)' }}>Stats</h1>
        <div className="empty-state">
          <TrendingUp size={64} />
          <h3>No data yet</h3>
          <p>Add items and log outfits to see your wardrobe analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page stats-page">
      <h1 className="page-title" style={{ paddingTop: 'var(--space-4)' }}>Stats</h1>

      {/* Overview Cards */}
      <div className="stats-overview">
        <div className="card stat-overview-card">
          <DollarSign size={18} className="stat-overview-icon" />
          <span className="stat-overview-value">${stats.totalValue.toFixed(0)}</span>
          <span className="stat-label">Wardrobe Value</span>
        </div>
        <div className="card stat-overview-card">
          <ShirtIcon size={18} className="stat-overview-icon" />
          <span className="stat-overview-value">{stats.totalItems}</span>
          <span className="stat-label">Active Items</span>
        </div>
        <div className="card stat-overview-card">
          <TrendingUp size={18} className="stat-overview-icon" />
          <span className="stat-overview-value">{stats.totalWears}</span>
          <span className="stat-label">Total Wears</span>
        </div>
        <div className="card stat-overview-card">
          <DollarSign size={18} className="stat-overview-icon" />
          <span className="stat-overview-value">${stats.avgCostPerWear.toFixed(2)}</span>
          <span className="stat-label">Avg Cost/Wear</span>
        </div>
      </div>

      {/* ── 1. Wear Frequency Chart ── */}
      {outfits.length > 0 && (
        <div className="stats-section">
          <div className="section-title-row">
            <h3 className="section-title">📊 Wear Frequency</h3>
            <div className="freq-toggle">
              {['week', 'month', 'year'].map(v => (
                <button
                  key={v}
                  className={`freq-btn ${freqView === v ? 'active' : ''}`}
                  onClick={() => setFreqView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="card chart-card">
            <BarChart data={freqData} />
          </div>
        </div>
      )}

      {/* ── 2. Brand Breakdown ── */}
      {stats.brandData.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">🏷️ Top Brands</h3>
          <div className="card brand-card">
            {stats.brandData.slice(0, 6).map((b, i) => (
              <div key={b.brand} className="brand-row">
                <span className="brand-rank">{i + 1}</span>
                <span className="brand-name">{b.brand}</span>
                <span className="brand-meta">{b.wears} wears · {b.items} item{b.items !== 1 ? 's' : ''}</span>
                <div className="brand-bar-bg">
                  <div
                    className="brand-bar-fill"
                    style={{ width: `${(b.wears / (stats.brandData[0]?.wears || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Color Palette ── */}
      {stats.colorData.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">🎨 Your Color Palette</h3>
          <div className="card color-card">
            <div className="color-bar">
              {stats.colorData.map(c => (
                <div
                  key={c.color}
                  className="color-segment"
                  style={{ width: `${c.pct}%`, background: getColorHex(c.color) }}
                  title={`${c.color} ${c.pct}%`}
                />
              ))}
            </div>
            <div className="color-legend">
              {stats.colorData.map(c => (
                <div key={c.color} className="color-legend-item">
                  <span className="color-dot" style={{ background: getColorHex(c.color), border: c.color === 'white' ? '1px solid #ddd' : 'none' }} />
                  <span className="color-name">{c.color}</span>
                  <span className="color-pct">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Seasonal Summary ── */}
      <div className="stats-section">
        <h3 className="section-title">🌡️ Seasonal Summary</h3>
        <div className="season-grid">
          {stats.seasonData.map(s => (
            <div key={s.season} className="card season-card">
              <span className="season-emoji-lg">{s.emoji}</span>
              <span className="season-name">{s.season}</span>
              <div className="season-stats">
                <span>{s.wears} wears</span>
                <span>{s.items} items</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Cost Insights ── */}
      <div className="stats-section">
        <h3 className="section-title">💰 Cost Insights</h3>
        <div className="card cost-card">
          <div className="cost-row">
            <span className="cost-label">Total Wardrobe Value</span>
            <span className="cost-value">${stats.totalValue.toFixed(0)}</span>
          </div>
          <div className="cost-row">
            <span className="cost-label">Average Cost/Wear</span>
            <span className="cost-value">${stats.avgCostPerWear.toFixed(2)}</span>
          </div>
          <div className="cost-row">
            <span className="cost-label">Idle Value (never worn)</span>
            <span className="cost-value cost-warning">${stats.neverWornValue.toFixed(0)}</span>
          </div>
          {stats.bestDeal && (
            <div className="cost-row cost-highlight">
              <span className="cost-label">🏆 Best Deal</span>
              <span className="cost-value">{stats.bestDeal.name} — ${stats.bestDeal.cpw.toFixed(2)}/wear</span>
            </div>
          )}
          {stats.mostExpensiveNeverWorn && (
            <div className="cost-row cost-highlight">
              <span className="cost-label">😬 Most Expensive Idle</span>
              <span className="cost-value">{stats.mostExpensiveNeverWorn.name} — ${stats.mostExpensiveNeverWorn.purchasePrice}</span>
            </div>
          )}
        </div>
      </div>

      {/* Donut Chart — Wardrobe Breakdown */}
      {stats.categoryData.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">Wardrobe Breakdown</h3>
          <div className="card donut-card">
            <DonutChart data={stats.categoryData} total={stats.totalItems} />
          </div>
        </div>
      )}

      {/* Top 5 Most Worn */}
      {stats.topWorn.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">🏆 Most Worn</h3>
          <div className="stats-list">
            {stats.topWorn.map((item, i) => (
              <Link key={item.id} to={`/wardrobe/${item.id}`} className="card stats-list-item">
                <span className="stats-rank">{i + 1}</span>
                {item.photoURL ? (
                  <img src={item.photoURL} alt={item.name} className="stats-item-img" />
                ) : (
                  <div className="stats-item-placeholder"><ShirtIcon size={16} /></div>
                )}
                <div className="stats-item-info">
                  <span className="stats-item-name">{item.name}</span>
                  <span className="stats-item-meta">{item.category}</span>
                </div>
                <span className="badge badge-primary">{item.totalWears} wears</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Best Value */}
      {stats.bestValue.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">💰 Best Value</h3>
          <div className="stats-list">
            {stats.bestValue.map((item, i) => (
              <Link key={item.id} to={`/wardrobe/${item.id}`} className="card stats-list-item">
                <span className="stats-rank">{i + 1}</span>
                {item.photoURL ? (
                  <img src={item.photoURL} alt={item.name} className="stats-item-img" />
                ) : (
                  <div className="stats-item-placeholder"><ShirtIcon size={16} /></div>
                )}
                <div className="stats-item-info">
                  <span className="stats-item-name">{item.name}</span>
                  <span className="stats-item-meta">${item.purchasePrice} · {item.totalWears} wears</span>
                </div>
                <span className="badge badge-accent">${item.cpw.toFixed(2)}/wear</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Never Worn */}
      {stats.neverWorn.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">
            😬 Never Worn
            {stats.neverWornValue > 0 && (
              <span className="badge badge-warning">${stats.neverWornValue.toFixed(0)} idle</span>
            )}
          </h3>
          <div className="stats-list">
            {stats.neverWorn.map(item => (
              <Link key={item.id} to={`/wardrobe/${item.id}`} className="card stats-list-item">
                <AlertCircle size={16} className="never-worn-icon" />
                {item.photoURL ? (
                  <img src={item.photoURL} alt={item.name} className="stats-item-img" />
                ) : (
                  <div className="stats-item-placeholder"><ShirtIcon size={16} /></div>
                )}
                <div className="stats-item-info">
                  <span className="stats-item-name">{item.name}</span>
                  <span className="stats-item-meta">{item.category}{item.purchasePrice ? ` · $${item.purchasePrice}` : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Consider Donating */}
      {(() => {
        const donateItems = items
          .map(item => ({ ...item, util: getUtilization(item) }))
          .filter(item => item.util.level === 'LOW');
        const donateValue = donateItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);

        return donateItems.length > 0 ? (
          <div className="stats-section">
            <h3 className="section-title">
              <Heart size={18} /> Consider Donating
              {donateValue > 0 && (
                <span className="badge badge-warning">${donateValue.toFixed(0)} idle value</span>
              )}
            </h3>
            <p className="section-subtitle">These items have been through 2+ active seasons but are rarely worn.</p>
            <div className="stats-list">
              {donateItems.map(item => (
                <Link key={item.id} to={`/wardrobe/${item.id}`} className="card stats-list-item">
                  <span className="util-emoji">{item.util.emoji}</span>
                  {item.photoURL ? (
                    <img src={item.photoURL} alt={item.name} className="stats-item-img" />
                  ) : (
                    <div className="stats-item-placeholder"><ShirtIcon size={16} /></div>
                  )}
                  <div className="stats-item-info">
                    <span className="stats-item-name">{item.name}</span>
                    <span className="stats-item-meta">{item.category}{item.purchasePrice ? ` · $${item.purchasePrice}` : ''}</span>
                  </div>
                  <span className="badge badge-donate">{item.util.wearsPerMonth?.toFixed(1)}/mo</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}
