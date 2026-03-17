'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Loader from '../components/common/Loader.jsx';
import { useAuth } from '../components/auth/AuthProvider.jsx';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getVisitorLabel = (session) => {
  if (!session) return 'Visitor';
  return (
    session.visitor_name ||
    session.visitor_email ||
    session.visitor_phone ||
    `Visitor #${session.id}`
  );
};

const getInitials = (session) => {
  const label = getVisitorLabel(session);
  const parts = String(label).split(/[\s@._-]+/).filter(Boolean);
  return `${parts[0]?.[0] || 'V'}${parts[1]?.[0] || ''}`.toUpperCase();
};

const buildScriptSnippet = (origin, adminId) =>
  `<script src="${origin}/chatbot-loader.js" data-admin-id="${adminId}" data-button-text="Chat with us" defer></script>`;

export default function WebsiteChatPage() {
  const { user } = useAuth();
  const threadViewportRef = useRef(null);

  const [origin, setOrigin] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const embedSnippet = useMemo(() => {
    if (!origin || !user?.id) return '';
    return buildScriptSnippet(origin, user.id);
  }, [origin, user?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadSessions = async (currentSearch = search, currentStatus = statusFilter, keepSelection = true) => {
    try {
      const params = new URLSearchParams();
      if (currentSearch.trim()) params.set('q', currentSearch.trim());
      if (currentStatus !== 'all') params.set('status', currentStatus);
      params.set('limit', '60');
      const response = await fetch(`/api/website-chat?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not load website chats.');
      }

      const nextSessions = data?.data || [];
      setSessions(nextSessions);
      if (!keepSelection) {
        setSelectedSessionId(nextSessions[0]?.id || null);
        return;
      }
      if (!nextSessions.some((session) => session.id === selectedSessionId)) {
        setSelectedSessionId(nextSessions[0]?.id || null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load website chats.');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (sessionId) => {
    if (!sessionId) {
      setSelectedSession(null);
      setMessages([]);
      return;
    }
    try {
      setThreadLoading(true);
      const response = await fetch(`/api/website-chat/${sessionId}/messages?limit=200`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not load the chat thread.');
      }
      setSelectedSession(data?.data?.session || null);
      setMessages(data?.data?.messages || []);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('aa-badge-refresh'));
      }
    } catch (threadError) {
      setError(threadError.message || 'Could not load the chat thread.');
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadSessions(search, statusFilter, false);
    const timer = setInterval(() => {
      loadSessions(search, statusFilter, true);
    }, 8000);
    return () => clearInterval(timer);
  }, [user?.id, search, statusFilter]);

  useEffect(() => {
    loadThread(selectedSessionId);
    if (!selectedSessionId) return;
    const timer = setInterval(() => {
      loadThread(selectedSessionId);
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!threadViewportRef.current) return;
    threadViewportRef.current.scrollTop = threadViewportRef.current.scrollHeight;
  }, [messages.length]);

  const copySnippet = async () => {
    if (!embedSnippet) return;
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setStatusMessage('Script snippet copied.');
      setTimeout(() => setStatusMessage(''), 2400);
    } catch (_error) {
      setError('Could not copy the script snippet.');
    }
  };

  const sendReply = async () => {
    if (!selectedSessionId || !draft.trim() || sending) return;
    try {
      setSending(true);
      setError('');
      const response = await fetch(`/api/website-chat/${selectedSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: draft.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not send the reply.');
      }
      setDraft('');
      setStatusMessage('Reply sent. Bot paused for manual follow-up.');
      setTimeout(() => setStatusMessage(''), 2400);
      await loadSessions(search, statusFilter, true);
      await loadThread(selectedSessionId);
    } catch (sendError) {
      setError(sendError.message || 'Could not send the reply.');
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async () => {
    if (!selectedSessionId || !selectedSession) return;
    try {
      setError('');
      const response = await fetch(`/api/website-chat/${selectedSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bot_enabled: selectedSession.bot_enabled !== true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not update bot status.');
      }
      setSelectedSession(data?.data || null);
      await loadSessions(search, statusFilter, true);
      setStatusMessage(
        data?.data?.bot_enabled === false ? 'AI paused for this chat.' : 'AI resumed for this chat.'
      );
      setTimeout(() => setStatusMessage(''), 2400);
    } catch (toggleError) {
      setError(toggleError.message || 'Could not update bot status.');
    }
  };

  if (!user?.id && loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader size="md" text="Loading website chatbot..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-orange-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(255,247,240,0.94))]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-aa-orange">
              Website Chatbot
            </p>
            <h1 className="mt-2 text-2xl font-bold text-aa-dark-blue">Embed once, manage from here</h1>
            <p className="mt-3 text-sm leading-6 text-aa-gray">
              Add the script below to any website. It loads the floating chatbot button, opens the
              hosted widget, and sends every visitor chat into this panel for AI or manual reply.
            </p>
          </div>
          <div className="rounded-3xl bg-aa-dark-blue/95 p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.28)] lg:max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
              Script Snippet
            </p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-black/20 p-4 text-xs leading-6 text-white/90">
              {embedSnippet || 'Loading snippet...'}
            </pre>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={copySnippet} className="!px-4 !py-2">
                Copy Script
              </Button>
              {origin ? (
                <a
                  href={`${origin}/chatbot-widget?adminId=${user.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border-2 border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/5"
                >
                  Open Widget
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <Card className="space-y-4 border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-aa-dark-blue">Live Website Chats</h2>
              <p className="text-sm text-aa-gray">AI and manual conversations from embedded widgets.</p>
            </div>
            <Badge variant="orange">{sessions.length} chats</Badge>
          </div>

          <div className="grid gap-3">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search visitor or message..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-aa-text-dark outline-none focus:border-aa-orange"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-aa-text-dark outline-none focus:border-aa-orange"
            >
              <option value="all">All chats</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-aa-gray">
                Loading chats...
              </div>
            ) : null}

            {!loading && sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-aa-gray">
                No website chats yet. Once the script is added to a site, chats will appear here.
              </div>
            ) : null}

            {sessions.map((session) => {
              const active = session.id === selectedSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                    active
                      ? 'border-aa-orange bg-orange-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-aa-orange/40 hover:bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aa-dark-blue text-sm font-bold text-white">
                        {getInitials(session)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-aa-dark-blue">
                          {getVisitorLabel(session)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-aa-gray">
                          {session.last_message_text || 'Waiting for first message'}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-aa-gray">
                        {formatTime(session.last_message_created_at || session.updated_at)}
                      </p>
                      {session.unread_count > 0 ? (
                        <span className="mt-2 inline-flex rounded-full bg-aa-orange px-2.5 py-1 text-[11px] font-semibold text-white">
                          {session.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex min-h-[72vh] flex-col border border-slate-200 p-0">
          {!selectedSessionId ? (
            <div className="flex min-h-[72vh] items-center justify-center px-6 text-center text-aa-gray">
              Select a website chat to review the thread and reply manually.
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-aa-dark-blue text-base font-bold text-white">
                      {getInitials(selectedSession)}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-aa-dark-blue">
                        {getVisitorLabel(selectedSession)}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={selectedSession?.bot_enabled === false ? 'yellow' : 'green'}>
                          {selectedSession?.bot_enabled === false ? 'AI Paused' : 'AI Active'}
                        </Badge>
                        <Badge variant="blue">{selectedSession?.status || 'open'}</Badge>
                        {selectedSession?.visitor_email ? <Badge>{selectedSession.visitor_email}</Badge> : null}
                        {selectedSession?.visitor_phone ? <Badge>{selectedSession.visitor_phone}</Badge> : null}
                      </div>
                      <p className="mt-3 text-sm text-aa-gray">
                        Started {formatDateTime(selectedSession?.created_at)}. Last message{' '}
                        {formatDateTime(selectedSession?.last_message_at)}.
                      </p>
                      {selectedSession?.source_url ? (
                        <a
                          href={selectedSession.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block break-all text-sm font-medium text-aa-orange underline-offset-4 hover:underline"
                        >
                          {selectedSession.source_url}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={toggleBot}>
                      {selectedSession?.bot_enabled === false ? 'Resume AI' : 'Pause AI'}
                    </Button>
                    <Button variant="ghost" onClick={() => loadThread(selectedSessionId)}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>

              <div ref={threadViewportRef} className="flex-1 space-y-5 overflow-y-auto bg-slate-50 px-6 py-6">
                {threadLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-aa-gray">
                    Loading conversation...
                  </div>
                ) : null}

                {!threadLoading && messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-aa-gray">
                    No messages yet in this chat.
                  </div>
                ) : null}

                {messages.map((message) => {
                  const isVisitor = message.sender_type === 'visitor';
                  const isAdmin = message.sender_type === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isVisitor ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-[22px] border px-4 py-3 shadow-sm ${
                          isVisitor
                            ? 'border-slate-200 bg-white text-slate-800'
                            : isAdmin
                              ? 'border-aa-dark-blue/20 bg-aa-dark-blue text-white'
                              : 'border-aa-orange/20 bg-aa-orange text-white'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.message_text}</p>
                        <div className="mt-2 flex items-center justify-between gap-4">
                          <p
                            className={`text-[11px] uppercase tracking-[0.14em] ${
                              isVisitor ? 'text-slate-400' : 'text-white/70'
                            }`}
                          >
                            {isVisitor ? 'Visitor' : isAdmin ? 'Admin' : 'AI'}
                          </p>
                          <p className={`text-[11px] ${isVisitor ? 'text-slate-400' : 'text-white/70'}`}>
                            {formatDateTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 bg-white px-6 py-5">
                <label className="mb-2 block text-sm font-semibold text-aa-dark-blue">
                  Manual reply
                </label>
                <div className="flex flex-col gap-3 lg:flex-row">
                  <div className="flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Type a clear, professional reply..."
                      rows={3}
                      className="min-h-[120px] w-full resize-none bg-transparent text-sm text-aa-text-dark outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-3 lg:w-44">
                    <Button onClick={sendReply} disabled={sending || !draft.trim()} className="w-full">
                      {sending ? 'Sending...' : 'Send Reply'}
                    </Button>
                    <p className="text-xs leading-5 text-aa-gray">
                      Sending a manual reply automatically pauses AI for this chat so the admin can take over.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
