import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ChevronLeft, ShirtIcon, Calendar } from 'lucide-react';
import ViewToggle from '../components/ViewToggle';
import { SEASON_EMOJI } from '../utils/utilization';
import './SeasonDetail.css';

const SEASON_MONTHS = {
  Spring: [2, 3, 4],
  Summer: [5, 6, 7],
  Fall: [8, 9, 10],
  Winter: [11, 0, 1],
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getOutfitDate(outfit) {
  return outfit.wornAt?.seconds
    ? new Date(outfit.wornAt.seconds * 1000)
    : new Date(outfit.wornAt);
}

export default function SeasonDetail() {
  const { season } = useParams();
  const navigate = useNavigate();
  const { items, outfits, loading } = useData();
  const [viewMode, setViewMode] = useState('list');

  const emoji = SEASON_EMOJI[season] || '📅';
  const months = SEASON_MONTHS[season] || [];

  // Filter outfits to only this season's months
  const seasonOutfits = useMemo(() => {
    const monthSet = new Set(months);
    return outfits.filter(o => {
      const d = getOutfitDate(o);
      return monthSet.has(d.getMonth());
    });
  }, [outfits, months]);

  // Count wears per item and build item list
  const wornItems = useMemo(() => {
    const wearMap = {};
    seasonOutfits.forEach(o => {
      (o.itemIds || []).forEach(id => {
        wearMap[id] = (wearMap[id] || 0) + 1;
      });
    });

    const itemMap = {};
    items.forEach(i => { itemMap[i.id] = i; });

    return Object.entries(wearMap)
      .map(([id, wears]) => ({ ...itemMap[id], id, seasonWears: wears }))
      .filter(i => i.name) // filter out deleted items
      .sort((a, b) => b.seasonWears - a.seasonWears);
  }, [seasonOutfits, items]);

  // Group worn items by category
  const categorized = useMemo(() => {
    const groups = {};
    wornItems.forEach(item => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [wornItems]);

  const totalWears = seasonOutfits.reduce((sum, o) => sum + (o.itemIds || []).length, 0);
  const totalValue = wornItems.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="season-detail-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <div className="season-detail-title">
          <span className="season-detail-emoji">{emoji}</span>
          <h1>{season}</h1>
        </div>
        <ViewToggle view={viewMode} onChange={setViewMode} />
      </div>

      {/* Summary Stats */}
      <div className="season-detail-summary">
        <div className="season-summary-stat">
          <span className="season-summary-value">{wornItems.length}</span>
          <span className="season-summary-label">Items Worn</span>
        </div>
        <div className="season-summary-stat">
          <span className="season-summary-value">{totalWears}</span>
          <span className="season-summary-label">Total Wears</span>
        </div>
        <div className="season-summary-stat">
          <span className="season-summary-value">${totalValue.toFixed(0)}</span>
          <span className="season-summary-label">Value Worn</span>
        </div>
      </div>

      <p className="season-months-label">
        <Calendar size={14} />
        {months.map(m => MONTH_NAMES[m]).join(', ')}
      </p>

      {loading ? (
        <div className="stats-list">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
        </div>
      ) : wornItems.length === 0 ? (
        <div className="empty-state">
          <ShirtIcon size={48} />
          <h3>No items worn in {season}</h3>
          <p>Log outfits during {months.map(m => MONTH_NAMES[m]).join(', ')} to see your {season.toLowerCase()} wardrobe</p>
        </div>
      ) : (
        <div className="season-detail-categories">
          {categorized.map(([category, catItems]) => (
            <div key={category} className="season-cat-group">
              <h3 className="season-cat-title">{category} <span className="season-cat-count">({catItems.length})</span></h3>
              <div className={viewMode === 'grid' ? 'stats-grid' : 'stats-list'}>
                {catItems.map((item, i) => (
                  <Link key={item.id} to={`/wardrobe/${item.id}`} className="card stats-list-item">
                    <span className="stats-rank">{i + 1}</span>
                    {item.photoURL ? (
                      <img src={item.photoURL} alt={item.name} className="stats-item-img" />
                    ) : (
                      <div className="stats-item-placeholder"><ShirtIcon size={16} /></div>
                    )}
                    <div className="stats-item-info">
                      <span className="stats-item-name">{item.name}</span>
                      <span className="stats-item-meta">{item.brand || ''}{item.purchasePrice ? ` · $${item.purchasePrice}` : ''}</span>
                    </div>
                    <span className="badge badge-primary">{item.seasonWears} wears</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
