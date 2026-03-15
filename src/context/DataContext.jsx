import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    if (!user) {
      setItems([]);
      setOutfits([]);
      setLoading(false);
      return;
    }

    // Skip if data was fetched less than 30 seconds ago (unless forced)
    if (!force && lastFetch && Date.now() - lastFetch < 30000) {
      return;
    }

    setLoading(true);
    try {
      const [itemsSnap, outfitsSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'items')),
        getDocs(query(collection(db, 'users', user.uid, 'outfits'), orderBy('wornAt', 'desc'))),
      ]);

      const itemList = [];
      itemsSnap.forEach(doc => itemList.push({ id: doc.id, ...doc.data() }));
      itemList.sort((a, b) => (b.totalWears || 0) - (a.totalWears || 0));

      const outfitList = [];
      outfitsSnap.forEach(doc => outfitList.push({ id: doc.id, ...doc.data() }));

      setItems(itemList);
      setOutfits(outfitList);
      setLastFetch(Date.now());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, lastFetch]);

  // Fetch on user login
  useEffect(() => {
    if (user) fetchData(true);
    else {
      setItems([]);
      setOutfits([]);
      setLoading(false);
      setLastFetch(null);
    }
  }, [user]);

  // Force refresh — call this after adding/editing/deleting items or outfits
  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return (
    <DataContext.Provider value={{ items, outfits, loading, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
