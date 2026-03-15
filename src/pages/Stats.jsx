import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { DollarSign, TrendingUp, ShirtIcon, AlertCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUtilization } from '../utils/utilization';
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

export default function Stats() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try {
      const itemsSnap = await getDocs(collection(db, 'users', user.uid, 'items'));
      const itemList = [];
      itemsSnap.forEach(d => itemList.push({ id: d.id, ...d.data() }));
      setItems(itemList);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

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

    // Category breakdown for donut chart
    const catMap = {};
    activeItems.forEach(i => {
      const cat = i.category || 'Other';
      if (!catMap[cat]) catMap[cat] = 0;
      catMap[cat]++;
    });
    const categoryData = Object.entries(catMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return { totalValue, totalWears, avgCostPerWear, topWorn, bestValue, neverWorn, neverWornValue, categoryData, totalItems: activeItems.length };
  }, [items]);

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
