import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, User } from 'lucide-react';
import { apiClient } from '../api/client';
import { errMsg } from '../api/errors';
import { Btn, input, Loader } from './ui';

/**
 * The agent side of a support ticket conversation.
 *
 * Before this, the only thing an agent could send a rider was `adminNotes` — a
 * single overwritable field that the app rendered as a one-way "resolution
 * note". A rider could not answer it and an agent could not see whether they
 * had. Both sides now read and write the same thread.
 */

interface Message {
  id: string;
  authorType: 'RIDER' | 'AGENT';
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
  author?: { fullName?: string | null; role?: string | null } | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const TicketThread: React.FC<{
  ticketId: string;
  /** The ticket's opening description — the first message in the conversation. */
  opening: string;
  openedAt: string;
  riderName: string;
  /** Called after a reply lands, so the parent list can pick up the new status. */
  onReplied?: () => void;
}> = ({ ticketId, opening, openedAt, riderName, onReplied }) => {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [resolveToo, setResolveToo] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/admin/api/support/tickets/${ticketId}/messages`);
      setMessages(res.data?.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMsg(e, 'Could not load the conversation'));
      setMessages([]);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      await apiClient.post(`/admin/api/support/tickets/${ticketId}/messages`, {
        body,
        ...(resolveToo ? { status: 'RESOLVED' } : {}),
      });
      setDraft('');
      setResolveToo(false);
      await load();
      onReplied?.();
    } catch (e) {
      setError(errMsg(e, 'Could not send the reply'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-rule rounded-sm">
      <div className="px-3.5 py-2 border-b border-rule bg-shell">
        <span className="u-label">Conversation</span>
      </div>

      <div className="max-h-72 overflow-y-auto px-3.5 py-3 space-y-3">
        {/* The ticket description is the rider's opening message. */}
        <Bubble
          side="rider"
          name={riderName}
          body={opening}
          at={openedAt}
        />

        {messages === null ? (
          <Loader />
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              side={m.authorType === 'AGENT' ? 'agent' : 'rider'}
              name={
                m.authorType === 'AGENT'
                  ? m.author?.fullName || 'Support desk'
                  : riderName
              }
              body={m.body}
              at={m.createdAt}
              attachmentUrl={m.attachmentUrl}
            />
          ))
        )}

        {messages?.length === 0 && (
          <p className="text-[12px] text-ink-soft text-center py-2">
            No replies yet. What you write below is what the rider sees in the app.
          </p>
        )}

        <div ref={endRef} />
      </div>

      <div className="px-3.5 py-3 border-t border-rule space-y-2">
        {error && <p className="text-[12px] text-signal-red">{error}</p>}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          className={input}
          placeholder="Reply to the rider… this appears in their app immediately."
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={resolveToo}
              onChange={(e) => setResolveToo(e.target.checked)}
              className="accent-accent"
            />
            Mark resolved when sending
          </label>

          <Btn variant="primary" onClick={send} disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : resolveToo ? 'Reply & resolve' : 'Send reply'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{
  side: 'rider' | 'agent';
  name: string;
  body: string;
  at: string;
  attachmentUrl?: string | null;
}> = ({ side, name, body, at, attachmentUrl }) => {
  const isAgent = side === 'agent';
  const Icon = isAgent ? ShieldCheck : User;

  return (
    <div className={`flex gap-2 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-6 h-6 rounded-sm border flex items-center justify-center shrink-0 ${
          isAgent ? 'border-accent-line bg-accent-soft' : 'border-rule bg-shell'
        }`}
      >
        <Icon
          className={`w-3 h-3 ${isAgent ? 'text-accent' : 'text-ink-faint'}`}
          strokeWidth={1.75}
        />
      </div>

      <div className={`max-w-[80%] ${isAgent ? 'text-right' : ''}`}>
        <p className="text-[10.5px] text-ink-soft">
          {name} · <span className="u-num">{when(at)}</span>
        </p>
        <div
          className={`inline-block text-left mt-0.5 px-3 py-2 rounded-sm border text-[12.5px] leading-relaxed whitespace-pre-wrap ${
            isAgent ? 'border-accent-line bg-accent-soft text-ink' : 'border-rule bg-surface text-ink'
          }`}
        >
          {attachmentUrl && (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block mb-1.5">
              <img
                src={attachmentUrl}
                alt="Rider attachment"
                className="max-h-40 rounded-sm border border-rule"
              />
            </a>
          )}
          {body}
        </div>
      </div>
    </div>
  );
};
