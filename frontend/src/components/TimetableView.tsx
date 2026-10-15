'use client';

import { useState } from 'react';
import { CalendarDays, LoaderCircle, Search } from 'lucide-react';
import { fetchTimetable, type ProfiloStudente, type TimetableFilters } from '@/lib/api';

type Props = { token: string; profile: ProfiloStudente };
type TimetableResult = Awaited<ReturnType<typeof fetchTimetable>>;

function formatLessonDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export default function TimetableView({ token, profile }: Props) {
  const [studyYear, setStudyYear] = useState(String(profile.current_course_year || 1));
  const [semester, setSemester] = useState('');
  const [channel, setChannel] = useState(profile.channel || '');
  const [academicYear, setAcademicYear] = useState('');
  const [data, setData] = useState<TimetableResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadTimetable = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const filters: TimetableFilters = {
        studyYear: Number(studyYear),
        semester: semester ? Number(semester) : null,
        channel: channel.trim(),
        ...(academicYear.trim() ? { academicYear: academicYear.trim() } : {})
      };
      setData(await fetchTimetable(token, filters));
    } catch (loadError: unknown) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : 'Impossibile caricare l’orario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 text-zinc-100">
      <header className="border-b border-zinc-800 pb-4">
        <p className="text-xs font-semibold uppercase text-sky-300">EasyAcademy · dati aggiornati alla richiesta</p>
        <h2 className="mt-1 text-2xl font-bold">Orario personale</h2>
        <p className="mt-1 text-sm text-zinc-400">Corso: {profile.course_name || profile.course_id || 'non impostato'}</p>
      </header>

      <form onSubmit={loadTimetable} className="grid gap-3 border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Anno di corso</span>
          <input type="number" min="1" max="20" required value={studyYear} onChange={event => setStudyYear(event.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </label>
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Semestre</span>
          <select value={semester} onChange={event => setSemester(event.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
            <option value="">Tutti</option><option value="1">Primo semestre</option><option value="2">Secondo semestre</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Canale / gruppo</span>
          <input required value={channel} onChange={event => setChannel(event.target.value)} placeholder="Es. A-D oppure FG1:A-DIL" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </label>
        <label className="space-y-1 text-xs text-zinc-400">
          <span>Anno accademico (opzionale)</span>
          <input value={academicYear} onChange={event => setAcademicYear(event.target.value)} placeholder="Ultimo disponibile" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </label>
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-[#043B6B] px-4 py-2 text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cerca orario
        </button>
      </form>

      {error && <div role="alert" className="border-l-2 border-amber-400 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">{error}</div>}
      {loading && <p className="text-sm text-zinc-400">Consultazione dell’agenda ufficiale…</p>}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-sky-300" />{data.timetable.academicYear}</span>
            <span className="text-zinc-400">{data.timetable.course} · {data.timetable.channel}</span>
          </div>
          {data.timetable.events.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Nessuna lezione pubblicata per i filtri scelti.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {data.timetable.events.map((event, index) => (
                <article key={`${event.date}-${event.startTime}-${event.courseName}-${index}`} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                  <div className="text-sm text-app-accent">
                    <p className="font-medium">{formatLessonDate(event.date) || event.dateTime}</p>
                    {(event.startTime || event.endTime) && <p className="mt-1 text-xs text-app-muted">{event.startTime || ''}{event.startTime && event.endTime ? ' – ' : ''}{event.endTime || ''}</p>}
                  </div>
                  <div>
                    <h3 className="font-semibold">{event.courseName}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{event.teachers.length ? event.teachers.join(', ') : 'Docente non indicato'}</p>
                  </div>
                  <div className="text-sm text-zinc-400 sm:text-right">{event.room || 'Aula non indicata'}{event.campus ? ` · ${event.campus}` : ''}</div>
                </article>
              ))}
            </div>
          )}
          <a href="https://easyacademy.unina.it/agendastudenti/index.php?view=easycourse&_lang=it&include=corso" target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-sky-200">Apri agenda ufficiale Unina</a>
        </div>
      )}
    </section>
  );
}
