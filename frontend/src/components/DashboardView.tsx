'use client';

import { useState, useEffect } from 'react';
import { House, BookOpen, Award, CalendarDays, GraduationCap, Percent, RefreshCw, LogIn, LogOut, Settings2, CheckCircle2, ClipboardList, Ellipsis } from 'lucide-react';
import { fetchMetriche, loginAPI, type CredenzialiSegrepass, type Metriche, type ProfiloStudente } from '@/lib/api';
import ProfileSetupView from '@/components/ProfileSetupView';
import StudyPlanView from '@/components/StudyPlanView';
import TimetableView from '@/components/TimetableView';

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
  const [activeView, setActiveView] = useState<'home' | 'career' | 'plan' | 'timetable' | 'more'>('home');

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

  if (!token || !sessionCredentials) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Segrepass 2.0</h1>
            <p className="text-sm text-zinc-400">Accesso con credenziali Segrepass</p>
          </div>
          {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}
          <input
            type="text"
            name="codiceFiscale"
            autoComplete="off"
            placeholder="Codice fiscale"
            value={credentials.codiceFiscale}
            onChange={(e) => setCredentials(current => ({ ...current, codiceFiscale: e.target.value }))}
            className="app-input"
          />
          <input
            type="password"
            name="passwordSegrepass"
            autoComplete="new-password"
            placeholder="Password Segrepass"
            value={credentials.password}
            onChange={(e) => setCredentials(current => ({ ...current, password: e.target.value }))}
            className="app-input"
          />
          <p className="text-xs text-zinc-500 text-center">Le credenziali restano in memoria finché la pagina è aperta.</p>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </main>
    );
  }

  if (profile && (onboardingRequired || editingProfile)) {
    return (
      <main className="app-shell min-h-screen px-4 py-8 sm:px-8">
        <ProfileSetupView
          token={token}
          initialProfile={profile}
          onSaved={handleProfileSaved}
          onCancel={editingProfile ? () => setEditingProfile(false) : undefined}
        />
      </main>
    );
  }

  const mediaPond = data?.mediaPonderata ?? '--';
  const mediaArit = data?.mediaAritmetica ?? '--';
  const baseLaurea = data?.baseLaurea ?? '--';
  const cfuConseguiti = data?.cfuAcquisiti ?? 0;
  const cfuTotali = data?.cfuTotali ?? 180;
  const percCFU = Math.min(100, Math.round((Number(cfuConseguiti) / cfuTotali) * 100)) || 0;
  const listaEsami = Array.isArray(data?.esami) ? data.esami : [];

  return (
    <main className="app-shell mx-auto min-h-screen w-full min-w-0 max-w-5xl space-y-5 px-4 pb-24 sm:space-y-6 sm:px-8 sm:pb-8">
      <header className="app-topbar flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-sm font-bold text-white">II</div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">UNINA Studente</h1>
            <p className="truncate text-xs text-white/75 sm:text-sm">{profile?.course_name || 'Profilo studente'}{profile?.cohort_year ? ` · Coorte ${profile.cohort_year}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditingProfile(true)}
            aria-label="Impostazioni profilo"
            title="Impostazioni profilo"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => token && sessionCredentials && caricaDati(token, sessionCredentials)}
            disabled={loading}
            aria-label="Aggiorna carriera"
            title="Aggiorna carriera"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            aria-label="Esci"
            title="Esci"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <nav aria-label="Sezioni carriera" className="app-tabbar">
        {[
          { id: 'home' as const, label: 'Home', icon: House },
          { id: 'career' as const, label: 'Carriera', icon: BookOpen },
          { id: 'timetable' as const, label: 'Orario', icon: CalendarDays },
          { id: 'plan' as const, label: 'Piano', icon: ClipboardList },
          { id: 'more' as const, label: 'Altro', icon: Ellipsis }
        ].map(item => {
          const Icon = item.icon;
          const selected = activeView === item.id;
          return (
            <button key={item.id} onClick={() => setActiveView(item.id)} aria-pressed={selected} className="app-tab-button">
              <Icon className="h-5 w-5 sm:h-4 sm:w-4" /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activeView === 'home' && <>
      {/* Grid Metriche Rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
            <Award className="w-4 h-4 text-blue-400" /> Media Pond.
          </div>
          <p className="text-2xl font-bold text-blue-400">{mediaPond}</p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
            <Percent className="w-4 h-4 text-emerald-400" /> Media Aritm.
          </div>
          <p className="text-2xl font-bold text-emerald-400">{mediaArit}</p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
            <GraduationCap className="w-4 h-4 text-purple-400" /> Base Laurea
          </div>
          <p className="text-2xl font-bold text-purple-400">{baseLaurea}/110</p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
            <BookOpen className="w-4 h-4 text-amber-400" /> CFU Conseguiti
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {cfuConseguiti} <span className="text-xs text-zinc-500 font-normal">/ {cfuTotali}</span>
          </p>
        </div>
      </div>

      {/* Barra Progresso */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-2">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Progresso Laurea</span>
          <span>{percCFU}%</span>
        </div>
        <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${percCFU}%` }} />
        </div>
      </div>

      <section className="app-card grid gap-3 p-4 sm:grid-cols-3">
        <button onClick={() => setActiveView('career')} className="min-h-12 rounded-full border border-app-line px-4 text-sm font-semibold text-app-accent hover:bg-app-raised">Apri carriera</button>
        <button onClick={() => setActiveView('plan')} className="min-h-12 rounded-full bg-[#043B6B] px-4 text-sm font-semibold text-white hover:bg-[#07538D]">Esami da sostenere</button>
        <button onClick={() => setActiveView('timetable')} className="min-h-12 rounded-full border border-app-line px-4 text-sm font-semibold text-app-accent hover:bg-app-raised">Orario personale</button>
      </section>
      </>}

      {activeView === 'career' && <>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Esami Sostenuti & Convalidati</h2>
        <div className="grid gap-2 sm:gap-3">
          {listaEsami.length > 0 ? (
            listaEsami.map((esame, idx) => {
              const materia = esame.materia || esame.insegnamento || 'Esame';
              const cfu = esame.cfu || 0;
              const voto = esame.voto;
              const giudizio = esame.giudizio;
              const dataEsame = esame.data || '';

              return (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-zinc-900 border border-zinc-800/80 rounded-xl hover:border-zinc-700 transition">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm text-zinc-200">{materia}</p>
                    <p className="text-xs text-zinc-500">
                      {cfu} CFU {dataEsame ? `• ${dataEsame}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {voto ? (
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800">
                        {voto}/30 {esame.lode ? 'Lode' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {giudizio || 'IDONEO'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-8 text-center text-zinc-500 text-sm">
              {loading ? 'Caricamento esami in corso...' : 'Nessun esame registrato o in attesa di sincronizzazione.'}
            </div>
          )}
        </div>
      </section>
      </>}

      {activeView === 'plan' && profile && <StudyPlanView token={token} profile={profile} />}
      {activeView === 'timetable' && profile && <TimetableView token={token} profile={profile} />}
      {activeView === 'more' && <section className="app-card mx-auto max-w-xl divide-y divide-app-line p-4">
        <div className="pb-4">
          <h2 className="text-lg font-semibold">Profilo e preferenze</h2>
          <p className="mt-1 text-sm text-app-muted">{profile?.course_name || 'Corso non impostato'} · Canale {profile?.channel || 'da impostare'}</p>
          <button onClick={() => setEditingProfile(true)} className="mt-3 min-h-11 rounded-full border border-app-line px-4 text-sm font-medium text-app-accent">Modifica profilo</button>
        </div>
        <div className="pt-4"><button onClick={handleLogout} className="min-h-11 rounded-full px-4 text-sm font-semibold text-red-700 hover:bg-red-500/10 dark:text-red-300">Esci dall’app</button></div>
      </section>}
    </main>
  );
}