import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Search, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export default function DM() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [typing, setTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDmModal, setNewDmModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => { document.title = 'Pulse 23 · Messages'; }, []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('dm_conversations')
          .select('*, p1:profiles!dm_conversations_participant_one_fkey(id, username, display_name, avatar_url), p2:profiles!dm_conversations_participant_two_fkey(id, username, display_name, avatar_url)')
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
          .order('created_at', { ascending: false }) as any;

        const withLastMsg = await Promise.all((data || []).map(async (c: any) => {
          const other = c.p1.id === user.id ? c.p2 : c.p1;
          const { data: msgs } = await supabase.from('dm_messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1);
          const { count } = await supabase.from('dm_messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user.id).is('read_at', null);
          return { ...c, other, lastMessage: msgs?.[0] || null, unreadCount: count || 0 };
        }));
        setConversations(withLastMsg);
      } catch { toast.error('Failed to load conversations'); }
      setLoadingConvos(false);
    };
    fetch();
  }, [user]);

  useEffect(() => {
    if (!conversationId || !user) return;
    setLoadingMessages(true);
    const fetch = async () => {
      try {
        const { data: convo } = await supabase.from('dm_conversations').select('*, p1:profiles!dm_conversations_participant_one_fkey(id, username, display_name, avatar_url), p2:profiles!dm_conversations_participant_two_fkey(id, username, display_name, avatar_url)').eq('id', conversationId).single() as any;
        if (convo) setOtherProfile(convo.p1.id === user.id ? convo.p2 : convo.p1);
        const { data: msgs } = await supabase.from('dm_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        setMessages(msgs || []);
        await supabase.from('dm_messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).neq('sender_id', user.id).is('read_at', null);
      } catch { toast.error('Failed to load messages'); }
      setLoadingMessages(false);
    };
    fetch();

    const channel = supabase.channel('dm-' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if ((payload.new as any).sender_id !== user.id) {
          supabase.from('dm_messages').update({ read_at: new Date().toISOString() }).eq('id', (payload.new as any).id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.eventType === 'DELETE' || (payload.new as any)?.user_id === user.id) setTyping(false);
        else { setTyping(true); setTimeout(() => setTyping(false), 4000); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const handleSend = async () => {
    if (!user || !content.trim() || !conversationId) return;
    setSending(true);
    const msg = { conversation_id: conversationId, sender_id: user.id, content: content.trim() };
    setMessages(prev => [...prev, { ...msg, id: 'temp-' + Date.now(), created_at: new Date().toISOString() }]);
    setContent('');
    try {
      await supabase.from('dm_messages').insert(msg);
      await supabase.from('dm_typing').delete().match({ conversation_id: conversationId, user_id: user.id });
    } catch { toast.error('Failed to send'); }
    setSending(false);
  };

  const handleTyping = () => {
    if (!user || !conversationId) return;
    supabase.from('dm_typing').upsert({ conversation_id: conversationId, user_id: user.id, updated_at: new Date().toISOString() });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      supabase.from('dm_typing').delete().match({ conversation_id: conversationId, user_id: user.id });
    }, 3000);
  };

  useEffect(() => {
    if (!userSearch) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${userSearch}%,display_name.ilike.%${userSearch}%`).neq('id', user?.id || '').limit(10);
        setUserResults(data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, user]);

  const startConversation = async (otherId: string) => {
    if (!user) return;
    const [a, b] = [user.id, otherId].sort();
    try {
      const { data: existing } = await supabase.from('dm_conversations').select('id').match({ participant_one: a, participant_two: b }).single();
      if (existing) { navigate(`/dm/${existing.id}`); }
      else {
        const { data: newConvo } = await supabase.from('dm_conversations').insert({ participant_one: a, participant_two: b }).select('id').single();
        if (newConvo) navigate(`/dm/${newConvo.id}`);
      }
    } catch { toast.error('Failed'); }
    setNewDmModal(false);
  };

  const filteredConvos = conversations.filter(c => !searchQuery || c.other?.username?.toLowerCase().includes(searchQuery.toLowerCase()) || c.other?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const showChat = conversationId;
  const showList = !conversationId;

  return (
    <div className="max-w-4xl mx-auto flex h-[calc(100vh)] md:h-screen">
      {/* Conversation list */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950`}>
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-zinc-900 dark:text-white">Messages</h2>
          <button onClick={() => setNewDmModal(true)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-blue-600" aria-label="New message"><Plus className="w-5 h-5" /></button>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex-1 space-y-2"><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" /><div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" /></div>
              </div>
            ))
          ) : filteredConvos.length === 0 ? (
            <div className="text-center py-16">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
                <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" className="text-zinc-200 dark:text-zinc-700" />
                <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-300 dark:text-zinc-600" />
              </svg>
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No conversations yet</p>
              <p className="text-xs text-zinc-400 mt-1">Start one from Explore</p>
            </div>
          ) : filteredConvos.map(c => (
            <button key={c.id} onClick={() => navigate(`/dm/${c.id}`)} className={`w-full flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition text-left ${conversationId === c.id ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}>
              <img src={getAvatar(c.other?.username, c.other?.avatar_url)} alt={c.other?.username || ''} className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${c.unreadCount > 0 ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>{c.other?.display_name || c.other?.username}</p>
                <p className="text-xs text-zinc-400 truncate">{c.lastMessage?.content?.slice(0, 40) || 'No messages yet'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.lastMessage && <span className="text-[10px] text-zinc-400">{formatDistanceToNow(new Date(c.lastMessage.created_at), { addSuffix: false })}</span>}
                {c.unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${showChat ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-slate-50 dark:bg-zinc-950`}>
        {conversationId ? (
          <>
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center gap-3 px-4">
              <button onClick={() => navigate('/dm')} className="md:hidden p-1" aria-label="Back"><ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" /></button>
              {otherProfile && (
                <>
                  <img src={getAvatar(otherProfile.username, otherProfile.avatar_url)} alt={otherProfile.username} className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{otherProfile.display_name || otherProfile.username}</p>
                    <p className="text-xs text-zinc-400">@{otherProfile.username}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMessages ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> :
                messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 text-sm ${isMine ? 'bg-blue-600 text-white rounded-2xl rounded-br-none' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl rounded-bl-none'}`}>
                        {msg.content}
                        <p className={`text-[10px] mt-0.5 ${isMine ? 'text-blue-200' : 'text-zinc-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && <span className="ml-1">{msg.read_at ? ' Read' : ' Delivered'}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              }
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 flex gap-2">
              <input
                value={content}
                onChange={e => { setContent(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white outline-none"
              />
              <button onClick={handleSend} disabled={sending || !content.trim()} className="p-2 bg-blue-600 text-white rounded-xl disabled:opacity-50" aria-label="Send">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center text-zinc-400">
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {newDmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setNewDmModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">New Message</h3>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white outline-none mb-3" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {userResults.map(u => (
                <button key={u.id} onClick={() => startConversation(u.id)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left">
                  <img src={getAvatar(u.username, u.avatar_url)} alt={u.username} className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{u.display_name || u.username}</p>
                    <p className="text-xs text-zinc-400">@{u.username}</p>
                  </div>
                </button>
              ))}
              {userSearch && userResults.length === 0 && <p className="text-sm text-zinc-400 text-center py-4">No users found</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
