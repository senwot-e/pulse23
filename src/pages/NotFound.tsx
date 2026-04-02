import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export default function NotFound() {
  useEffect(() => { document.title = 'Pulse 23 · 404'; }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-heading font-bold text-primary mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-6">This page doesn&apos;t exist</p>
      <Link to="/feed" className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition">
        Go back to Feed
      </Link>
    </div>
  );
}
