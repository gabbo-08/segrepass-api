const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

// --- Auth Helpers ---
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    throw new Error('SESSION_EXPIRED');
  }

  return res;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(body.error || 'Errore nella comunicazione con il server.');
  }
  return body as T;
}

// --- Interfaces & Types ---
export interface CredenzialiSegrepass {
  codiceFiscale: string;
  password: string;
}

export interface ProfiloStudente {
  codiceFiscale?: string;
  anagrafica?: {
    nome?: string;
    cognome?: string;
    matricola?: string;
    codiceCorso?: string;
    corsoDiLaurea?: string;
    annoImmatricolazione?: number;
    annoCorso?: number;
    canale?: string;
  };
  carriera?: Record<string, any>;
  esamiSostenuti?: Esame[];
  tasse?: TasseData;
}

export interface Esame {
  codice?: string;
  nome: string;
  cfu: number;
  voto?: number | string;
  data?: string;
  stato?: string;
}

export interface PlanCourse {
  id?: number;
  courseCode?: string;
  courseName: string;
  cfu: number;
  studyYear?: number;
  semester?: number;
  courseType?: 'mandatory' | 'elective';
}

export interface Metriche {
  mediaAritmetica?: number;
  mediaPonderata?: number;
  cfuAcquisiti?: number;
  cfuTotali?: number;
  esamiSuperati?: number;
  esamiTotali?: number;
  votoBaseLaurea?: number;
  [key: string]: any;
}

export interface TasseData {
  importoTotale?: number;
  statoPagamento?: string;
  dettagli?: any[];
}

export interface Prenotazione {
  esame?: string;
  dataAppello?: string;
  aula?: string;
  stato?: string;
}

export interface AvvisoDocente {
  title: string;
  date: string | null;
  content: string;
  link: string | null;
}

export interface DocenteAnnouncements {
  professor: string;
  slug: string;
  count: number;
  items: AvvisoDocente[];
}

export interface SubscriptionDocenti {
  courseName: string | null;
  courseCode: string | null;
  academicYear: string | null;
  professor: string | null;
  section: string | null;
}

export interface BookedExamDocenti {
  courseName: string | null;
  courseCode: string | null;
  academicYear: string | null;
  examDate: string | null;
  bookingDate?: string | null;
  status: string | null;
  location: string | null;
}

export interface DocentiDataResponse {
  available: boolean;
  reason?: string | null;
  retrievedAt?: string;
  announcements: DocenteAnnouncements[];
  subscriptions: SubscriptionDocenti[];
  bookedExams: BookedExamDocenti[];
}

// --- API Functions ---

export async function loginAPI(credentials: CredenzialiSegrepass) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Login fallito. Verificare le credenziali.');
  }

  const data = await res.json();
  if (data.token && typeof window !== 'undefined') {
    localStorage.setItem('token', data.token);
  }
  return data;
}

export async function updateProfile(updates: Partial<ProfiloStudente>, token?: string) {
  const authToken = token || getToken() || '';
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(updates),
  });
  return parseResponse<ProfiloStudente>(res);
}

export async function fetchStudyPlan(token?: string) {
  const authToken = token || getToken() || '';
  const res = await fetch(`${API_BASE}/api/study-plans`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  });
  return parseResponse<any>(res);
}

export async function fetchCareerPlan(token?: string) {
  const authToken = token || getToken() || '';
  const res = await fetch(`${API_BASE}/api/career/plan`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  });
  return parseResponse<{
    profile: ProfiloStudente;
    plan: { course_name: string; cohort_year: number; source_name: string; source_url: string };
    courses: Array<
      PlanCourse & {
        status: 'passed' | 'missing' | 'elective_available' | 'needs_review';
        confidence?: number;
        passedExam?: Esame;
        selected?: boolean;
      }
    >;
    electiveGroups: Array<{
      id: string;
      requiredCfu: number;
      passedCfu: number;
      selectedPendingCfu: number;
      remainingCfu: number;
      courses: Array<
        PlanCourse & {
          status: 'passed' | 'missing' | 'elective_available' | 'needs_review';
          selected?: boolean;
        }
      >;
    }>;
    summary: {
      passedCourses: number;
      missingCourses: number;
      reviewCourses: number;
      mandatoryMissingCfu: number;
      electiveRemainingCfu: number;
    };
  }>(res);
}

export async function fetchMetriche(): Promise<Metriche> {
  const res = await fetchWithAuth('/api/career');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Impossibile recuperare le metriche di carriera.');
  }
  return res.json();
}

export async function fetchTimetable(token?: string) {
  const authToken = token || getToken() || '';
  const res = await fetch(`${API_BASE}/api/timetable`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  });
  return parseResponse<any>(res);
}

export async function fetchDocentiData(token?: string): Promise<DocentiDataResponse> {
  const authToken = token || getToken() || '';
  const res = await fetch(`${API_BASE}/api/docenti`, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  });
  return parseResponse<DocentiDataResponse>(res);
}

export async function fetchDocentiAnnouncements(token?: string): Promise<DocenteAnnouncements[]> {
  const data = await fetchDocentiData(token);
  return data.announcements || [];
}

export async function fetchDocentiSubscriptions(token?: string): Promise<SubscriptionDocenti[]> {
  const data = await fetchDocentiData(token);
  return data.subscriptions || [];
}

export async function fetchDocentiBookedExams(token?: string): Promise<BookedExamDocenti[]> {
  const data = await fetchDocentiData(token);
  return data.bookedExams || [];
}