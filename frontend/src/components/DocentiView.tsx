'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Megaphone, BookOpenCheck, CalendarCheck, CalendarDays, MapPin, ExternalLink, RefreshCw, User, Search, Calendar } from 'lucide-react';
import {
  fetchDocentiAnnouncements,
  fetchDocentiSubscriptions,
  fetchDocentiBookedExams,
  type DocenteAnnouncements,
  type SubscriptionDocenti,
  type BookedExamDocenti,
} from '@/lib/api';

interface DocentiViewProps {
  token: string;
}

type Tab = 'announcements' | 'subscriptions' | 'bookedExams';

const CARD =
  'rounded-2xl border border-[#3B7BC4]/30 bg-[#0A1B31]/75 shadow-[0_0_28px_-10px_rgba(70,150,230,0.55)] backdrop-blur-sm';
const EMPTY = `${CARD} p-8 text-center text-sm text-slate-400`;

function readableError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message === 'SESSION_EXPIRED') return 'Sessione scaduta. Esci e accedi di nuovo.';
  return message || 'Errore durante il caricamento dei dati Docenti.';
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function getTimestamp(dateStr?: string | null) {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
}

function stripTags(html?: string | null) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

export default function DocentiView({ token }: DocentiViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('announcements');
  const [announcements, setAnnouncements] = useState<DocenteAnnouncements[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDocenti[]>([]);
  const [bookedExams, setBookedExams] = useState<BookedExamDocenti[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [ann, sub, exams] = await Promise.allSettled([
      fetchDocentiAnnouncements(token),
      fetchDocentiSubscriptions(token),
      fetchDocentiBookedExams(token),
    ]);

    const found: string[] = [];
    if (ann.status === 'fulfilled') setAnnouncements(ann.value);
    else found.push(readableError(ann.reason));

    if (sub.status === 'fulfilled') setSubscriptions(sub.value);
    else found.push(readableError(sub.reason));

    if (exams.status === 'fulfilled') setBookedExams(exams.value);
    else found.push(readableError(exams.reason));

    setErrors([...new Set(found)]);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  const safeAnnouncements = useMemo(() => {
    return Array.isArray(announcements) ? announcements : [];
  }, [announcements]);

  const sortedAnnouncements = useMemo(() => {
    const list = safeAnnouncements.map(doc => {
      const sortedItems = [...(doc.items || [])].sort(
        (a, b) => getTimestamp(b.date) - getTimestamp(a.date)
      );
      const latestDate = sortedItems.length > 0 ? getTimestamp(sortedItems[0].date) : 0;
      return {
        ...doc,
        items: sortedItems,
        latestDate
      };
    });

    list.sort((a, b) => b.latestDate - a.latestDate);

    if (!search.trim()) return list;

    const query = search.toLowerCase();
    return list
      .map(doc => ({
        ...doc,
        items: (doc.items || []).filter(
          (item: any) =>
            (doc.professor || '').toLowerCase().includes(query) ||
            stripTags(item.title).toLowerCase().includes(query) ||
            stripTags(item.content).toLowerCase().includes(query)
        )
      }))
      .filter(doc => doc.items.length > 0);
  }, [safeAnnouncements, search]);

  const totalAnnouncementsCount = useMemo(() => {
    let count = 0;
    for (const curr of safeAnnouncements) {
      if (Array.isArray(curr.items)) {
        count += curr.items.length;
      } else if (typeof curr.count === 'number') {
        count += curr.count;
      }
    }
    return count;
  }, [safeAnnouncements]);

  const tabs: { id: Tab; label: string; count: number; icon: typeof Megaphone }[] = [
    { id: 'announcements', label: 'Avvisi', count: totalAnnouncementsCount, icon: Megaphone },
    { id: 'subscriptions', label: 'Corsi seguiti', count: subscriptions.length, icon: BookOpenCheck },
    { id: 'bookedExams', label: 'Prenotazioni', count: bookedExams.length, icon: CalendarCheck },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-white">Portale Docenti</h2>
          <p className="text-xs text-slate-400">Avvisi, corsi seguiti ed esami prenotati da docenti.unina.it</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          aria-label="Ricarica dati docenti"
          title="Ricarica dati docenti"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5AB0F0] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-white/10 pb-3">
        <div className="flex gap-2">
          {tabs.map(({ id, label, count, icon: Icon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-pressed={selected}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5AB0F0] ${
                  selected
                    ? 'bg-[#2F7FD0] text-white shadow-[0_0_16px_-4px_rgba(47,127,208,0.8)]'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label} ({count})</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'announcements' && (
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca avviso o docente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-[#5AB0F0] focus:outline-none"
            />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div role="alert" className="space-y-1 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {loading && <div className={EMPTY}>Sincronizzazione dei dati docenti in corso...</div>}

      {!loading && activeTab === 'announcements' && (
        <div className="space-y-4">
          {sortedAnnouncements.length === 0 ? (
            <div className={EMPTY}>Nessun avviso trovato con i filtri correnti.</div>
          ) : (
            sortedAnnouncements.map((doc, idx) => (
              <div key={doc.slug || doc.professor || idx} className={`${CARD} space-y-3 p-4`}>
                <div className="flex items-center gap-2 border-b border-white/10 pb-2.5 text-sm font-semibold text-[#5AB0F0]">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{doc.professor}</span>
                  <span className="ml-auto text-[11px] font-normal text-slate-400">
                    {doc.items?.length || 0} {(doc.items?.length || 0) === 1 ? 'avviso' : 'avvisi'}
                  </span>
                </div>

                {doc.items && doc.items.length > 0 ? (
                  <div className="space-y-2.5">
                    {doc.items.map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="space-y-1.5 rounded-xl border border-white/10 bg-[#050E1C]/70 p-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <h4 className="text-sm font-medium text-slate-100">{stripTags(item.title)}</h4>
                          {item.date && (
                            <span suppressHydrationWarning className="inline-flex items-center gap-1 shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(item.date)}
                            </span>
                          )}
                        </div>
                        {item.content && (
                          <div
                            className="text-xs text-slate-400 leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-[#5AB0F0] hover:underline"
                          >
                            <span>Apri avviso originale / allegato</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-500">Nessun avviso presente in bacheca.</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {!loading && activeTab === 'subscriptions' && (
        <div className="grid gap-2.5">
          {subscriptions.length === 0 ? (
            <div className={EMPTY}>Nessun corso iscritto trovato sul portale Docenti.</div>
          ) : (
            subscriptions.map((sub, idx) => (
              <div key={idx} className={`${CARD} flex items-center justify-between gap-3 p-3.5`}>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-slate-100">{sub.courseName || 'Corso'}</p>
                  <p className="text-xs text-slate-400">
                    Docente: <span className="font-medium text-slate-200">{sub.professor || 'Non specificato'}</span>
                    {sub.section ? ` • Canale ${sub.section}` : ''}
                  </p>
                </div>
                {sub.academicYear && (
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400">
                    {sub.academicYear}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {!loading && activeTab === 'bookedExams' && (
        <div className="grid gap-2.5">
          {bookedExams.length === 0 ? (
            <div className={EMPTY}>Nessun esame attualmente prenotato.</div>
          ) : (
            bookedExams.map((exam, idx) => (
              <div key={idx} className={`space-y-1.5 rounded-2xl border bg-[#0A1B31]/75 p-3.5 ${exam.status === 'Passato' ? 'border-white/10' : 'border-emerald-700/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`min-w-0 truncate text-sm font-medium ${exam.status === 'Passato' ? 'text-slate-300' : 'text-emerald-300'}`}>{exam.courseName || 'Esame'}</p>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${exam.status === 'Passato' ? 'border-white/15 bg-white/5 text-slate-400' : 'border-emerald-700/60 bg-emerald-950/70 text-emerald-300'}`}>
                    {exam.status || 'Prenotato'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  {exam.examDate && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Data: <strong className="text-slate-200">{exam.examDate}</strong>
                    </span>
                  )}
                  {exam.bookingDate && (
                    <span className="inline-flex items-center gap-1">
                      Prenotato il <strong className="text-slate-200">{exam.bookingDate}</strong>
                    </span>
                  )}
                  {exam.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> Aula: <strong className="text-slate-200">{exam.location}</strong>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}