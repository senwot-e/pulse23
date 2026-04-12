import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bell, MessageSquare, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  // Navbar is now replaced by AppSidebar; this is kept as a fallback/no-op
  return null;
}
