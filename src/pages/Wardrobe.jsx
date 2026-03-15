import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, ShirtIcon, Camera, X, Sparkles, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SEASONS, SEASON_EMOJI } from '../utils/utilization';
import BulkUpload from '../components/BulkUpload';
import './Wardrobe.css';

const DEFAULT_CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'];

const CATEGORY_ICONS = {
  All: '🗂️',
  Tops: '👕',
  Bottoms: '👖',
  Dresses: '👗',
  Shoes: '👟',
  Outerwear: '🧥',
  Accessories: '👜',
};

export default function Wardrobe() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', brand: '', category: 'Tops', subcategory: '',
    color: '', size: '', purchasePrice: '', purchaseDate: '', seasons: [], estimatedWears: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => { if (user) loadItems(); }, [user]);

  useEffect(() => {
    let result = items;
    if (activeCategory !== 'All') {
      result = result.filter(i => i.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.color?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [items, activeCategory, search]);

  async function loadItems() {
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'items'));
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0));
      setItems(list);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    setSaving(true);

    try {
      let photoURL = '';
      if (photoFile) {
        const path = `users/${user.uid}/items/${Date.now()}_${photoFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'users', user.uid, 'items'), {
        ...newItem,
        purchasePrice: newItem.purchasePrice ? parseFloat(newItem.purchasePrice) : 0,
        purchaseDate: newItem.purchaseDate || null,
        estimatedWears: newItem.estimatedWears ? parseInt(newItem.estimatedWears) : 0,
        seasons: newItem.seasons || [],
        photoURL,
        status: 'active',
        totalWears: newItem.estimatedWears ? parseInt(newItem.estimatedWears) : 0,
        lastWornAt: null,
        createdAt: Timestamp.now()
      });

      setNewItem({ name: '', brand: '', category: 'Tops', subcategory: '', color: '', size: '', purchasePrice: '', purchaseDate: '', seasons: [], estimatedWears: '' });
      setPhotoFile(null);
      setPhotoPreview(null);
      setShowAddForm(false);
      loadItems();
    } catch (err) {
      console.error('Error adding item:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="wardrobe-header">
        <h1 className="page-title">Wardrobe</h1>
        <div className="wardrobe-actions">
          <button className="btn btn-secondary" onClick={() => setShowBulkUpload(true)} aria-label="Bulk add items">
            <Sparkles size={16} />
            Bulk Add
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)} aria-label="Add item">
            <Plus size={18} />
            Add Item
          </button>
        </div>
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="search"
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="category-chips">
        {DEFAULT_CATEGORIES.map(cat => {
          const count = cat === 'All'
            ? items.length
            : items.filter(i => i.category === cat).length;
          return (
            <button
              key={cat}
              className={`chip category-chip-icon ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              <span className="chip-emoji">{CATEGORY_ICONS[cat]}</span>
              <span>{cat}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="item-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton item-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ShirtIcon size={64} />
          <h3>{items.length === 0 ? 'No items yet' : 'No matches found'}</h3>
          <p>{items.length === 0 ? 'Add your first clothing item to get started' : 'Try adjusting your search or filter'}</p>
        </div>
      ) : (
        <div className="item-grid">
          {filtered.map((item, i) => (
            <Link
              to={`/wardrobe/${item.id}`}
              key={item.id}
              className="item-card card"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {item.photoURL ? (
                <img src={item.photoURL} alt={item.name} className="item-img" loading="lazy" />
              ) : (
                <div className="item-img-placeholder">
                  <ShirtIcon size={28} />
                </div>
              )}
              <div className="item-info">
                <span className="item-name">{item.name}</span>
                <span className="item-meta">{item.brand || item.category}</span>
                {(item.totalWears || 0) > 0 && (
                  <span className="badge badge-primary">{item.totalWears} wears</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Item</h2>
              <button className="btn btn-icon" onClick={() => setShowAddForm(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="add-form">
              <div className="photo-upload" onClick={() => document.getElementById('photo-input').click()}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="photo-preview" />
                ) : (
                  <div className="photo-placeholder">
                    <Camera size={28} />
                    <span>Add Photo</span>
                  </div>
                )}
                <input id="photo-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} hidden />
              </div>

              <div className="input-group">
                <label htmlFor="item-name">Name *</label>
                <input id="item-name" required value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Blue Oxford Shirt" />
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="item-brand">Brand</label>
                  <input id="item-brand" value={newItem.brand} onChange={e => setNewItem(p => ({ ...p, brand: e.target.value }))} placeholder="e.g. Everlane" />
                </div>
                <div className="input-group">
                  <label htmlFor="item-category">Category</label>
                  <select id="item-category" value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                    {DEFAULT_CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="item-color">Color</label>
                  <input id="item-color" value={newItem.color} onChange={e => setNewItem(p => ({ ...p, color: e.target.value }))} placeholder="e.g. Navy" />
                </div>
                <div className="input-group">
                  <label htmlFor="item-size">Size</label>
                  <input id="item-size" value={newItem.size} onChange={e => setNewItem(p => ({ ...p, size: e.target.value }))} placeholder="e.g. M" />
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="item-price">Price ($)</label>
                  <input id="item-price" type="number" step="0.01" min="0" value={newItem.purchasePrice} onChange={e => setNewItem(p => ({ ...p, purchasePrice: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="input-group">
                  <label htmlFor="item-date">Purchase Date</label>
                  <input id="item-date" type="date" value={newItem.purchaseDate} onChange={e => setNewItem(p => ({ ...p, purchaseDate: e.target.value }))} />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="item-est-wears">Estimated past wears</label>
                <input id="item-est-wears" type="number" min="0" value={newItem.estimatedWears} onChange={e => setNewItem(p => ({ ...p, estimatedWears: e.target.value }))} placeholder="How many times have you worn this? (optional)" />
                <span className="input-hint">For older items — we'll use this for cost-per-wear</span>
              </div>

              <div className="input-group">
                <label>Seasons</label>
                <div className="season-chips">
                  {SEASONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`chip season-chip ${newItem.seasons.includes(s) ? 'active' : ''}`}
                      onClick={() => {
                        setNewItem(p => ({
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

              <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                {saving ? 'Saving...' : 'Add to Wardrobe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <BulkUpload
          onClose={() => setShowBulkUpload(false)}
          onComplete={() => {
            setShowBulkUpload(false);
            loadItems();
          }}
        />
      )}
    </div>
  );
}
