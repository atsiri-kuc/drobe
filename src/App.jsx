import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import BottomNav from './components/BottomNav';
import Login from './components/Login';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import ItemDetail from './pages/ItemDetail';
import LogOutfit from './pages/LogOutfit';
import Stats from './pages/Stats';
import SeasonDetail from './pages/SeasonDetail';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/wardrobe" element={<ProtectedRoute><Wardrobe /></ProtectedRoute>} />
        <Route path="/wardrobe/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
        <Route path="/log" element={<ProtectedRoute><LogOutfit /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
        <Route path="/stats/season/:season" element={<ProtectedRoute><SeasonDetail /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
