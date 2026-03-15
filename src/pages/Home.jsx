import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ShirtIcon, TrendingUp, Calendar, Plus, Flame, Sparkles, RefreshCw, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUtilization } from '../utils/utilization';
import LogOutfitModal from '../components/LogOutfitModal';
import './Home.css';

const DISPLAY_CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];

const STYLE_TIPS = [
  "Dress how you want to be addressed.",
  "The best outfit is the one you feel confident in.",
  "Your wardrobe should spark joy, not stress.",
  "Quality over quantity — always.",
  "Repeat outfits. Icons do it all the time.",
  "Cost per wear > price tag.",
  "When in doubt, wear black.",
  "Great style is knowing who you are.",
  "Invest in basics, experiment with accessories.",
  "The most sustainable outfit is the one already in your closet.",
  "Comfort is the new luxury.",
  "Mix high and low — nobody can tell.",
  "Your outfit is your armor for the day.",
  "Seasonal rotation keeps your wardrobe fresh.",
  "Track what you wear. Donate what you don't.",
];

function getDailyTip() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return STYLE_TIPS[dayOfYear % STYLE_TIPS.length];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function Home() {
  const { user } = useAuth();
  const { items, outfits, loading } = useData();
  const [showLogModal, setShowLogModal] = useState(false);

  const { topByCategory, streak, wearAgain, donateCount, donateValue, stats } = useMemo(() => {
    // Category top items
    const categoryMap = {};
    items.forEach(item => {
      const cat = item.category || 'Other';
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(item);
    });
    const topItems = {};
    for (const [cat, catItems] of Object.entries(categoryMap)) {
      catItems.sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0));
      if (catItems[0]) topItems[cat] = catItems[0];
    }

    // Calculate streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toDateString();
      const hasOutfit = outfits.some(o => {
        const d = o.wornAt?.seconds ? new Date(o.wornAt.seconds * 1000) : new Date(o.wornAt);
        return d.toDateString() === dateStr;
      });
      if (hasOutfit) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Find item to wear again
    const wornItems = items
      .filter(i => (i.totalWears || 0) > 0 && i.lastWornAt)
      .sort((a, b) => {
        const aTime = a.lastWornAt?.seconds || 0;
        const bTime = b.lastWornAt?.seconds || 0;
        return aTime - bTime;
      });
    const suggestion = wornItems[0] || null;

    // Calculate donate nudge
    const lowUtil = items
      .map(item => ({ ...item, util: getUtilization(item) }))
      .filter(item => item.util.level === 'LOW');

    return {
      topByCategory: topItems,
      streak: currentStreak,
      wearAgain: suggestion,
      donateCount: lowUtil.length,
      donateValue: lowUtil.reduce((s, i) => s + (i.purchasePrice || 0), 0),
      stats: { totalItems: items.length, totalOutfits: outfits.length },
    };
  }, [items, outfits]);

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const activeCategories = DISPLAY_CATEGORIES.filter(c => topByCategory[c]);

  return (
    <div className="page home-page">
      {/* Hero Card */}
      <div className="hero-card">
        <div className="hero-top">
          <div className="hero-brand">
            <span className="hero-logo"><ShirtIcon size={20} /></span>
            <span className="hero-app-name">Drobe</span>
          </div>
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="home-avatar"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <div className="hero-greeting">
          <p className="hero-date">{formatToday()}</p>
          <h1 className="hero-name">{getGreeting()}, {firstName}</h1>
        </div>
        {streak > 0 && (
          <div className="hero-streak">
            <Flame size={16} />
            <span>{streak}-day logging streak!</span>
          </div>
        )}
      </div>

      {/* Style Tip */}
      <div className="tip-card card">
        <Sparkles size={16} className="tip-icon" />
        <p className="tip-text">"{getDailyTip()}"</p>
      </div>

      {/* Donate Nudge */}
      {donateCount > 0 && (
        <Link to="/stats" className="donate-nudge card">
          <Heart size={18} className="donate-icon" />
          <div className="donate-text">
            <strong>{donateCount} item{donateCount !== 1 ? 's' : ''} could find a new home</strong>
            {donateValue > 0 && <span className="donate-value">${donateValue.toFixed(0)} in idle value</span>}
          </div>
        </Link>
      )}

      {/* Log CTA */}
      <button className="home-cta" onClick={() => setShowLogModal(true)}>
        <Plus size={20} />
        <span>Log today's outfit</span>
      </button>

      {/* Quick Stats */}
      <div className="home-stats-grid">
        <div className="card stat-card">
          <ShirtIcon size={20} className="stat-icon" />
          <span className="stat-value">{loading ? '–' : stats.totalItems}</span>
          <span className="stat-label">Items</span>
        </div>
        <div className="card stat-card">
          <Calendar size={20} className="stat-icon" />
          <span className="stat-value">{loading ? '–' : stats.totalOutfits}</span>
          <span className="stat-label">Outfits</span>
        </div>
        <div className="card stat-card">
          <TrendingUp size={20} className="stat-icon" />
          <span className="stat-value">
            {loading ? '–' : activeCategories.length > 0
              ? Math.max(...Object.values(topByCategory).map(i => i.totalWears || 0))
              : '–'}
          </span>
          <span className="stat-label">Top wears</span>
        </div>
      </div>

      {/* Wear It Again */}
      {wearAgain && (
        <div className="home-section">
          <h3 className="section-title">
            <RefreshCw size={16} /> Wear It Again?
          </h3>
          <Link to={`/wardrobe/${wearAgain.id}`} className="card wear-again-card">
            {wearAgain.photoURL ? (
              <img src={wearAgain.photoURL} alt={wearAgain.name} className="wear-again-img" />
            ) : (
              <div className="wear-again-placeholder">
                <ShirtIcon size={24} />
              </div>
            )}
            <div className="wear-again-info">
              <span className="wear-again-name">{wearAgain.name}</span>
              <span className="wear-again-meta">
                Last worn {wearAgain.lastWornAt
                  ? new Date(wearAgain.lastWornAt.seconds ? wearAgain.lastWornAt.seconds * 1000 : wearAgain.lastWornAt)
                    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'a while ago'
                } · {wearAgain.totalWears} wears
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Most Worn by Category */}
      {activeCategories.length > 0 && (
        <div className="home-section">
          <h3 className="section-title">Most Worn by Category</h3>
          <div className="category-tops-list">
            {activeCategories.map(cat => {
              const item = topByCategory[cat];
              if (!item) return null;
              return (
                <Link key={cat} to={`/wardrobe/${item.id}`} className="card category-top-card">
                  <div className="category-top-left">
                    {item.photoURL ? (
                      <img src={item.photoURL} alt={item.name} className="category-top-img" />
                    ) : (
                      <div className="category-top-placeholder">
                        <ShirtIcon size={20} />
                      </div>
                    )}
                  </div>
                  <div className="category-top-info">
                    <span className="category-top-cat">{cat}</span>
                    <span className="category-top-name">{item.name}</span>
                    <span className="category-top-meta">{item.totalWears || 0} wears{item.brand ? ` · ${item.brand}` : ''}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!loading && stats.totalItems === 0 && (
        <div className="empty-state">
          <ShirtIcon size={64} />
          <h3>Your wardrobe is empty</h3>
          <p>Start by adding your first clothing item</p>
          <Link to="/wardrobe" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            Add your first item
          </Link>
        </div>
      )}

      {showLogModal && (
        <LogOutfitModal
          onClose={() => setShowLogModal(false)}
          onComplete={() => {
            setShowLogModal(false);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
