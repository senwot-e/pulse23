import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppSidebar from '@/components/AppSidebar';
import AdminEventListener from '@/components/AdminEventListener';
import Auth from '@/pages/Auth';
import Feed from '@/pages/Feed';
import Explore from '@/pages/Explore';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import DM from '@/pages/DM';
import AI from '@/pages/AI';
import PostDetail from '@/pages/PostDetail';
import Settings from '@/pages/Settings';
import Bookmarks from '@/pages/Bookmarks';
import ResetPassword from '@/pages/ResetPassword';
import Moderation from '@/pages/Moderation';
import NotFound from '@/pages/NotFound';

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex">
      <AppSidebar />
      <div className="flex-1 md:ml-[260px] pb-16 md:pb-0">
        <AdminEventListener />
        {children}
      </div>
    </div>
  );
}

const App = () => (
  <AuthProvider>
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: { borderRadius: '12px', background: '#18181B', color: '#fff', fontSize: '14px' },
        success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
      }}
    />
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="/bookmarks" element={<AppLayout><ProtectedRoute><Bookmarks /></ProtectedRoute></AppLayout>} />
        <Route path="/moderation" element={<AppLayout><Moderation /></AppLayout>} />
        <Route path="*" element={<AppLayout><NotFound /></AppLayout>} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
