import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Plus, Sparkles, Loader2, Copy, Trash2 } from 'lucide-react';
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Pulse 23 · AI'; }, []);

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

  const sendMessage = async () => {
    if (!input.trim() || streaming || !user) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
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

    // Save user message
    if (convoId) {
      await supabase.from('ai_messages').insert({ conversation_id: convoId, role: 'user', content: userMsg.content });
    }

    try {
      const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: apiMessages },
      });

      if (error) throw error;

      // The response might be streamed or not. Handle both cases.
      let assistantContent = '';
      if (typeof data === 'string') {
        // Try to parse SSE
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                assistantContent += parsed.delta.text;
                setStreamingText(assistantContent);
              }
            } catch { /* skip */ }
          }
        }
      } else if (data?.content) {
        // Non-streamed response
        assistantContent = typeof data.content === 'string' ? data.content : data.content[0]?.text || '';
        setStreamingText(assistantContent);
      } else if (data) {
        // Try raw text
        assistantContent = JSON.stringify(data);
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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-muted-foreground">
        <p>Sign in to use Pulse AI</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 border-r bg-card">
        <div className="p-3 border-b">
          <h2 className="font-heading font-bold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Pulse 23 AI</h2>
        </div>
        <button onClick={newChat} className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" /> New chat
        </button>
        <div className="flex-1 overflow-y-auto p-2 mt-2 space-y-1">
          {conversations.map(c => (
            <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition ${activeConvo === c.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              <button onClick={() => loadConversation(c.id)} className="flex-1 text-left truncate">{c.title}</button>
              <button onClick={() => deleteConvo(c.id)} className="opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-accent mx-auto mb-3" />
                <h3 className="text-lg font-heading font-bold text-foreground">Pulse 23 AI</h3>
                <p className="text-sm text-muted-foreground mt-1">Ask me anything. I'm here to help.</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2' : ''}`}>
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
            </div>
          ))}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] prose prose-sm dark:prose-invert max-w-none text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                <span className="inline-block w-2 h-4 bg-primary animate-blink ml-0.5" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-card p-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message Pulse AI..."
              rows={1}
              className="flex-1 px-4 py-3 bg-secondary rounded-xl text-sm text-foreground outline-none resize-none"
            />
            <button onClick={sendMessage} disabled={streaming || !input.trim()} className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50">
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">Pulse 23 AI can make mistakes</p>
        </div>
      </div>
    </div>
  );
}
