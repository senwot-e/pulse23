import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Auth from '@/pages/Auth';
import Feed from '@/pages/Feed';
import Explore from '@/pages/Explore';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import DM from '@/pages/DM';
import AI from '@/pages/AI';
import PostDetail from '@/pages/PostDetail';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      {children}
    </div>
  );
}

const App = () => (
  <AuthProvider>
    <Toaster position="top-right" toastOptions={{
      className: '!bg-card !text-foreground !border !border-border',
    }} />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<AppLayout><Feed /></AppLayout>} />
        <Route path="/explore" element={<AppLayout><Explore /></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><ProtectedRoute><Notifications /></ProtectedRoute></AppLayout>} />
        <Route path="/dm" element={<AppLayout><ProtectedRoute><DM /></ProtectedRoute></AppLayout>} />
        <Route path="/dm/:conversationId" element={<AppLayout><ProtectedRoute><DM /></ProtectedRoute></AppLayout>} />
        <Route path="/ai" element={<AppLayout><AI /></AppLayout>} />
        <Route path="/profile/:username" element={<AppLayout><Profile /></AppLayout>} />
        <Route path="/post/:id" element={<AppLayout><PostDetail /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><ProtectedRoute><Settings /></ProtectedRoute></AppLayout>} />
        <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
