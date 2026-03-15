import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Calendar, Plus, ShirtIcon, Clock, X } from 'lucide-react';
import LogOutfitModal from '../components/LogOutfitModal';
import './LogOutfit.css';

function getOutfitDate(outfit) {
  return outfit.wornAt?.seconds
    ? new Date(outfit.wornAt.seconds * 1000)
    : new Date(outfit.wornAt);
}

export default function LogOutfit() {
  const { user } = useAuth();
  const [outfits, setOutfits] = useState([]);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(''); // '' means show all

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

  // Filter outfits by selected date
  const filteredOutfits = selectedDate
    ? outfits.filter(o => {
        const d = getOutfitDate(o);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dateStr === selectedDate;
      })
    : outfits;

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

      {/* Date Filter */}
      {outfits.length > 0 && (
        <div className="log-date-filters">
          <button
            className={`chip ${!selectedDate ? 'active' : ''}`}
            onClick={() => setSelectedDate('')}
          >
            All
            <span className="chip-count">{outfits.length}</span>
          </button>

          <div className="date-picker-wrapper">
            <Calendar size={16} className="date-picker-icon" />
            <input
              type="date"
              className="date-picker-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          {selectedDate && (
            <button className="chip active" onClick={() => setSelectedDate('')}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              <X size={14} />
            </button>
          )}
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
          {selectedDate ? (
            <>
              <h3>No outfits on this date</h3>
              <p>Try a different date or view all outfits</p>
              <button className="btn btn-primary" onClick={() => setSelectedDate('')}>
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
