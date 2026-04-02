import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pulse23-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pulse23-theme', 'light');
    }
  }, [dark]);

  return (
    <button onClick={() => setDark(d => !d)} className="p-2 rounded-full hover:bg-secondary transition" aria-label="Toggle theme">
      {dark ? <Sun className="w-5 h-5 text-foreground" /> : <Moon className="w-5 h-5 text-foreground" />}
    </button>
  );
}
