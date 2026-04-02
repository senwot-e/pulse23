import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { document.title = 'Pulse 23 · Settings'; }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    navigate('/auth');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Settings</h1>
      <div className="bg-card border rounded-lg p-4">
        <button onClick={handleSignOut} className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-medium hover:opacity-90 transition">
          Sign Out
        </button>
      </div>
    </div>
  );
}
