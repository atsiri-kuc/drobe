import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, ShirtIcon, Trash2, Pencil, Check, X } from 'lucide-react';
import { SEASONS, SEASON_EMOJI, getUtilization, isInSeason, getSuggestions } from '../utils/utilization';
import './ItemDetail.css';

const CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories', 'Dresses', 'Activewear'];

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [wearHistory, setWearHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) loadItem();
  }, [user, id]);

  async function loadItem() {
    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid, 'items', id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setItem(data);
        setEditForm({
          name: data.name || '',
          brand: data.brand || '',
          category: data.category || 'Tops',
          color: data.color || '',
          size: data.size || '',
          purchasePrice: data.purchasePrice || '',
          purchaseDate: data.purchaseDate || '',
          totalWears: data.totalWears || 0,
          seasons: data.seasons || [],
        });
      }

      const wearQ = query(
        collection(db, 'users', user.uid, 'wearLogs'),
        where('itemId', '==', id)
      );
      const wearSnap = await getDocs(wearQ);
      const logs = [];
      wearSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (b.wornAt?.seconds || 0) - (a.wornAt?.seconds || 0));
      setWearHistory(logs);
    } catch (err) {
      console.error('Error loading item:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const itemRef = doc(db, 'users', user.uid, 'items', id);
      await updateDoc(itemRef, {
        name: editForm.name,
        brand: editForm.brand,
        category: editForm.category,
        color: editForm.color,
        size: editForm.size,
        purchasePrice: editForm.purchasePrice ? parseFloat(editForm.purchasePrice) : 0,
        purchaseDate: editForm.purchaseDate || null,
        totalWears: editForm.totalWears ? parseInt(editForm.totalWears) : 0,
        seasons: editForm.seasons || [],
      });
      setItem(prev => ({ ...prev, ...editForm, purchasePrice: editForm.purchasePrice ? parseFloat(editForm.purchasePrice) : 0, totalWears: editForm.totalWears ? parseInt(editForm.totalWears) : 0, seasons: editForm.seasons || [] }));
      setEditing(false);
    } catch (err) {
      console.error('Error updating item:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this item from your wardrobe? This cannot be undone.')) return;
    try {
      const itemRef = doc(db, 'users', user.uid, 'items', id);
      await deleteDoc(itemRef);
      navigate('/wardrobe', { replace: true });
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="detail-skeleton">
          <div className="skeleton" style={{ height: 300 }} />
          <div className="skeleton" style={{ height: 24, width: '60%', marginTop: 16 }} />
          <div className="skeleton" style={{ height: 16, width: '40%', marginTop: 8 }} />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <button className="btn-back" onClick={() => navigate('/wardrobe')}>
          <ArrowLeft size={20} /> Back
        </button>
        <div className="empty-state">
          <ShirtIcon size={64} />
          <h3>Item not found</h3>
        </div>
      </div>
    );
  }

  const costPerWear = item.purchasePrice && item.totalWears > 0
    ? (item.purchasePrice / item.totalWears).toFixed(2)
    : null;

  const lastWorn = item.lastWornAt
    ? new Date(item.lastWornAt.seconds ? item.lastWornAt.seconds * 1000 : item.lastWornAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  const daysSinceWorn = item.lastWornAt
    ? Math.floor((Date.now() - (item.lastWornAt.seconds ? item.lastWornAt.seconds * 1000 : new Date(item.lastWornAt).getTime())) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate how long they've owned it
  function getOwnedDuration() {
    let startDate = null;
    if (item.purchaseDate) {
      startDate = new Date(item.purchaseDate);
    } else if (item.createdAt) {
      startDate = item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
    }
    if (!startDate || isNaN(startDate.getTime())) return null;
    const diffMs = Date.now() - startDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years} year${years > 1 ? 's' : ''}`;
  }
  const ownedFor = getOwnedDuration();

  return (
    <div className="page item-detail-page">
      <div className="detail-top-bar">
        <button className="btn-back" onClick={() => navigate('/wardrobe')}>
          <ArrowLeft size={20} /> Back
        </button>
        {!editing ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
        ) : (
          <div className="edit-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={saving}>
              <X size={14} /> Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving}>
              <Check size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {item.photoURL ? (
        <img src={item.photoURL} alt={item.name} className="detail-hero-img" />
      ) : (
        <div className="detail-hero-placeholder">
          <ShirtIcon size={64} />
        </div>
      )}

      {editing ? (
        <div className="detail-edit-form">
          <div className="input-group">
            <label>Name</label>
            <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="input-group">
              <label>Brand</label>
              <input value={editForm.brand} onChange={e => setEditForm(p => ({ ...p, brand: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Category</label>
              <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label>Color</label>
              <input value={editForm.color} onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Size</label>
              <input value={editForm.size} onChange={e => setEditForm(p => ({ ...p, size: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label>Price ($)</label>
              <input type="number" step="0.01" min="0" value={editForm.purchasePrice} onChange={e => setEditForm(p => ({ ...p, purchasePrice: e.target.value }))} />
            </div>
            <div className="input-group">
              <label>Purchase Date</label>
              <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm(p => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
          </div>
          <div className="input-group">
            <label>Times worn</label>
            <input type="number" min="0" value={editForm.totalWears} onChange={e => setEditForm(p => ({ ...p, totalWears: e.target.value }))} />
          </div>
          <div className="input-group">
            <label>Seasons</label>
            <div className="season-chips">
              {SEASONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`chip season-chip ${editForm.seasons.includes(s) ? 'active' : ''}`}
                  onClick={() => {
                    setEditForm(p => ({
                      ...p,
                      seasons: p.seasons.includes(s)
                        ? p.seasons.filter(x => x !== s)
                        : [...p.seasons, s]
                    }));
                  }}
                >
                  {SEASON_EMOJI[s]} {s}
                </button>
              ))}
            </div>
            <span className="input-hint">Select none for all-season items</span>
          </div>
        </div>
      ) : (
        <>
          <div className="detail-header">
            <h1 className="detail-name">{item.name}</h1>
            <div className="detail-meta">
              {item.brand && <span className="badge">{item.brand}</span>}
              <span className="badge badge-primary">{item.category}</span>
              {item.color && <span className="badge">{item.color}</span>}
              {item.size && <span className="badge">{item.size}</span>}
              {item.seasons && item.seasons.length > 0 && (
                <span className={`badge ${isInSeason(item.seasons) ? 'badge-in-season' : 'badge-off-season'}`}>
                  {isInSeason(item.seasons) ? '✓ In Season' : '○ Off Season'}
                </span>
              )}
            </div>

            {(() => {
              const util = getUtilization(item);
              return (
                <div className={`utilization-badge util-${util.level.toLowerCase()}`}>
                  <span className="util-emoji">{util.emoji}</span>
                  <span className="util-label">{util.label}</span>
                  {util.wearsPerMonth !== null && (
                    <span className="util-detail">{util.wearsPerMonth.toFixed(1)} wears/mo</span>
                  )}
                </div>
              );
            })()}

            <p className="detail-summary">
              You've had this {ownedFor ? `for ${ownedFor}` : 'in your wardrobe'} and worn it <strong>{item.totalWears || 0} time{(item.totalWears || 0) !== 1 ? 's' : ''}</strong>.
              {costPerWear && <> That's <strong>${costPerWear}</strong> per wear.</>}
            </p>

            {item.seasons && item.seasons.length > 0 && (
              <div className="season-tags">
                {item.seasons.map(s => (
                  <span key={s} className="season-tag">{SEASON_EMOJI[s]} {s}</span>
                ))}
              </div>
            )}
          </div>

          <div className="detail-stats-grid">
            <div className="detail-stat card">
              <TrendingUp size={20} className="detail-stat-icon" />
              <span className="detail-stat-value">{item.totalWears || 0}</span>
              <span className="detail-stat-label">Times worn</span>
            </div>
            <div className="detail-stat card">
              <Calendar size={20} className="detail-stat-icon" />
              <span className="detail-stat-value">{lastWorn}</span>
              <span className="detail-stat-label">Last worn</span>
            </div>
            <div className="detail-stat card">
              <DollarSign size={20} className="detail-stat-icon" />
              <span className="detail-stat-value">
                {costPerWear ? `$${costPerWear}` : '—'}
              </span>
              <span className="detail-stat-label">Cost per wear</span>
            </div>
          </div>

          {/* Utilization Tips */}
          {(() => {
            const tips = getSuggestions(item);
            return tips.length > 0 ? (
              <div className="detail-tips card">
                <h3 className="tips-title">💡 Smart Tips</h3>
                <ul className="tips-list">
                  {tips.map((tip, i) => (
                    <li key={i} className={`tip-item tip-${tip.type}`}>
                      <span className="tip-icon">{tip.icon}</span>
                      <span className="tip-text">{tip.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}

          {item.purchasePrice > 0 && (
            <div className="detail-price-info card">
              <div className="price-row">
                <span>Purchase price</span>
                <strong>${item.purchasePrice.toFixed(2)}</strong>
              </div>
              {item.purchaseDate && (
                <div className="price-row">
                  <span>Purchased</span>
                  <strong>{item.purchaseDate}</strong>
                </div>
              )}
              {daysSinceWorn !== null && (
                <div className="price-row">
                  <span>Days since last worn</span>
                  <strong>{daysSinceWorn}</strong>
                </div>
              )}
            </div>
          )}

          {wearHistory.length > 0 && (
            <div className="detail-history">
              <h3>Wear History</h3>
              <div className="history-list">
                {wearHistory.slice(0, 10).map(log => {
                  const date = log.wornAt?.seconds
                    ? new Date(log.wornAt.seconds * 1000)
                    : new Date(log.wornAt);
                  return (
                    <div key={log.id} className="history-entry">
                      <Calendar size={14} />
                      <span>{date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      {log.occasion && <span className="badge">{log.occasion}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <button className="btn btn-danger btn-full detail-delete" onClick={handleDelete}>
        <Trash2 size={16} /> Delete Item
      </button>
    </div>
  );
}
