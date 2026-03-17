'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const buildVisitorToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const mergeMessages = (existing, incoming) => {
  const map = new Map();
  [...existing, ...incoming].forEach((message) => {
    if (!message?.id) return;
    map.set(message.id, message);
  });
  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at) - new Date(right.created_at)
  );
};

function ChatbotWidgetContent() {
  const searchParams = useSearchParams();
  const adminId = searchParams.get('adminId') || '';
  const sourceUrl = searchParams.get('page') || '';
  const threadRef = useRef(null);

  const [visitorToken, setVisitorToken] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [config, setConfig] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!adminId || typeof window === 'undefined') return;
    const tokenKey = `aa_website_chat_visitor_${adminId}`;
    const profileKey = `aa_website_chat_profile_${adminId}`;
    const storedToken = window.localStorage.getItem(tokenKey) || buildVisitorToken();
    const storedProfile = window.localStorage.getItem(profileKey);
    window.localStorage.setItem(tokenKey, storedToken);
    setVisitorToken(storedToken);
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile);
        setProfile({
          name: typeof parsed?.name === 'string' ? parsed.name : '',
          email: typeof parsed?.email === 'string' ? parsed.email : '',
        });
      } catch {
        setProfile({ name: '', email: '' });
      }
    }
  }, [adminId]);

  useEffect(() => {
    if (!adminId || typeof window === 'undefined') return;
    window.localStorage.setItem(
      `aa_website_chat_profile_${adminId}`,
      JSON.stringify(profile)
    );
  }, [adminId, profile]);

  useEffect(() => {
    if (!adminId || !visitorToken) return;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setLoading(true);
        setError('');
        const [configResponse, sessionResponse] = await Promise.all([
          fetch(`/api/website-chat/public/config?adminId=${encodeURIComponent(adminId)}`),
          fetch(
            `/api/website-chat/public/session?adminId=${encodeURIComponent(
              adminId
            )}&visitorToken=${encodeURIComponent(visitorToken)}`
          ),
        ]);
        const [configData, sessionData] = await Promise.all([
          configResponse.json(),
          sessionResponse.json(),
        ]);

        if (!configResponse.ok) {
          throw new Error(configData?.error || 'This chatbot is not available right now.');
        }
        if (!sessionResponse.ok) {
          throw new Error(sessionData?.error || 'Could not load the chat.');
        }
        if (cancelled) return;

        setConfig(configData?.data || null);
        setSession(sessionData?.data?.session || null);
        setMessages(sessionData?.data?.messages || []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || 'Could not load the chatbot.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [adminId, visitorToken]);

  useEffect(() => {
    if (!adminId || !visitorToken || !session?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/website-chat/public/session?adminId=${encodeURIComponent(
            adminId
          )}&visitorToken=${encodeURIComponent(visitorToken)}&limit=120`,
          {
            cache: 'no-store',
          }
        );
        const data = await response.json();
        if (!response.ok || cancelled) return;
        setSession(data?.data?.session || null);
        setMessages(data?.data?.messages || []);
      } catch (_error) {
        // Ignore transient polling errors in the widget.
      }
    };

    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adminId, visitorToken, session?.id]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length]);

  const handleProfileChange = (field) => (event) =>
    setProfile((current) => ({ ...current, [field]: event.target.value }));

  const handleSend = async () => {
    const message = draft.trim();
    if (!adminId || !visitorToken || !message || sending) return;

    try {
      setSending(true);
      setError('');
      setStatus('');
      const response = await fetch('/api/website-chat/public/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          visitorToken,
          visitorName: profile.name,
          visitorEmail: profile.email,
          sourceUrl,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not send the message.');
      }

      setDraft('');
      setSession(data?.data?.session || null);
      setMessages((current) =>
        mergeMessages(current, [data?.data?.visitorMessage, data?.data?.assistantMessage].filter(Boolean))
      );
      if (data?.data?.botPaused) {
        setStatus('A team member will reply here manually.');
      }
    } catch (sendError) {
      setError(sendError.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const businessName = config?.businessName || 'Website Chat';
  const welcomeMessage =
    config?.welcomeMessage ||
    'Ask me about our products, services, bookings, pricing, or business details.';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,136,74,0.28),_transparent_40%),linear-gradient(180deg,#08111f_0%,#0f1f37_52%,#17263f_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col">
        <div className="border-b border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/55">
                Website Chatbot
              </p>
              <h1 className="mt-1 text-xl font-semibold">{businessName}</h1>
              <p className="mt-2 max-w-md text-sm text-white/70">{welcomeMessage}</p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                session?.bot_enabled === false
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'bg-emerald-400/15 text-emerald-200'
              }`}
            >
              {session?.bot_enabled === false ? 'Human reply mode' : 'AI active'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 bg-black/10 px-5 py-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Name
            </span>
            <input
              type="text"
              value={profile.name}
              onChange={handleProfileChange('name')}
              placeholder="Your name"
              className="w-full rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff8c5a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Email
            </span>
            <input
              type="email"
              value={profile.email}
              onChange={handleProfileChange('email')}
              placeholder="Optional"
              className="w-full rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff8c5a]"
            />
          </label>
        </div>

        <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-6 text-center text-sm text-white/70">
              Loading chat...
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
              Start with any question about products, services, bookings, pricing, delivery, or business details.
            </div>
          ) : null}

          {messages.map((message) => {
            const isVisitor = message.sender_type === 'visitor';
            const isAdmin = message.sender_type === 'admin';
            return (
              <div
                key={message.id}
                className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[22px] border px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ${
                    isVisitor
                      ? 'border-white/15 bg-[#ff8c5a] text-white'
                      : isAdmin
                        ? 'border-white/10 bg-[#1b2f4a] text-white'
                        : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.message_text}</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <p
                      className={`text-[11px] uppercase tracking-[0.14em] ${
                        isVisitor ? 'text-white/70' : isAdmin ? 'text-white/60' : 'text-slate-400'
                      }`}
                    >
                      {isAdmin ? 'Team' : isVisitor ? 'You' : businessName}
                    </p>
                    <p
                      className={`text-[11px] ${
                        isVisitor ? 'text-white/75' : isAdmin ? 'text-white/60' : 'text-slate-400'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {status ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              {status}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-[#08111f]/80 px-5 py-4 backdrop-blur">
          <div className="flex items-end gap-3">
            <div className="flex-1 rounded-[26px] border border-white/12 bg-white/5 px-3 py-2 shadow-[0_16px_36px_rgba(0,0,0,0.2)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={2}
                placeholder="Ask about services, bookings, pricing, or delivery..."
                className="min-h-[56px] w-full resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:ring-0"
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="inline-flex h-14 min-w-[104px] items-center justify-center rounded-[22px] bg-[#ff7a45] px-5 text-sm font-semibold text-white transition hover:bg-[#ff6830] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatbotWidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0f1f37] text-sm text-white/70">
          Loading chat...
        </div>
      }
    >
      <ChatbotWidgetContent />
    </Suspense>
  );
}
