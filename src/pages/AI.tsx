import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Plus, Fish, Loader2, Copy, Trash2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShiningText } from '@/components/ui/shining-text';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function AI() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { document.title = 'Pulse 23 · Nemo'; }, []);

  // Handle fish upload from post
  useEffect(() => {
    const upload = searchParams.get('upload');
    if (upload) {
      setInput(upload);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    supabase.from('ai_conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
      setConversations(data || []);
    });
  }, [user]);

  const loadConversation = async (id: string) => {
    setActiveConvo(id);
    const { data } = await supabase.from('ai_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    setMessages((data || []).map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
  };

  const newChat = () => {
    setActiveConvo(null);
    setMessages([]);
    setStreamingText('');
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '44px';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || streaming || !user) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    setStreaming(true);
    setStreamingText('');

    let convoId = activeConvo;
    if (!convoId) {
      const { data } = await supabase.from('ai_conversations').insert({ user_id: user.id, title: userMsg.content.slice(0, 60) }).select('id').single();
      if (data) {
        convoId = data.id;
        setActiveConvo(convoId);
        setConversations(prev => [{ id: data.id, title: userMsg.content.slice(0, 60), created_at: new Date().toISOString() }, ...prev]);
      }
    }

    if (convoId) {
      await supabase.from('ai_messages').insert({ conversation_id: convoId, role: 'user', content: userMsg.content });
    }

    try {
      const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      let assistantContent = '';

      if (resp.headers.get('content-type')?.includes('text/event-stream') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') { streamDone = true; break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setStreamingText(assistantContent);
              }
            } catch { /* skip */ }
          }
        }
      } else {
        const data = await resp.json();
        assistantContent = data.choices?.[0]?.message?.content || JSON.stringify(data);
      }

      if (!assistantContent) assistantContent = 'Sorry, I could not generate a response.';

      const assistantMsg: Message = { role: 'assistant', content: assistantContent };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamingText('');

      if (convoId) {
        await supabase.from('ai_messages').insert({ conversation_id: convoId, role: 'assistant', content: assistantContent });
      }
    } catch (err) {
      toast.error('AI request failed');
      console.error(err);
    }
    setStreaming(false);
  };

  const deleteConvo = async (id: string) => {
    await supabase.from('ai_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvo === id) newChat();
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success('Copied!'); };

  const isEmpty = messages.length === 0 && !streamingText;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-muted-foreground">
        <p>Sign in to use Nemo</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen md:h-screen">
      {/* Conversation sidebar */}
      <div className="hidden lg:flex flex-col w-64 border-r bg-card">
        <div className="p-3 border-b">
          <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
            <Fish className="w-4 h-4 text-primary" /> Nemo
          </h2>
        </div>
        <button onClick={newChat} className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> New chat
        </button>
        <div className="flex-1 overflow-y-auto p-2 mt-2 space-y-1">
          {conversations.map(c => (
            <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition ${activeConvo === c.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <button onClick={() => loadConversation(c.id)} className="flex-1 text-left truncate">{c.title}</button>
              <button onClick={() => deleteConvo(c.id)} className="opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages or empty state */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex items-center justify-center h-full">
              <motion.div
                className="text-center space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Fish className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-heading font-bold text-foreground">How can I help today?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Ask Nemo anything</p>
                </div>

                {/* Centered input for empty state */}
                <div className="w-full max-w-lg mx-auto mt-6">
                  <div className="relative bg-card border rounded-2xl shadow-sm overflow-hidden">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); adjustHeight(); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Message Nemo..."
                      rows={1}
                      className="w-full px-4 py-3 pr-12 bg-transparent text-sm text-foreground outline-none resize-none min-h-[44px]"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={streaming || !input.trim()}
                      className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="p-4 space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5' : ''}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          code({ className, children, ...props }) {
                            const isBlock = className?.includes('language-');
                            if (isBlock) {
                              return (
                                <div className="relative group">
                                  <pre className="bg-secondary rounded-lg p-3 overflow-x-auto text-sm"><code {...props}>{children}</code></pre>
                                  <button onClick={() => copyCode(String(children))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-card rounded transition"><Copy className="w-3.5 h-3.5 text-muted-foreground" /></button>
                                </div>
                              );
                            }
                            return <code className="bg-secondary px-1 py-0.5 rounded text-sm" {...props}>{children}</code>;
                          }
                        }}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Streaming / thinking */}
              <AnimatePresence>
                {streaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[80%]">
                      {streamingText ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                          <span className="inline-block w-2 h-4 bg-primary animate-blink ml-0.5" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-xl">
                          <Fish className="w-4 h-4 text-primary animate-pulse" />
                          <ShiningText text="Nemo is thinking..." />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom input (only shown when messages exist) */}
        {!isEmpty && (
          <div className="border-t bg-card p-3">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-secondary rounded-2xl overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); adjustHeight(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message Nemo..."
                  rows={1}
                  className="w-full px-4 py-3 pr-12 bg-transparent text-sm text-foreground outline-none resize-none min-h-[44px]"
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition"
                >
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Nemo can make mistakes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
