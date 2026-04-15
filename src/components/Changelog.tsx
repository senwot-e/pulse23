import { X, Sparkles, Zap, Shield, BookOpen, MessageSquare, Fish } from 'lucide-react';

interface ChangelogProps {
  onClose: () => void;
}

const entries = [
  {
    version: '2.3.0',
    date: 'April 2026',
    items: [
      { icon: Shield, text: 'New beta code system — unlock hidden features from Settings' },
      { icon: Zap, text: 'User reports — report profiles directly from their page' },
      { icon: BookOpen, text: 'Changelog viewer — you\'re looking at it!' },
    ],
  },
  {
    version: '2.2.0',
    date: 'April 2026',
    items: [
      { icon: Sparkles, text: 'Nemo AI — your AI assistant, now with post analysis' },
      { icon: Fish, text: 'Fish button — send any post to Nemo for analysis' },
      { icon: MessageSquare, text: 'Real-time DM typing indicators' },
    ],
  },
  {
    version: '2.1.0',
    date: 'April 2026',
    items: [
      { icon: Zap, text: 'Custom badges and verified profiles' },
      { icon: BookOpen, text: 'Bookmarks page — save posts for later' },
      { icon: Shield, text: 'Enhanced privacy settings and account controls' },
    ],
  },
  {
    version: '2.0.0',
    date: 'March 2026',
    items: [
      { icon: Sparkles, text: 'Complete UI overhaul with new sidebar navigation' },
      { icon: Zap, text: 'Dark mode with flash prevention' },
      { icon: MessageSquare, text: 'Direct messaging with image support' },
      { icon: Shield, text: 'New beta code — unlock early features' },
    ],
  },
];

export default function Changelog({ onClose }: ChangelogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">What's New</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-6">
          {entries.map(entry => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-blue-100 dark:bg-blue-950/30 text-blue-600 px-2 py-0.5 rounded-full">v{entry.version}</span>
                <span className="text-xs text-zinc-400">{entry.date}</span>
              </div>
              <div className="space-y-2">
                {entry.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
