'use client';

import { useState } from 'react';
import { BookOpenCheck, LoaderCircle, Save } from 'lucide-react';
import { fetchStudyPlan, updateProfile, type PlanCourse, type ProfiloStudente } from '@/lib/api';

type Props = {
  token: string;
  initialProfile: ProfiloStudente;
  onSaved: (profile: ProfiloStudente) => void;
  onCancel?: () => void;
};

export default function ProfileSetupView({ token, initialProfile, onSaved, onCancel }: Props) {
  const [courseId, setCourseId] = useState(initialProfile.course_id || '');
  const [courseName, setCourseName] = useState(initialProfile.course_name || '');
  const [cohortYear, setCohortYear] = useState(String(initialProfile.cohort_year || ''));
  const [courseYear, setCourseYear] = useState(String(initialProfile.current_course_year || ''));
  const [channel, setChannel] = useState(initialProfile.channel || '');
  const [surnameInitial, setSurnameInitial] = useState(initialProfile.surname_initial || '');
  const [plan, setPlan] = useState<{ courses: PlanCourse[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const electiveCourses = plan?.courses.filter(course => course.course_type === 'elective') || [];
  const requiredElectiveCfu = Math.max(0, ...electiveCourses.map(course => course.elective_required_cfu || 0));
  const selectedElectiveCfu = electiveCourses
    .filter(course => selectedIds.includes(course.id))
    .reduce((total, course) => total + course.cfu, 0);

  const loadPlan = async () => {
    if (!courseId.trim() || !Number(cohortYear)) {
      setError('Inserisci codice corso e anno di immatricolazione prima di caricare il piano.');
      return;
    }
    setLoadingPlan(true);
    setError('');
    setNotice('');
    try {
      const result = await fetchStudyPlan(token, courseId.trim(), Number(cohortYear));
      setPlan(result);
      setSelectedIds(result.selectedElectiveIds);
      setNotice(`Piano caricato: ${result.plan.course_name}`);
    } catch (loadError: unknown) {
      setPlan(null);
      setSelectedIds([]);
      setError(loadError instanceof Error ? loadError.message : 'Piano non disponibile.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courseId.trim() || !courseName.trim() || !channel.trim() || !/^\d{4}$/.test(cohortYear) || !/^\d{1,2}$/.test(courseYear)) {
      setError('Completa corso, coorte, anno di corso e canale.');
      return;
    }
    if (selectedIds.length > 0 && requiredElectiveCfu > 0 && selectedElectiveCfu !== requiredElectiveCfu) {
      setError(`Le scelte selezionate devono totalizzare ${requiredElectiveCfu} CFU (ora ${selectedElectiveCfu}).`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await updateProfile(token, {
        courseId: courseId.trim(),
        courseName: courseName.trim(),
        cohortYear: Number(cohortYear),
        currentCourseYear: Number(courseYear),
        channel: channel.trim(),
        surnameInitial: surnameInitial.trim().toUpperCase(),
        ...(plan ? { selectedElectiveIds: selectedIds } : {})
      });
      onSaved(result.profile);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Impossibile salvare il profilo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 text-zinc-100">
      <header className="border-b border-zinc-800 pb-4">
        <p className="text-xs font-semibold uppercase text-sky-300">Profilo carriera</p>
        <h1 className="mt-1 text-2xl font-bold">Completa il tuo piano personale</h1>
        <p className="mt-2 text-sm text-zinc-400">I dati mancanti non vengono dedotti dagli esami. Puoi modificarli in seguito.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Codice corso</span>
            <input value={courseId} onChange={event => setCourseId(event.target.value)} placeholder="Codice ufficiale" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Corso di studio</span>
            <input value={courseName} onChange={event => setCourseName(event.target.value)} placeholder="Nome del corso e classe" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Anno di immatricolazione</span>
            <input type="number" min="1900" max="2200" value={cohortYear} onChange={event => setCohortYear(event.target.value)} placeholder="2025" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Anno di corso attuale</span>
            <input type="number" min="1" max="20" value={courseYear} onChange={event => setCourseYear(event.target.value)} placeholder="1, 2, 3..." className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Canale o gruppo EasyAcademy</span>
            <input value={channel} onChange={event => setChannel(event.target.value)} placeholder="Es. A-D oppure FG1:A-DIL" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span>Iniziale del cognome</span>
            <input value={surnameInitial} maxLength={1} onChange={event => setSurnameInitial(event.target.value.slice(0, 1).toUpperCase())} placeholder="A" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 uppercase" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-y border-zinc-800 py-4">
          <button type="button" onClick={loadPlan} disabled={loadingPlan} className="inline-flex items-center gap-2 rounded-md border border-sky-800 px-3 py-2 text-sm text-sky-200 hover:bg-sky-950 disabled:opacity-50">
            {loadingPlan ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
            Carica piano disponibile
          </button>
          {plan && <span className="text-sm text-zinc-400">{plan.courses.length} insegnamenti trovati</span>}
          {!plan && <span className="text-sm text-zinc-500">Se il manifesto non è importato, puoi comunque salvare il profilo.</span>}
        </div>

        {electiveCourses.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="font-semibold">Esami a scelta libera</legend>
            <p className="text-sm text-zinc-400">Seleziona gli insegnamenti scelti nel tuo piano: {requiredElectiveCfu} CFU richiesti.</p>
            <div className="divide-y divide-zinc-800 border-y border-zinc-800">
              {electiveCourses.map(course => (
                <label key={course.id} className="flex items-center gap-3 py-3 text-sm">
                  <input type="checkbox" checked={selectedIds.includes(course.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, course.id] : current.filter(id => id !== course.id))} className="accent-[#043B6B]" />
                  <span className="flex-1">{course.course_name}</span>
                  <span className="text-zinc-400">{course.cfu} CFU</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Se non hai ancora scelto gli esami, lascia tutto deselezionato. Selezionati: {selectedElectiveCfu}/{requiredElectiveCfu} CFU.</p>
          </fieldset>
        )}

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}

        <div className="flex items-center justify-between gap-3">
          {onCancel ? <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Annulla</button> : <span />}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[#043B6B] px-4 py-2 text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salva profilo
          </button>
        </div>
      </form>
    </section>
  );
}
