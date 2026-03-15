import { LayoutGrid, List } from 'lucide-react';
import './ViewToggle.css';

export default function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${view === 'grid' ? 'active' : ''}`}
        onClick={() => onChange('grid')}
        aria-label="Grid view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
        onClick={() => onChange('list')}
        aria-label="List view"
      >
        <List size={16} />
      </button>
    </div>
  );
}
