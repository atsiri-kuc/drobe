import { useState, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Calendar, Plus, ShirtIcon, Clock, X, Trash2 } from 'lucide-react';
import LogOutfitModal from '../components/LogOutfitModal';
import './LogOutfit.css';

function getOutfitDate(outfit) {
  return outfit.wornAt?.seconds
    ? new Date(outfit.wornAt.seconds * 1000)
    : new Date(outfit.wornAt);
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LogOutfit() {
  const { user } = useAuth();
  const { items: allItems, outfits, loading, refresh } = useData();
  const [showLogModal, setShowLogModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Build item lookup map from shared data
  const items = useMemo(() => {
    const map = {};
    allItems.forEach(i => { map[i.id] = i; });
    return map;
  }, [allItems]);

  async function handleDeleteOutfit(outfitId) {
    if (!window.confirm('Delete this outfit log?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'outfits', outfitId));
      refresh();
    } catch (err) {
      console.error('Error deleting outfit:', err);
    }
  }



  const hasFilter = fromDate || toDate;

  const filteredOutfits = hasFilter
    ? outfits.filter(o => {
        const d = getOutfitDate(o);
        const dateStr = toDateStr(d);
        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;
        return true;
      })
    : outfits;

  function clearFilter() {
    setFromDate('');
    setToDate('');
  }

  function applyQuickPick(daysBack) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);
    setFromDate(toDateStr(start));
    setToDate(toDateStr(now));
  }

  function applyThisWeek() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(start.getDate() - day);
    setFromDate(toDateStr(start));
    setToDate(toDateStr(now));
  }

  function applyThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFromDate(toDateStr(start));
    setToDate(toDateStr(now));
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

  const grouped = groupByDate(filteredOutfits);

  return (
    <div className="page">
      <div className="log-header">
        <h1 className="page-title">Wear Log</h1>
        <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
          <Plus size={18} /> Log Outfit
        </button>
      </div>

      {/* Date Range Filter */}
      {outfits.length > 0 && (
        <div className="log-filter-section">
          <div className="log-date-filters">
            <button
              className={`chip ${!hasFilter ? 'active' : ''}`}
              onClick={clearFilter}
            >
              All
              <span className="chip-count">{outfits.length}</span>
            </button>

            <div className="date-range-row">
              <div className="date-picker-wrapper">
                <Calendar size={14} className="date-picker-icon" />
                <input
                  type="date"
                  className="date-picker-input"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  placeholder="From"
                />
              </div>
              <span className="date-range-sep">→</span>
              <div className="date-picker-wrapper">
                <Calendar size={14} className="date-picker-icon" />
                <input
                  type="date"
                  className="date-picker-input"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  placeholder="To"
                />
              </div>
            </div>

            {hasFilter && (
              <button className="chip active" onClick={clearFilter}>
                {fromDate && toDate
                  ? `${formatShort(fromDate)} – ${formatShort(toDate)}`
                  : fromDate
                    ? `From ${formatShort(fromDate)}`
                    : `Until ${formatShort(toDate)}`
                }
                &nbsp;({filteredOutfits.length})
                <X size={14} />
              </button>
            )}
          </div>

          <div className="quick-picks">
            <button className="quick-pick" onClick={applyThisWeek}>This Week</button>
            <span className="quick-pick-dot">·</span>
            <button className="quick-pick" onClick={applyThisMonth}>This Month</button>
            <span className="quick-pick-dot">·</span>
            <button className="quick-pick" onClick={() => applyQuickPick(30)}>Last 30 Days</button>
            <span className="quick-pick-dot">·</span>
            <button className="quick-pick" onClick={() => applyQuickPick(90)}>Last 90 Days</button>
          </div>
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
          {hasFilter ? (
            <>
              <h3>No outfits in this range</h3>
              <p>Try different dates or view all outfits</p>
              <button className="btn btn-primary" onClick={clearFilter}>
                View All
              </button>
            </>
          ) : (
            <>
              <h3>No outfits logged yet</h3>
              <p>Start logging what you wear every day</p>
              <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
                <Plus size={18} /> Log Your First Outfit
              </button>
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
                <span className="log-day-count">{dayOutfits.length} outfit{dayOutfits.length !== 1 ? 's' : ''}</span>
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
                  <div className="log-outfit-footer">
                    <div className="log-outfit-time">
                      <Clock size={12} />
                      <span>{outfit.itemIds?.length || 0} items</span>
                    </div>
                    <button
                      className="btn-icon-sm btn-icon-danger"
                      onClick={() => handleDeleteOutfit(outfit.id)}
                      aria-label="Delete outfit"
                    >
                      <Trash2 size={14} />
                    </button>
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
          }}
        />
      )}
    </div>
  );
}
