import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp, writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ShirtIcon, Calendar, X, Check, Search } from 'lucide-react';
import './LogOutfitModal.css';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];

export default function LogOutfitModal({ onClose, onComplete }) {
  const { user } = useAuth();
  const { items: allItems, loading, refresh } = useData();
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [occasion, setOccasion] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let result = allItems;
    if (activeCategory !== 'All') {
      result = result.filter(i => i.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [allItems, activeCategory, search]);

  function toggleItem(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (selected.size === 0) return;
    setSaving(true);

    try {
      const batch = writeBatch(db);
      const outfitRef = doc(collection(db, 'users', user.uid, 'outfits'));
      const wornAt = Timestamp.fromDate(new Date(date));

      batch.set(outfitRef, {
        itemIds: Array.from(selected),
        occasion: occasion || null,
        wornAt,
        createdAt: Timestamp.now()
      });

      for (const itemId of selected) {
        const itemRef = doc(db, 'users', user.uid, 'items', itemId);
        batch.update(itemRef, {
          totalWears: increment(1),
          lastWornAt: wornAt
        });

        const wearLogRef = doc(collection(db, 'users', user.uid, 'wearLogs'));
        batch.set(wearLogRef, {
          itemId,
          outfitId: outfitRef.id,
          occasion: occasion || null,
          wornAt,
          createdAt: Timestamp.now()
        });
      }

      await batch.commit();
      refresh();
      onComplete?.();
    } catch (err) {
      console.error('Error saving outfit:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet log-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Outfit</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="log-controls">
          <div className="log-date-row">
            <Calendar size={18} />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="log-date-input"
            />
          </div>
          <input
            type="text"
            value={occasion}
            onChange={e => setOccasion(e.target.value)}
            placeholder="Occasion (e.g. Work, Casual, Date)"
            className="log-occasion-input"
          />
        </div>

        <p className="log-hint">Select the items you wore</p>

        <div className="category-chips log-chips">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="log-items-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton log-item-skeleton" />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <ShirtIcon size={40} />
              <p>No items found</p>
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                className={`log-item-card ${selected.has(item.id) ? 'selected' : ''}`}
                onClick={() => toggleItem(item.id)}
              >
                {item.photoURL ? (
                  <img src={item.photoURL} alt={item.name} className="log-item-img" loading="lazy" />
                ) : (
                  <div className="log-item-placeholder">
                    <ShirtIcon size={20} />
                  </div>
                )}
                <span className="log-item-name">{item.name}</span>
                {selected.has(item.id) && (
                  <div className="log-item-check">
                    <Check size={14} />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {selected.size > 0 && (
          <div className="log-footer">
            <button
              className="btn btn-primary btn-full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : `Log ${selected.size} item${selected.size > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
