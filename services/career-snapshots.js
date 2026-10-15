const SNAPSHOT_TTL_MS = 60 * 60 * 1000;
const snapshots = new Map();

function pruneExpired(now = Date.now()) {
  for (const [profileId, snapshot] of snapshots) {
    if (snapshot.expiresAt <= now) snapshots.delete(profileId);
  }
}

function saveCareerSnapshot(profileId, exams, additional = {}, now = Date.now()) {
  pruneExpired(now);
  snapshots.set(profileId, {
    exams,
    taxes: additional.taxes || { paid: [], pending: [] },
    docenti: additional.docenti || null,
    expiresAt: now + SNAPSHOT_TTL_MS
  });
}

function getSnapshot(profileId, now = Date.now()) {
  const snapshot = snapshots.get(profileId);
  if (!snapshot || snapshot.expiresAt <= now) {
    snapshots.delete(profileId);
    return null;
  }
  return snapshot;
}

function getCareerSnapshot(profileId, now = Date.now()) {
  return getSnapshot(profileId, now)?.exams || null;
}

function getTaxesSnapshot(profileId, now = Date.now()) {
  return getSnapshot(profileId, now)?.taxes || null;
}

function getDocentiSnapshot(profileId, now = Date.now()) {
  return getSnapshot(profileId, now)?.docenti || null;
}

function clearCareerSnapshots() {
  snapshots.clear();
}

module.exports = { saveCareerSnapshot, getCareerSnapshot, getTaxesSnapshot, getDocentiSnapshot, clearCareerSnapshots, SNAPSHOT_TTL_MS };