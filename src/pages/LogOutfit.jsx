import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, ShirtIcon, Clock } from 'lucide-react';
import LogOutfitModal from '../components/LogOutfitModal';
import './LogOutfit.css';

const DATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function getOutfitDate(outfit) {
  return outfit.wornAt?.seconds
    ? new Date(outfit.wornAt.seconds * 1000)
    : new Date(outfit.wornAt);
}

function applyDateFilter(outfits, filterKey) {
  if (filterKey === 'all') return outfits;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let cutoff;
  if (filterKey === 'today') {
    cutoff = startOfToday;
  } else if (filterKey === 'week') {
    cutoff = new Date(startOfToday);
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (filterKey === 'month') {
    cutoff = new Date(startOfToday);
    cutoff.setMonth(cutoff.getMonth() - 1);
  }
  return outfits.filter(o => getOutfitDate(o) >= cutoff);
}

export default function LogOutfit() {
  const { user } = useAuth();
  const [outfits, setOutfits] = useState([]);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    try {
      const outfitSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'outfits'), orderBy('wornAt', 'desc'))
      );
      const outfitList = [];
      outfitSnap.forEach(d => outfitList.push({ id: d.id, ...d.data() }));

      const itemSnap = await getDocs(collection(db, 'users', user.uid, 'items'));
      const itemMap = {};
      itemSnap.forEach(d => { itemMap[d.id] = { id: d.id, ...d.data() }; });

      setOutfits(outfitList);
      setItems(itemMap);
    } catch (err) {
      console.error('Error loading outfits:', err);
    } finally {
      setLoading(false);
    }
  }

  function groupByDate(list) {
    const groups = {};
    list.forEach(outfit => {
      const d = getOutfitDate(outfit);
      const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(outfit);
    });
    return groups;
  }

  function getRelativeDate(dateStr) {
    const fmt = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const today = new Date().toLocaleDateString('en-US', fmt);
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-US', fmt);
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
  }

  const filteredOutfits = applyDateFilter(outfits, dateFilter);
  const grouped = groupByDate(filteredOutfits);

  return (
    <div className="page">
      <div className="log-header">
        <h1 className="page-title">Wear Log</h1>
        <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
          <Plus size={18} /> Log Outfit
        </button>
      </div>

      {/* Date Filter Chips */}
      {outfits.length > 0 && (
        <div className="log-date-filters">
          {DATE_FILTERS.map(f => {
            const count = applyDateFilter(outfits, f.key).length;
            return (
              <button
                key={f.key}
                className={`chip ${dateFilter === f.key ? 'active' : ''}`}
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="log-skeleton-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton log-skeleton-item" />
          ))}
        </div>
      ) : filteredOutfits.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} />
          {dateFilter === 'all' ? (
            <>
              <h3>No outfits logged yet</h3>
              <p>Start logging what you wear every day</p>
              <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
                <Plus size={18} /> Log Your First Outfit
              </button>
            </>
          ) : (
            <>
              <h3>No outfits in this period</h3>
              <p>Try a different date range or log a new outfit</p>
            </>
          )}
        </div>
      ) : (
        <div className="log-timeline">
          {Object.entries(grouped).map(([dateStr, dayOutfits]) => (
            <div key={dateStr} className="log-day">
              <div className="log-day-header">
                <Calendar size={16} />
                <span>{getRelativeDate(dateStr)}</span>
              </div>
              {dayOutfits.map(outfit => (
                <div key={outfit.id} className="log-outfit-card card">
                  {outfit.occasion && (
                    <span className="log-outfit-occasion">{outfit.occasion}</span>
                  )}
                  <div className="log-outfit-items">
                    {(outfit.itemIds || []).map(itemId => {
                      const item = items[itemId];
                      if (!item) return null;
                      return (
                        <div key={itemId} className="log-outfit-item">
                          {item.photoURL ? (
                            <img src={item.photoURL} alt={item.name} className="log-outfit-item-img" />
                          ) : (
                            <div className="log-outfit-item-placeholder">
                              <ShirtIcon size={16} />
                            </div>
                          )}
                          <span className="log-outfit-item-name">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="log-outfit-time">
                    <Clock size={12} />
                    <span>{outfit.itemIds?.length || 0} items</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showLogModal && (
        <LogOutfitModal
          onClose={() => setShowLogModal(false)}
          onComplete={() => {
            setShowLogModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
