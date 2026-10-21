'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  House,
  BookOpen,
  Award,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  LogIn,
  LogOut,
  Settings2,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ChevronRight,
  CreditCard,
  AlertTriangle,
  Clock,
  Search,
  User,
  ShieldCheck,
  TrendingUp,
  CalendarCheck,
  UserCheck,
} from 'lucide-react';
import {
  fetchMetriche,
  loginAPI,
  type CredenzialiSegrepass,
  type Metriche,
  type ProfiloStudente,
  type TasseData,
  type Prenotazione,
} from '@/lib/api';
import ProfileSetupView from '@/components/ProfileSetupView';
import StudyPlanView from '@/components/StudyPlanView';
import TimetableView from '@/components/TimetableView';
import DocentiView from '@/components/DocentiView';

type View = 'home' | 'career' | 'prenotazioni' | 'taxes' | 'docenti' | 'timetable' | 'plan';

const NAV: { id: View; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'career', label: 'Carriera & Voti', icon: BookOpen },
  { id: 'prenotazioni', label: 'Prenotazioni', icon: CalendarCheck },
  { id: 'taxes', label: 'Tasse & Pagamenti', icon: CreditCard },
  { id: 'docenti', label: 'Docenti', icon: Megaphone },
  { id: 'timetable', label: 'Orario Lezioni', icon: CalendarDays },
  { id: 'plan', label: 'Piano di Studi', icon: ClipboardList },
];

const CARD =
  'rounded-2xl border border-[#3B7BC4]/30 bg-[#0A1B31]/75 shadow-[0_0_28px_-10px_rgba(70,150,230,0.55)] backdrop-blur-sm';
const SECTION_TITLE = 'mb-3 text-sm font-bold tracking-wide text-white flex items-center gap-2';
const GHOST_BTN =
  'inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5AB0F0] disabled:opacity-50';

function academicYearIndex(cohort?: number | string | null) {
  const start = Number(cohort);
  if (!start) return null;
  const now = new Date();
  const currentStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const idx = currentStart - start + 1;
  return idx >= 1 ? idx : null;
}

function formatEuro(val?: number | null) {
  if (val === undefined || val === null) return '0,00 €';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

export default function DashboardView() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfiloStudente | null>(null);
  const [credentials, setCredentials] = useState<CredenzialiSegrepass>({ codiceFiscale: '', password: '' });
  const [sessionCredentials, setSessionCredentials] = useState<CredenzialiSegrepass | null>(null);
  const [data, setData] = useState<Metriche | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [activeView, setActiveView] = useState<View>('home');

  // Filtri UI
  const [searchExam, setSearchExam] = useState('');
  const [searchPrenotazione, setSearchPrenotazione] = useState('');
  const [taxTab, setTaxTab] = useState<'pending' | 'paid'>('pending');

  useEffect(() => {
    localStorage.removeItem('segrepass_jwt');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.codiceFiscale.trim() || !credentials.password) {
      setError('Inserisci codice fiscale e password Segrepass.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const access = await loginAPI(credentials);
      setToken(access.token);
      setProfile(access.profile);
      setOnboardingRequired(access.onboardingRequired);
      setSessionCredentials(credentials);
      setData(access.metriche);
      setCredentials({ codiceFiscale: '', password: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Accesso Segrepass non riuscito.');
    } finally {
      setLoading(false);
    }
  };

  const caricaDati = async (jwtToken: string, loginCredentials: CredenzialiSegrepass) => {
    setLoading(true);
    setError('');
    try {
      const metriche = await fetchMetriche(jwtToken, loginCredentials);
      setData(metriche);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        setToken(null);
        setSessionCredentials(null);
        setData(null);
        setCredentials({ codiceFiscale: '', password: '' });
        setError('Sessione scaduta. Inserisci di nuovo le credenziali.');
      } else {
        setError(err instanceof Error ? err.message : 'Impossibile sincronizzare i dati.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
    setSessionCredentials(null);
    setData(null);
    setOnboardingRequired(false);
    setEditingProfile(false);
    setActiveView('home');
    setCredentials({ codiceFiscale: '', password: '' });
    setError('');
  };

  const handleProfileSaved = (savedProfile: ProfiloStudente) => {
    setProfile(savedProfile);
    setOnboardingRequired(false);
    setEditingProfile(false);
  };

  // Dati elaborati dell'Anagrafica
  const anagrafica = data?.anagrafica;
  const matricola = anagrafica?.matricola || profile?.matricola || null;
  const nomeCompleto = anagrafica?.nomeCompleto || profile?.name || 'Studente';
  const corsoDiLaurea = anagrafica?.corsoDiLaurea || profile?.course_name || 'Corso non specificato';
  const codiceCorso = anagrafica?.codiceCorso || profile?.course_id || null;

  // Dati elaborati delle Tasse
  const taxesObj = data?.tasse || (data as unknown as { taxes?: TasseData })?.taxes;
  const paidTaxes = taxesObj?.paid || taxesObj?.pagati || [];
  const pendingTaxes = taxesObj?.pending || taxesObj?.inDebito || [];
  const totalPaid = taxesObj?.summary?.totalPaid ?? paidTaxes.reduce((sum, item) => sum + (item.amount ?? item.importo ?? 0), 0);
  const totalPending = taxesObj?.summary?.totalPending ?? pendingTaxes.reduce((sum, item) => sum + (item.amount ?? item.importo ?? 0), 0);
  const nextDeadline = taxesObj?.summary?.nextDeadline || pendingTaxes.map(t => t.dueDate || t.scadenza).filter(Boolean).sort()[0];

  // Dati delle Prenotazioni Mergiate
  const listaPrenotazioni: Prenotazione[] = data?.prenotazioni || (data as unknown as { prenotazioni?: Prenotazione[] })?.prenotazioni || [];

  // Dati della Carriera
  const mediaPond = data?.mediaPonderata ?? '--';
  const mediaArit = data?.mediaAritmetica ?? '--';
  const baseLaurea = data?.baseLaurea ?? '--';
  const cfuConseguiti = data?.cfuAcquisiti ?? 0;
  const cfuTotali = data?.cfuTotali ?? 180;
  const percCFU = Math.min(100, Math.round((Number(cfuConseguiti) / cfuTotali) * 100)) || 0;
  const listaEsami = Array.isArray(data?.esami) ? data.esami : [];
  const annoCorso = anagrafica?.annoCorso || academicYearIndex(profile?.cohort_year);

  // Esami filtrati
  const esamiFiltrati = useMemo(() => {
    if (!searchExam.trim()) return listaEsami;
    const query = searchExam.toLowerCase();
    return listaEsami.filter((esame) => {
      const mat = (esame.materia || esame.insegnamento || '').toLowerCase();
      const cod = (esame.codice || '').toLowerCase();
      return mat.includes(query) || cod.includes(query);
    });
  }, [listaEsami, searchExam]);

  // Prenotazioni filtrate
  const prenotazioniFiltrate = useMemo(() => {
    if (!searchPrenotazione.trim()) return listaPrenotazioni;
    const query = searchPrenotazione.toLowerCase();
    return listaPrenotazioni.filter((p) => {
      const mat = (p.materia || '').toLowerCase();
      const doc = (p.docente || '').toLowerCase();
      return mat.includes(query) || doc.includes(query);
    });
  }, [listaPrenotazioni, searchPrenotazione]);

  const pageBg =
    'min-h-screen bg-[radial-gradient(ellipse_at_top,#0B3A6B_0%,#061426_45%,#030912_100%)] text-slate-100';

  if (!token || !sessionCredentials) {
    return (
      <main className={`${pageBg} flex items-center justify-center p-4`}>
        <form onSubmit={handleLogin} className={`${CARD} w-full max-w-sm space-y-4 p-6`}>
          <div className="space-y-1 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border-2 border-[#E6C887]/70 text-sm font-bold text-[#E6C887]">
              FII
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#E6C887]">Federico II · Studente</h1>
            <p className="text-sm text-slate-400">Accedi con le credenziali Segrepass</p>
          </div>
          {error && <p role="alert" className="text-center text-xs font-medium text-red-400">{error}</p>}
          <input
            type="text"
            name="codiceFiscale"
            autoComplete="off"
            placeholder="Codice fiscale"
            value={credentials.codiceFiscale}
            onChange={(e) => setCredentials((c) => ({ ...c, codiceFiscale: e.target.value }))}
            className="app-input"
          />
          <input
            type="password"
            name="passwordSegrepass"
            autoComplete="new-password"
            placeholder="Password Segrepass"
            value={credentials.password}
            onChange={(e) => setCredentials((c) => ({ ...c, password: e.target.value }))}
            className="app-input"
          />
          <p className="text-center text-xs text-slate-500">Le credenziali restano in memoria finché la pagina è aperta.</p>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2F7FD0] px-4 font-semibold text-white transition hover:bg-[#3D8FE2] disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </main>
    );
  }

  if (profile && (onboardingRequired || editingProfile)) {
    return (
      <main className={`${pageBg} px-4 py-8 sm:px-8`}>
        <ProfileSetupView
          token={token}
          initialProfile={profile}
          onSaved={handleProfileSaved}
          onCancel={editingProfile ? () => setEditingProfile(false) : undefined}
        />
      </main>
    );
  }

  const refresh = () => token && sessionCredentials && caricaDati(token, sessionCredentials);

  return (
    <div className={pageBg}>
      {/* HEADER */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0A3260]/60 px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[#E6C887]/70 bg-[#E6C887]/10 text-xs font-bold text-[#E6C887] sm:h-14 sm:w-14 sm:text-sm"
          >
            FII
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-[#E6C887] sm:text-2xl">{nomeCompleto}</h1>
            <p className="truncate text-xs text-slate-300">
              {corsoDiLaurea} {matricola ? `• Matr. ${matricola}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={refresh} disabled={loading} aria-label="Aggiorna carriera" title="Aggiorna carriera" className={GHOST_BTN}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
          <button onClick={() => setEditingProfile(true)} aria-label="Impostazioni" title="Impostazioni" className={GHOST_BTN}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Impostazioni</span>
          </button>
          <button onClick={handleLogout} aria-label="Esci" title="Esci" className={GHOST_BTN}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* SIDEBAR (desktop) */}
        <nav aria-label="Sezioni" className="hidden w-60 shrink-0 flex-col gap-1 border-r border-white/10 p-4 md:flex">
          {NAV.map(({ id, label, icon: Icon }) => {
            const selected = activeView === id;
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                aria-current={selected ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5AB0F0] ${
                  selected
                    ? 'bg-[#2F7FD0]/25 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(90,176,240,0.35)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* CONTENUTO */}
        <main className="min-w-0 flex-1 space-y-6 px-4 pb-28 pt-6 sm:px-8 md:pb-10">
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          {/* HOME VIEW */}
          {activeView === 'home' && (
            <>
              {/* Profilo & Anagrafica Studente */}
              <div className="grid gap-6 lg:grid-cols-3">
                <section className="lg:col-span-1">
                  <h2 className={SECTION_TITLE}>
                    <User className="h-4 w-4 text-[#5AB0F0]" /> Profilo Studente
                  </h2>
                  <div className={`${CARD} space-y-3 p-5`}>
                    <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-400">Carriera Attiva</p>
                        <p className="text-[11px] text-slate-400">Dati verificati con Segrepass</p>
                      </div>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Matricola</dt>
                        <dd className="font-mono font-bold text-white">{matricola || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Codice Corso</dt>
                        <dd className="font-mono font-bold text-white">{codiceCorso || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Anno di Corso</dt>
                        <dd className="font-semibold text-white">
                          {annoCorso ? `${annoCorso}° Anno` : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Coorte</dt>
                        <dd className="font-semibold text-white">{anagrafica?.annoImmatricolazione || profile?.cohort_year || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Canale</dt>
                        <dd className="font-semibold text-white">{profile?.channel || 'Da impostare'}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                {/* Statistiche & Metriche */}
                <section className="lg:col-span-2">
                  <h2 className={SECTION_TITLE}>
                    <TrendingUp className="h-4 w-4 text-[#5AB0F0]" /> Metriche Carriera
                  </h2>
                  <div className={`${CARD} overflow-hidden`}>
                    <div className="grid grid-cols-3 divide-x divide-white/10">
                      <div className="space-y-1 p-4">
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Award className="h-3.5 w-3.5 text-[#5AB0F0]" /> Media Ponderata
                        </p>
                        <p className="text-2xl font-bold text-[#5AB0F0]">{mediaPond}</p>
                        <p className="text-[11px] text-slate-500">Aritmetica: {mediaArit}</p>
                      </div>
                      <div className="space-y-1 p-4">
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <GraduationCap className="h-3.5 w-3.5 text-[#B9A2F5]" /> Base Laurea
                        </p>
                        <p className="text-2xl font-bold text-[#B9A2F5]">
                          {baseLaurea}
                          <span className="text-sm font-normal text-slate-500">/110</span>
                        </p>
                      </div>
                      <div className="space-y-1 p-4">
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <BookOpen className="h-3.5 w-3.5 text-[#E0B25A]" /> CFU Acquisiti
                        </p>
                        <p className="text-2xl font-bold text-[#E0B25A]">
                          {cfuConseguiti}
                          <span className="text-sm font-normal text-slate-500"> /{cfuTotali}</span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 border-t border-white/10 p-4">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Progresso Laurea</span>
                        <span className="font-semibold text-white">{percCFU}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={percCFU}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso laurea"
                        className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2F7FD0] via-[#5AD0E8] to-emerald-400 transition-all duration-500"
                          style={{ width: `${percCFU}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Widget Prenotazioni Esami in Home */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className={SECTION_TITLE}>
                    <CalendarCheck className="h-4 w-4 text-[#5AB0F0]" /> Prossimi Appelli & Prenotazioni
                  </h2>
                  <button onClick={() => setActiveView('prenotazioni')} className="mb-3 text-xs font-semibold text-[#5AB0F0] hover:underline flex items-center gap-1">
                    Vedi tutte ({listaPrenotazioni.length}) <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                {listaPrenotazioni.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {listaPrenotazioni.slice(0, 3).map((p, idx) => (
                      <div key={idx} className={`${CARD} p-4 space-y-2 border-l-4 ${p.isMyProfessor ? 'border-l-emerald-400' : 'border-l-[#3B7BC4]'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-white">{p.materia}</span>
                          {p.isMyProfessor && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
                              <UserCheck className="h-3 w-3" /> Tuo Docente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">Prof. {p.docente || 'Non specificato'}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/10">
                          <span>📅 {formatDate(p.dataAppello)} {p.ora ? `• ${p.ora}` : ''}</span>
                          {p.aula && <span>📍 {p.aula}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`${CARD} p-4 text-center text-xs text-slate-400`}>
                    Nessuna prenotazione d'esame attiva al momento.
                  </div>
                )}
              </section>

              {/* Widget Tasse & Pagamenti in Home */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className={SECTION_TITLE}>
                    <CreditCard className="h-4 w-4 text-[#5AB0F0]" /> Situazione Tasse
                  </h2>
                  <button onClick={() => setActiveView('taxes')} className="mb-3 text-xs font-semibold text-[#5AB0F0] hover:underline flex items-center gap-1">
                    Vedi dettaglio <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className={`${CARD} p-4 flex items-center gap-3`}>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Totale Versato</p>
                      <p className="text-lg font-bold text-emerald-400">{formatEuro(totalPaid)}</p>
                    </div>
                  </div>
                  <div className={`${CARD} p-4 flex items-center gap-3`}>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400 shrink-0">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">In Debito / Da Pagare</p>
                      <p className="text-lg font-bold text-amber-400">{formatEuro(totalPending)}</p>
                    </div>
                  </div>
                  <div className={`${CARD} p-4 flex items-center gap-3`}>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-[#5AB0F0] shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Prossima Scadenza</p>
                      <p className="text-sm font-bold text-white">{formatDate(nextDeadline)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Collegamenti Rapidi */}
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  { id: 'timetable' as const, title: 'Orario Lezioni', text: 'Consulta aule, orari e docenti', cta: 'Apri Orario', icon: CalendarDays },
                  { id: 'plan' as const, title: 'Piano di Studi', text: 'Esami superati e materie da sostenere', cta: 'Apri Piano', icon: ClipboardList },
                  { id: 'docenti' as const, title: 'Avvisi Docenti', text: 'Bacheche, ricevimenti e contatti', cta: 'Apri Avvisi', icon: Megaphone },
                ].map(({ id, title, text, cta, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveView(id)}
                    className={`${CARD} group flex items-center gap-4 p-5 text-left transition hover:border-[#5AB0F0]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5AB0F0]`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#2F7FD0]/20 text-[#5AB0F0]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">{title}</span>
                      <span className="block truncate text-xs text-slate-400">{text}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-[#5AB0F0]">
                      {cta}
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* PRENOTAZIONI VIEW */}
          {activeView === 'prenotazioni' && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Prenotazione Esami & Appelli</h2>
                  <p className="text-xs text-slate-400">
                    Appelli disponibili su Segrepass con riscontro corsi ufficiali Docenti Unina
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca materia o docente..."
                    value={searchPrenotazione}
                    onChange={(e) => setSearchPrenotazione(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-[#5AB0F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3">
                {prenotazioniFiltrate.length > 0 ? (
                  prenotazioniFiltrate.map((p, idx) => (
                    <div
                      key={idx}
                      className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                        p.isMyProfessor ? 'border-l-emerald-400 bg-[#0A2238]/90' : 'border-l-[#3B7BC4]'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{p.materia}</span>
                          {p.isMyProfessor ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                              <UserCheck className="h-3.5 w-3.5" /> Il tuo Professore
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-400">
                              Altro cattedratico
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300">Prof. {p.docente || 'Non specificato'}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                          {p.dataAppello && <span>📅 Data: <strong className="text-slate-200">{formatDate(p.dataAppello)}</strong></span>}
                          {p.ora && <span>⏰ Ora: <strong className="text-slate-200">{p.ora}</strong></span>}
                          {p.aula && <span>📍 Aula/Sede: <strong className="text-slate-200">{p.aula}</strong></span>}
                        </div>
                        {p.note && <p className="text-[11px] italic text-slate-400">{p.note}</p>}
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Appello Disponibile
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>
                    {loading ? 'Caricamento appelli in corso...' : 'Nessun appello o prenotazione trovata.'}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CARRIERA & VOTI VIEW */}
          {activeView === 'career' && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Libretto & Esami Sostenuti</h2>
                  <p className="text-xs text-slate-400">{listaEsami.length} esami verbalizzati o convalidati</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca materia o codice..."
                    value={searchExam}
                    onChange={(e) => setSearchExam(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-[#5AB0F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:gap-3">
                {esamiFiltrati.length > 0 ? (
                  esamiFiltrati.map((esame, idx) => {
                    const materia = esame.materia || esame.insegnamento || 'Esame';
                    const codice = esame.codice;
                    const cfu = esame.cfu || 0;
                    const voto = esame.voto;
                    const giudizio = esame.giudizio;
                    const dataEsame = esame.data || '';
                    return (
                      <div key={idx} className={`${CARD} flex items-center justify-between gap-3 p-4`}>
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold text-slate-100">{materia}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {codice && <span className="font-mono rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">{codice}</span>}
                            <span>{cfu} CFU</span>
                            {dataEsame && <span>• {formatDate(dataEsame)}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {voto ? (
                            <span className="inline-block rounded-lg border border-[#3B7BC4]/50 bg-[#2F7FD0]/20 px-3 py-1.5 text-xs font-bold text-[#9CCBF5]">
                              {voto}/30 {esame.lode ? 'e Lode' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/60 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {giudizio || 'IDONEO'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>
                    {loading ? 'Caricamento esami in corso...' : 'Nessun esame trovato.'}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TASSE & PAGAMENTI VIEW */}
          {activeView === 'taxes' && (
            <section className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Tasse & Contributi Universitari</h2>
                  <p className="text-xs text-slate-400">Posizione amministrativa e scadenze PagoPA</p>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 self-start sm:self-auto">
                  <button
                    onClick={() => setTaxTab('pending')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      taxTab === 'pending' ? 'bg-[#2F7FD0] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Da Pagare ({pendingTaxes.length})
                  </button>
                  <button
                    onClick={() => setTaxTab('paid')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      taxTab === 'paid' ? 'bg-[#2F7FD0] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Storico Pagati ({paidTaxes.length})
                  </button>
                </div>
              </div>

              {taxTab === 'pending' && (
                <div className="grid gap-3">
                  {pendingTaxes.length > 0 ? (
                    pendingTaxes.map((tax, idx) => {
                      const desc = tax.description || tax.causale || 'Contributo universitario';
                      const amount = tax.amount ?? tax.importo ?? 0;
                      const dueDate = tax.dueDate || tax.scadenza;
                      const isExpired = tax.status === 'scaduto';
                      const iuv = tax.iuv || tax.paymentCode;

                      return (
                        <div key={idx} className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isExpired ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              }`}>
                                {isExpired ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {isExpired ? 'SCADUTO' : 'IN ATTESA'}
                              </span>
                              {tax.academicYear && <span className="text-xs text-slate-400">A.A. {tax.academicYear}</span>}
                            </div>
                            <p className="text-sm font-semibold text-white">{desc}</p>
                            {dueDate && <p className="text-xs text-slate-400">Scadenza: <span className="font-medium text-slate-200">{formatDate(dueDate)}</span></p>}
                            {iuv && <p className="text-[11px] font-mono text-slate-500">IUV / Codice: {iuv}</p>}
                          </div>
                          <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                            <span className="text-lg font-bold text-amber-400">{formatEuro(amount)}</span>
                            {tax.paymentLink && (
                              <a
                                href={tax.paymentLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F7FD0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3D8FE2]"
                              >
                                Paga con PagoPA <ChevronRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>
                      Nessuna tassa in sospeso o in debito.
                    </div>
                  )}
                </div>
              )}

              {taxTab === 'paid' && (
                <div className="grid gap-3">
                  {paidTaxes.length > 0 ? (
                    paidTaxes.map((tax, idx) => {
                      const desc = tax.description || tax.causale || 'Versamento universitario';
                      const amount = tax.amount ?? tax.importo ?? 0;
                      const paidAt = tax.paidAt || tax.dataPagamento;
                      const iuv = tax.iuv || tax.paymentCode;

                      return (
                        <div key={idx} className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3" /> PAGATO
                              </span>
                              {tax.academicYear && <span className="text-xs text-slate-400">A.A. {tax.academicYear}</span>}
                            </div>
                            <p className="text-sm font-semibold text-white">{desc}</p>
                            {paidAt && <p className="text-xs text-slate-400">Data Versamento: <span className="font-medium text-slate-200">{formatDate(paidAt)}</span></p>}
                            {iuv && <p className="text-[11px] font-mono text-slate-500">IUV: {iuv}</p>}
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-emerald-400">{formatEuro(amount)}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`${CARD} p-8 text-center text-sm text-slate-400`}>
                      Nessun versamento storico registrato.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeView === 'docenti' && <DocentiView token={token} />}
          {activeView === 'plan' && profile && <StudyPlanView token={token} profile={profile} />}
          {activeView === 'timetable' && profile && <TimetableView token={token} profile={profile} />}
        </main>
      </div>

      {/* TAB BAR (mobile) */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-white/10 bg-[#061426]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ id, label, icon: Icon }) => {
          const selected = activeView === id;
          const short = label.split(' ')[0];
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              aria-current={selected ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[9px] transition ${
                selected ? 'text-[#5AB0F0]' : 'text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate max-w-[48px]">{short}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}