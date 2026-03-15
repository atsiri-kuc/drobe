import { useState, useMemo } from 'react';
import { doc, deleteDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Calendar, Plus, ShirtIcon, Clock, X, Trash2, Pencil, Check } from 'lucide-react';
import LogOutfitModal from '../components/LogOutfitModal';
import './LogOutfit.css';

function getOutfitDate(outfit) {
  return outfit.wornAt?.seconds
    ? new Date(outfit.wornAt.seconds * 1000)
    : new Date(outfit.wornAt);
}

function toLocalDateKey(date) {
  // Use UTC components because Firestore stores dates at UTC midnight
  // e.g. "March 15" is stored as 2026-03-15T00:00:00Z
  // In EDT (UTC-4) this becomes March 14 20:00 local time
  // We want the UTC date (March 15), not the local date (March 14)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

function formatShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LogOutfit() {
  const { user } = useAuth();
  const { items: allItems, outfits, loading, refresh } = useData();
  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState(null);
  const [editingKey, setEditingKey] = useState(null); // dateKey of day in edit mode
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Build item lookup map
  const items = useMemo(() => {
    const map = {};
    allItems.forEach(i => { map[i.id] = i; });
    return map;
  }, [allItems]);

  async function handleDeleteDay(outfitIds) {
    try {
      for (const id of outfitIds) {
        await deleteDoc(doc(db, 'users', user.uid, 'outfits', id));
      }
      setConfirmDeleteKey(null);
      refresh();
    } catch (err) {
      console.error('Error deleting outfit:', err);
      alert('Failed to delete. Check your connection and try again.');
    }
  }

  function handleEditDay(dateKey) {
    setLogDate(dateKey);
    setShowLogModal(true);
  }

  function toggleEditMode(dateKey) {
    setEditingKey(editingKey === dateKey ? null : dateKey);
    setConfirmDeleteKey(null);
  }

  async function handleRemoveItem(itemId, dayOutfits) {
    try {
      for (const outfit of dayOutfits) {
        if (!(outfit.itemIds || []).includes(itemId)) continue;
        const outfitRef = doc(db, 'users', user.uid, 'outfits', outfit.id);
        if (outfit.itemIds.length <= 1) {
          // Last item in this outfit — delete the whole outfit
          await deleteDoc(outfitRef);
        } else {
          // Remove just this item from the outfit
          await updateDoc(outfitRef, { itemIds: arrayRemove(itemId) });
        }
      }
      refresh();
    } catch (err) {
      console.error('Error removing item:', err);
      alert('Failed to remove item.');
    }
  }

  const hasFilter = fromDate || toDate;

  const filteredOutfits = hasFilter
    ? outfits.filter(o => {
        const d = getOutfitDate(o);
        const dateStr = toLocalDateKey(d);
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
    setFromDate(toLocalDateKey(start));
    setToDate(toLocalDateKey(now));
  }

  function applyThisWeek() {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(start.getDate() - day);
    setFromDate(toLocalDateKey(start));
    setToDate(toLocalDateKey(now));
  }

  function applyThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFromDate(toLocalDateKey(start));
    setToDate(toLocalDateKey(now));
  }

  // Group outfits by LOCAL date key (YYYY-MM-DD) — merges all outfits on same day
  const grouped = useMemo(() => {
    const groups = {};
    filteredOutfits.forEach(outfit => {
      const d = getOutfitDate(outfit);
      const key = toLocalDateKey(d);
      if (!groups[key]) groups[key] = [];
      groups[key].push(outfit);
    });
    // Sort by date descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredOutfits]);

  // For a day group, collect all unique items across all outfits
  function getDayItems(dayOutfits) {
    const seen = new Set();
    const result = [];
    dayOutfits.forEach(outfit => {
      (outfit.itemIds || []).forEach(itemId => {
        if (!seen.has(itemId) && items[itemId]) {
          seen.add(itemId);
          result.push(items[itemId]);
        }
      });
    });
    return result;
  }

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
          {grouped.map(([dateKey, dayOutfits]) => {
            const dayItems = getDayItems(dayOutfits);
            const occasions = dayOutfits
              .map(o => o.occasion)
              .filter(Boolean);
            const outfitIds = dayOutfits.map(o => o.id);

            return (
              <div key={dateKey} className="log-day-card card">
                <div className="log-day-header">
                  <div className="log-day-title">
                    <Calendar size={16} />
                    <span className="log-day-label">{formatDateLabel(dateKey)}</span>
                  </div>
                  {confirmDeleteKey === dateKey ? (
                    <div className="log-confirm-bar">
                      <span>Delete this day?</span>
                      <button className="log-confirm-yes" onClick={() => handleDeleteDay(outfitIds)}>Yes</button>
                      <button className="log-confirm-no" onClick={() => setConfirmDeleteKey(null)}>Cancel</button>
                    </div>
                  ) : editingKey === dateKey ? (
                    <div className="log-day-actions">
                      <button
                        className="log-action-btn"
                        onClick={() => handleEditDay(dateKey)}
                        title="Add items"
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        className="log-action-btn log-delete-btn"
                        onClick={() => setConfirmDeleteKey(dateKey)}
                        title="Delete day"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        className="log-action-btn log-done-btn"
                        onClick={() => toggleEditMode(dateKey)}
                        title="Done"
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="log-day-actions">
                      <button
                        className="log-action-btn"
                        onClick={() => toggleEditMode(dateKey)}
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {occasions.length > 0 && (
                  <div className="log-day-occasions">
                    {occasions.map((occ, i) => (
                      <span key={i} className="badge">{occ}</span>
                    ))}
                  </div>
                )}

                <div className="log-outfit-items">
                  {dayItems.map(item => (
                    <div key={item.id} className="log-outfit-item">
                      <div className="log-item-img-wrap">
                        {item.photoURL ? (
                          <img src={item.photoURL} alt={item.name} className="log-outfit-item-img" loading="lazy" />
                        ) : (
                          <div className="log-outfit-item-placeholder">
                            <ShirtIcon size={16} />
                          </div>
                        )}
                        {editingKey === dateKey && (
                          <button
                            className="log-item-remove"
                            onClick={() => handleRemoveItem(item.id, dayOutfits)}
                            aria-label={`Remove ${item.name}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <span className="log-outfit-item-name">{item.name}</span>
                    </div>
                  ))}
                </div>

                <div className="log-day-meta">
                  <span>{dayItems.length} item{dayItems.length !== 1 ? 's' : ''}</span>
                  {dayOutfits.length > 1 && (
                    <span>· {dayOutfits.length} logs</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showLogModal && (
        <LogOutfitModal
          initialDate={logDate}
          onClose={() => { setShowLogModal(false); setLogDate(null); }}
          onComplete={() => {
            setShowLogModal(false);
            setLogDate(null);
          }}
        />
      )}
    </div>
  );
}
