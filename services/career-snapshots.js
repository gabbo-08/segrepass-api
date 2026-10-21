// Archivio in memoria dei dati letti al login (esami di Segrepass e dati del portale Docenti),
// uno per profilo. Si perde al riavvio del backend: le rotte rispondono 409 e l'utente rifa' il login.
//
// Firme (le stesse usate da routes/career-plan.js e routes/docenti.js):
//   getCareerSnapshot(profileId)  -> Esame[] oppure null
//   getDocentiSnapshot(profileId) -> oggetto Docenti oppure null
// NB: nessun parametro "db": la versione precedente le dichiarava come (db, profileId) e le rotte
// passavano solo l'id, quindi "db" era una stringa e partiva "db.prepare is not a function".

const TTL_MS = 12 * 60 * 60 * 1000;

const careerSnapshots = new Map();
const docentiSnapshots = new Map();
const docentiLoading = new Set();

function prune(store) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.storedAt > TTL_MS) store.delete(key);
  }
}

function readFresh(store, profileId) {
  const entry = store.get(profileId);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) {
    store.delete(profileId);
    return null;
  }
  return entry.value;
}

function setCareerSnapshot(profileId, esami) {
  prune(careerSnapshots);
  careerSnapshots.set(profileId, { value: Array.isArray(esami) ? esami : [], storedAt: Date.now() });
}

function getCareerSnapshot(profileId) {
  return readFresh(careerSnapshots, profileId);
}

function setDocentiSnapshot(profileId, data) {
  prune(docentiSnapshots);
  docentiSnapshots.set(profileId, { value: data, storedAt: Date.now() });
}

function getDocentiSnapshot(profileId) {
  return readFresh(docentiSnapshots, profileId);
}

function markDocentiLoading(profileId) {
  docentiLoading.add(profileId);
}

function clearDocentiLoading(profileId) {
  docentiLoading.delete(profileId);
}

function isDocentiLoading(profileId) {
  return docentiLoading.has(profileId);
}

function clearSnapshots(profileId) {
  careerSnapshots.delete(profileId);
  docentiSnapshots.delete(profileId);
  docentiLoading.delete(profileId);
}

module.exports = {
  setCareerSnapshot,
  getCareerSnapshot,
  setDocentiSnapshot,
  getDocentiSnapshot,
  markDocentiLoading,
  clearDocentiLoading,
  isDocentiLoading,
  clearSnapshots
};