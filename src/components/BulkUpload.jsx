import { useState, useRef } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { scanMultipleItems } from '../utils/geminiVision';
import { Camera, Upload, X, Check, Loader, Pencil, Sparkles, AlertCircle } from 'lucide-react';
import './BulkUpload.css';

const CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories', 'Dresses', 'Activewear'];

export default function BulkUpload({ onClose, onComplete }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('select'); // select | scanning | review | saving
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [items, setItems] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;

    const newFiles = [...files, ...selected];
    setFiles(newFiles);

    // Create previews
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function startScanning() {
    setStep('scanning');
    setScanProgress(0);

    const results = await scanMultipleItems(files, (idx, result) => {
      setScanProgress(idx + 1);
    });

    const itemList = results.map((result, i) => ({
      ...result,
      purchasePrice: '',
      purchaseDate: '',
      size: '',
      seasonal: false,
      estimatedWears: '',
      file: files[i],
      preview: previews[i]
    }));

    setItems(itemList);
    setStep('review');
  }

  function updateItem(index, field, value) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function saveAllItems() {
    setStep('saving');
    setSaveProgress(0);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Upload photo
        let photoURL = '';
        if (item.file) {
          const path = `users/${user.uid}/items/${Date.now()}_${item.file.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, item.file);
          photoURL = await getDownloadURL(storageRef);
        }

        await addDoc(collection(db, 'users', user.uid, 'items'), {
          name: item.name || 'Unnamed Item',
          brand: item.brand || '',
          category: item.category || 'Tops',
          subcategory: item.subcategory || '',
          color: item.color || '',
          size: item.size || '',
          purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : 0,
          purchaseDate: item.purchaseDate || null,
          seasonal: item.seasonal || false,
          estimatedWears: item.estimatedWears ? parseInt(item.estimatedWears) : 0,
          photoURL,
          status: 'active',
          totalWears: item.estimatedWears ? parseInt(item.estimatedWears) : 0,
          lastWornAt: null,
          createdAt: Timestamp.now()
        });

        setSaveProgress(i + 1);
      } catch (err) {
        console.error(`Error saving item ${i}:`, err);
      }
    }

    onComplete?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet bulk-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 'select' && 'Bulk Add Items'}
            {step === 'scanning' && 'Scanning...'}
            {step === 'review' && `Review ${items.length} Items`}
            {step === 'saving' && 'Saving...'}
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: Select Photos */}
        {step === 'select' && (
          <div className="bulk-select">
            <div className="bulk-dropzone" onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} />
              <p className="dropzone-title">Select clothing photos</p>
              <p className="dropzone-subtitle">One item per photo for best results</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              hidden
            />

            {previews.length > 0 && (
              <>
                <div className="bulk-preview-grid">
                  {previews.map((src, i) => (
                    <div key={i} className="bulk-preview-item">
                      <img src={src} alt={`Item ${i + 1}`} />
                      <button
                        className="bulk-preview-remove"
                        onClick={() => removeFile(i)}
                        aria-label="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="bulk-preview-add"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add more photos"
                  >
                    <Camera size={20} />
                    <span>Add more</span>
                  </button>
                </div>

                <button
                  className="btn btn-primary btn-full bulk-scan-btn"
                  onClick={startScanning}
                >
                  <Sparkles size={18} />
                  Scan {files.length} item{files.length > 1 ? 's' : ''} with AI
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2: Scanning Progress */}
        {step === 'scanning' && (
          <div className="bulk-scanning">
            <div className="scan-animation">
              <Sparkles size={40} className="scan-sparkle" />
            </div>
            <p className="scan-status">
              Analyzing {scanProgress} of {files.length} items...
            </p>
            <div className="scan-progress-bar">
              <div
                className="scan-progress-fill"
                style={{ width: `${(scanProgress / files.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Review & Edit */}
        {step === 'review' && (
          <div className="bulk-review">
            <p className="bulk-review-hint">
              <Sparkles size={14} /> AI detected details — review and add price/brand
            </p>
            <div className="bulk-review-list">
              {items.map((item, i) => (
                <div key={i} className="bulk-review-item card">
                  <img src={item.preview} alt={item.name} className="review-item-img" />
                  <div className="review-item-details">
                    {editingIndex === i ? (
                      <div className="review-edit-form">
                        <input
                          value={item.name}
                          onChange={e => updateItem(i, 'name', e.target.value)}
                          placeholder="Name"
                          className="review-input"
                        />
                        <div className="review-edit-row">
                          <select
                            value={item.category}
                            onChange={e => updateItem(i, 'category', e.target.value)}
                            className="review-input"
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input
                            value={item.color || ''}
                            onChange={e => updateItem(i, 'color', e.target.value)}
                            placeholder="Color"
                            className="review-input"
                          />
                        </div>
                        <div className="review-edit-row">
                          <input
                            value={item.brand || ''}
                            onChange={e => updateItem(i, 'brand', e.target.value)}
                            placeholder="Brand"
                            className="review-input"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.purchasePrice}
                            onChange={e => updateItem(i, 'purchasePrice', e.target.value)}
                            placeholder="Price $"
                            className="review-input"
                          />
                        </div>
                        <div className="review-edit-row">
                          <input
                            type="date"
                            value={item.purchaseDate || ''}
                            onChange={e => updateItem(i, 'purchaseDate', e.target.value)}
                            className="review-input"
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.estimatedWears || ''}
                            onChange={e => updateItem(i, 'estimatedWears', e.target.value)}
                            placeholder="Est. wears"
                            className="review-input"
                          />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingIndex(null)}>
                          <Check size={14} /> Done
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="review-item-header">
                          <span className="review-item-name">{item.name}</span>
                          <div className="review-item-actions">
                            <button
                              className="btn-icon-sm"
                              onClick={() => setEditingIndex(i)}
                              aria-label="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="btn-icon-sm btn-icon-danger"
                              onClick={() => removeItem(i)}
                              aria-label="Remove"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="review-item-tags">
                          <span className="badge badge-primary">{item.category}</span>
                          {item.color && <span className="badge">{item.color}</span>}
                          {item.brand && <span className="badge">{item.brand}</span>}
                          {item.purchasePrice && <span className="badge badge-accent">${item.purchasePrice}</span>}
                        </div>
                        {item.confidence === 'low' && (
                          <span className="review-warning">
                            <AlertCircle size={12} /> Low confidence — please review
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bulk-review-footer">
              <button
                className="btn btn-primary btn-full"
                onClick={saveAllItems}
                disabled={items.length === 0}
              >
                <Check size={18} />
                Save {items.length} item{items.length > 1 ? 's' : ''} to Wardrobe
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Saving Progress */}
        {step === 'saving' && (
          <div className="bulk-scanning">
            <Loader size={40} className="save-spinner" />
            <p className="scan-status">
              Saving {saveProgress} of {items.length} items...
            </p>
            <div className="scan-progress-bar">
              <div
                className="scan-progress-fill"
                style={{ width: `${(saveProgress / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
