import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Search, Plus, ImagePlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function getAvatar(username: string, url?: string | null) {
  return url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
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

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('dm_conversations')
        .select('*, p1:profiles!dm_conversations_participant_one_fkey(id, username, display_name, avatar_url), p2:profiles!dm_conversations_participant_two_fkey(id, username, display_name, avatar_url)')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('created_at', { ascending: false }) as any;

      const withLastMsg = await Promise.all((data || []).map(async (c: any) => {
        const other = c.p1.id === user.id ? c.p2 : c.p1;
        const { data: msgs } = await supabase.from('dm_messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1);
        return { ...c, other, lastMessage: msgs?.[0] || null };
      }));
      setConversations(withLastMsg);
      setLoadingConvos(false);
    };
    fetch();
  }, [user]);

  // Fetch messages for conversation
  useEffect(() => {
    if (!conversationId || !user) return;
    setLoadingMessages(true);
    const fetch = async () => {
      const { data: convo } = await supabase.from('dm_conversations').select('*, p1:profiles!dm_conversations_participant_one_fkey(id, username, display_name, avatar_url), p2:profiles!dm_conversations_participant_two_fkey(id, username, display_name, avatar_url)').eq('id', conversationId).single() as any;
      if (convo) {
        const other = convo.p1.id === user.id ? convo.p2 : convo.p1;
        setOtherProfile(other);
      }
      const { data: msgs } = await supabase.from('dm_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
      setMessages(msgs || []);
      setLoadingMessages(false);
      // Mark received messages as read
      await supabase.from('dm_messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId).neq('sender_id', user.id).is('read_at', null);
    };
    fetch();

    // Realtime
    const channel = supabase.channel('dm-' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if ((payload.new as any).sender_id !== user.id) {
          supabase.from('dm_messages').update({ read_at: new Date().toISOString() }).eq('id', (payload.new as any).id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.eventType === 'DELETE' || (payload.new as any)?.user_id === user.id) {
          setTyping(false);
        } else {
          setTyping(true);
          setTimeout(() => setTyping(false), 4000);
        }
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

  // New DM user search
  useEffect(() => {
    if (!userSearch) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${userSearch}%,display_name.ilike.%${userSearch}%`).neq('id', user?.id || '').limit(10);
      setUserResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, user]);

  const startConversation = async (otherId: string) => {
    if (!user) return;
    const [a, b] = [user.id, otherId].sort();
    // Check if exists
    const { data: existing } = await supabase.from('dm_conversations').select('id').match({ participant_one: a, participant_two: b }).single();
    if (existing) {
      navigate(`/dm/${existing.id}`);
    } else {
      const { data: newConvo } = await supabase.from('dm_conversations').insert({ participant_one: a, participant_two: b }).select('id').single();
      if (newConvo) navigate(`/dm/${newConvo.id}`);
    }
    setNewDmModal(false);
  };

  const filteredConvos = conversations.filter(c => !searchQuery || c.other?.username?.toLowerCase().includes(searchQuery.toLowerCase()) || c.other?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const showChat = conversationId;
  const showList = !conversationId;

  return (
    <div className="max-w-4xl mx-auto flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)]">
      {/* Conversation list */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 border-r bg-card`}>
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-heading font-bold text-foreground">Messages</h2>
          <button onClick={() => setNewDmModal(true)} className="p-2 rounded-full hover:bg-secondary transition text-primary"><Plus className="w-5 h-5" /></button>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-secondary rounded-full text-sm text-foreground outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
            filteredConvos.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No conversations yet</p> :
            filteredConvos.map(c => (
              <button key={c.id} onClick={() => navigate(`/dm/${c.id}`)} className={`w-full flex items-center gap-3 p-3 hover:bg-secondary transition text-left ${conversationId === c.id ? 'bg-secondary' : ''}`}>
                <img src={getAvatar(c.other?.username, c.other?.avatar_url)} alt="" className="w-10 h-10 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.other?.display_name || c.other?.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage?.content?.slice(0, 40) || 'No messages yet'}</p>
                </div>
                {c.lastMessage && (
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.lastMessage.created_at), { addSuffix: false })}</span>
                )}
              </button>
            ))
          }
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${showChat ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-background`}>
        {conversationId ? (
          <>
            <div className="h-14 border-b bg-card flex items-center gap-3 px-4">
              <button onClick={() => navigate('/dm')} className="md:hidden p-1"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
              {otherProfile && (
                <>
                  <img src={getAvatar(otherProfile.username, otherProfile.avatar_url)} alt="" className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{otherProfile.display_name || otherProfile.username}</p>
                    <p className="text-xs text-muted-foreground">@{otherProfile.username}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMessages ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
                messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id;
                  const showAvatar = !isMine && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {!isMine && showAvatar && otherProfile && (
                        <img src={getAvatar(otherProfile.username, otherProfile.avatar_url)} alt="" className="w-7 h-7 rounded-full mr-2 mt-1" />
                      )}
                      {!isMine && !showAvatar && <div className="w-7 mr-2" />}
                      <div className={`max-w-[70%] px-3 py-2 text-sm ${isMine ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm' : 'bg-secondary text-foreground rounded-2xl rounded-bl-sm'}`}>
                        {msg.content}
                        <p className={`text-[10px] mt-0.5 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t bg-card p-3 flex gap-2">
              <input
                value={content}
                onChange={e => { setContent(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-secondary rounded-full text-sm text-foreground outline-none"
              />
              <button onClick={handleSend} disabled={sending || !content.trim()} className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center text-muted-foreground">
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* New DM modal */}
      {newDmModal && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setNewDmModal(false)}>
          <div className="bg-card rounded-lg border p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-heading font-bold text-foreground mb-3">New Message</h3>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." className="w-full px-3 py-2 bg-secondary rounded-lg text-foreground outline-none mb-3" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {userResults.map(u => (
                <button key={u.id} onClick={() => startConversation(u.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition text-left">
                  <img src={getAvatar(u.username, u.avatar_url)} alt="" className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.display_name || u.username}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </button>
              ))}
              {userSearch && userResults.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
