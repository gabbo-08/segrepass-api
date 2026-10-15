const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 1;
const DEFAULT_DATABASE_PATH = path.join(os.homedir(), '.segrepass-api', 'segrepass.sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS StudentProfile (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    course_name TEXT,
    cohort_year INTEGER CHECK (cohort_year IS NULL OR cohort_year BETWEEN 1900 AND 2200),
    current_course_year INTEGER CHECK (current_course_year IS NULL OR current_course_year BETWEEN 1 AND 20),
    channel TEXT,
    surname_initial TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS StudyPlans (
    id INTEGER PRIMARY KEY,
    course_id TEXT NOT NULL,
    cohort_year INTEGER NOT NULL CHECK (cohort_year BETWEEN 1900 AND 2200),
    course_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1',
    source_name TEXT,
    source_url TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, cohort_year, version)
  );

  CREATE TABLE IF NOT EXISTS PlanCourses (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES StudyPlans(id) ON DELETE CASCADE,
    course_code TEXT,
    course_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    cfu REAL NOT NULL CHECK (cfu >= 0),
    study_year INTEGER CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 20),
    semester INTEGER CHECK (semester IS NULL OR semester IN (1, 2)),
    course_type TEXT NOT NULL DEFAULT 'mandatory'
      CHECK (course_type IN ('mandatory', 'elective', 'other')),
    elective_group TEXT,
    elective_required_cfu REAL CHECK (elective_required_cfu IS NULL OR elective_required_cfu >= 0),
    prerequisites_json TEXT NOT NULL DEFAULT '[]',
    UNIQUE (plan_id, course_code)
  );

  CREATE TABLE IF NOT EXISTS SelectedElectives (
    profile_id TEXT NOT NULL REFERENCES StudentProfile(id) ON DELETE CASCADE,
    plan_course_id INTEGER NOT NULL REFERENCES PlanCourses(id) ON DELETE CASCADE,
    selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, plan_course_id)
  );

  CREATE INDEX IF NOT EXISTS idx_study_plans_course_cohort
    ON StudyPlans(course_id, cohort_year, imported_at DESC);
  CREATE INDEX IF NOT EXISTS idx_plan_courses_plan_year_semester
    ON PlanCourses(plan_id, study_year, semester);
  CREATE INDEX IF NOT EXISTS idx_selected_electives_profile
    ON SelectedElectives(profile_id);
`;

function createDatabase(filename = process.env.SEGREPASS_DB_PATH || DEFAULT_DATABASE_PATH) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma('foreign_keys = ON');

  const currentVersion = db.pragma('user_version', { simple: true });
  if (currentVersion > SCHEMA_VERSION) {
    db.close();
    throw new Error(`Database schema ${currentVersion} is newer than supported schema ${SCHEMA_VERSION}.`);
  }

  db.exec(SCHEMA);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  if (filename !== ':memory:') db.pragma('journal_mode = WAL');
  return db;
}

const db = createDatabase();

module.exports = { db, createDatabase, SCHEMA_VERSION };