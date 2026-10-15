const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

export type CredenzialiSegrepass = {
  codiceFiscale: string;
  password: string;
};

export type Esame = {
  materia?: string;
  insegnamento?: string;
  cfu: number;
  voto: number | null;
  giudizio: string | null;
  lode: boolean;
  data?: string;
};

export type Metriche = {
  esami: Esame[];
  cfuAcquisiti: number;
  cfuTotali: number;
  avanzamentoCFU: number;
  mediaAritmetica: number | string | null;
  mediaPonderata: number | string | null;
  baseLaurea: number | string | null;
};

export type ProfiloStudente = {
  id: string;
  course_id: string | null;
  course_name: string | null;
  cohort_year: number | null;
  current_course_year: number | null;
  channel: string | null;
  surname_initial: string | null;
};

export type PlanCourse = {
  id: number;
  course_code: string | null;
  course_name: string;
  cfu: number;
  study_year: number | null;
  semester: number | null;
  course_type: 'mandatory' | 'elective' | 'other';
  elective_group: string | null;
  elective_required_cfu: number | null;
  prerequisites: string[];
};

type LoginResponse = {
  token: string;
  expiresIn: string;
  metriche: Metriche;
  profile: ProfiloStudente;
  onboardingRequired: boolean;
};

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(body.error || 'Errore nella comunicazione con Segrepass.');
  }
  return body as T;
}

export async function fetchMetriche(token: string, credentials: CredenzialiSegrepass): Promise<Metriche> {
  const res = await fetch(`${API_BASE}/api/metriche`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(credentials),
    cache: 'no-store',
  });
  return parseResponse<Metriche>(res);
}

export async function loginAPI(credentials: CredenzialiSegrepass): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return parseResponse<LoginResponse>(res);
}

export async function fetchProfile(token: string) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return parseResponse<{ profile: ProfiloStudente; selectedElectiveIds: number[]; onboardingRequired: boolean }>(res);
}

export async function updateProfile(token: string, updates: {
  courseId: string;
  courseName: string;
  cohortYear: number;
  currentCourseYear: number;
  channel: string;
  surnameInitial: string;
  selectedElectiveIds?: number[];
}) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  return parseResponse<{ profile: ProfiloStudente; selectedElectiveIds: number[]; onboardingRequired: boolean }>(res);
}

export async function fetchStudyPlan(token: string, courseId: string, cohortYear: number) {
  const res = await fetch(`${API_BASE}/api/study-plans/${encodeURIComponent(courseId)}/${cohortYear}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return parseResponse<{ plan: { id: number; course_name: string; source_name: string; source_url: string }; courses: PlanCourse[]; selectedElectiveIds: number[] }>(res);
}

export async function fetchCareerPlan(token: string) {
  const res = await fetch(`${API_BASE}/api/career/plan`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return parseResponse<{
    profile: ProfiloStudente;
    plan: { course_name: string; cohort_year: number; source_name: string; source_url: string };
    courses: Array<PlanCourse & { status: 'passed' | 'missing' | 'elective_available' | 'needs_review'; confidence?: number; passedExam?: Esame; selected?: boolean }>;
    electiveGroups: Array<{
      id: string;
      requiredCfu: number;
      passedCfu: number;
      selectedPendingCfu: number;
      remainingCfu: number;
      courses: Array<PlanCourse & { status: 'passed' | 'missing' | 'elective_available' | 'needs_review'; selected?: boolean }>;
    }>;
    summary: { passedCourses: number; missingCourses: number; reviewCourses: number; mandatoryMissingCfu: number; electiveRemainingCfu: number };
  }>(res);
}

export type TimetableFilters = {
  studyYear: number;
  semester: number | null;
  channel: string;
  academicYear?: string;
};

export async function fetchTimetable(token: string, filters: TimetableFilters) {
  const params = new URLSearchParams({ studyYear: String(filters.studyYear), channel: filters.channel });
  if (filters.semester) params.set('semester', String(filters.semester));
  if (filters.academicYear) params.set('academicYear', filters.academicYear);
  const res = await fetch(`${API_BASE}/api/timetable?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return parseResponse<{
    filters: TimetableFilters;
    timetable: { academicYear: string; course: string; channel: string; events: Array<{ courseName: string; teachers: string[]; date: string | null; dateTime: string; startTime: string | null; endTime: string | null; room: string | null; campus: string | null }> };
  }>(res);
}