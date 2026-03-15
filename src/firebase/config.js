import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCWPkLafT2i4bBELsyyEMnL_yTLHPNuGEA",
  authDomain: "drobe-11168.firebaseapp.com",
  projectId: "drobe-11168",
  storageBucket: "drobe-11168.firebasestorage.app",
  messagingSenderId: "454669871640",
  appId: "1:454669871640:web:5289a0a1e5503cd5fff16d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
