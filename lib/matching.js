const DEFAULT_THRESHOLD = 0.84;
const AMBIGUITY_MARGIN = 0.06;

function normalizeCourseName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\biv\b/g, '4')
    .replace(/\bi\b/g, '1')
    .replace(/\bed\b/g, 'e')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution);
    }
    for (let index = 0; index <= right.length; index++) previous[index] = current[index];
  }
  return previous[right.length];
}

function nameSimilarity(left, right) {
  const normalizedLeft = normalizeCourseName(left);
  const normalizedRight = normalizeCourseName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const longest = Math.max(normalizedLeft.length, normalizedRight.length);
  const editSimilarity = 1 - levenshteinDistance(normalizedLeft, normalizedRight) / longest;
  const leftTokens = new Set(normalizedLeft.split(' '));
  const rightTokens = new Set(normalizedRight.split(' '));
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenSimilarity = union ? intersection / union : 0;
  return Math.max(editSimilarity, tokenSimilarity);
}

function getCourseCode(course) {
  return String(course.courseCode || course.codice || course.cod || '').trim().toLowerCase();
}

function getCourseName(course) {
  return course.courseName || course.materia || course.insegnamento || course.name || '';
}

function scoreCandidate(planCourse, passedExam) {
  const planCode = getCourseCode(planCourse);
  const passedCode = getCourseCode(passedExam);
  if (planCode && passedCode) {
    if (planCode !== passedCode) return null;
    const creditsMatch = !planCourse.cfu || !passedExam.cfu || Math.abs(planCourse.cfu - passedExam.cfu) < 0.5;
    return { score: creditsMatch ? 1 : 0.82, method: 'course_code', needsReview: !creditsMatch };
  }

  const similarity = nameSimilarity(getCourseName(planCourse), getCourseName(passedExam));
  if (similarity < DEFAULT_THRESHOLD) return null;

  const creditsMatch = !planCourse.cfu || !passedExam.cfu || Math.abs(planCourse.cfu - passedExam.cfu) < 0.5;
  return {
    score: Math.max(0, Math.min(1, similarity + (creditsMatch ? 0.04 : -0.12))),
    method: 'fuzzy_name',
    needsReview: !creditsMatch
  };
}

function matchStudyPlan({ planCourses = [], passedExams = [], selectedElectiveIds = [] }) {
  const usedExamIndexes = new Set();
  const selectedIds = new Set(selectedElectiveIds.map(Number));
  const courses = planCourses.map(planCourse => {
    const candidates = passedExams
      .map((passedExam, index) => ({ passedExam, index, match: scoreCandidate(planCourse, passedExam) }))
      .filter(candidate => candidate.match && !usedExamIndexes.has(candidate.index))
      .sort((left, right) => right.match.score - left.match.score);

    const best = candidates[0];
    const isAmbiguous = best && candidates[1] && best.match.score - candidates[1].match.score < AMBIGUITY_MARGIN;
    const planCourseId = Number(planCourse.id);
    const isSelected = selectedIds.has(planCourseId);
    const isUnselectedElective = planCourse.courseType === 'elective' && !isSelected;

    if (best && (isAmbiguous || best.match.needsReview)) {
      usedExamIndexes.add(best.index);
      return { ...planCourse, status: 'needs_review', confidence: best.match.score, matchMethod: best.match.method };
    }

    if (best && best.match.score >= DEFAULT_THRESHOLD) {
      usedExamIndexes.add(best.index);
      return {
        ...planCourse,
        status: 'passed',
        confidence: best.match.score,
        matchMethod: best.match.method,
        passedExam: best.passedExam
      };
    }

    return {
      ...planCourse,
      status: isUnselectedElective ? 'elective_available' : 'missing',
      selected: isSelected
    };
  });

  const electiveGroups = new Map();
  for (const course of courses.filter(item => item.courseType === 'elective')) {
    const groupId = course.electiveGroup || 'electives';
    const group = electiveGroups.get(groupId) || {
      id: groupId,
      requiredCfu: 0,
      passedCfu: 0,
      selectedPendingCfu: 0,
      courses: []
    };
    group.requiredCfu = Math.max(group.requiredCfu, Number(course.electiveRequiredCfu) || 0);
    if (course.status === 'passed') group.passedCfu += Number(course.cfu) || 0;
    else if (course.selected) group.selectedPendingCfu += Number(course.cfu) || 0;
    group.courses.push(course);
    electiveGroups.set(groupId, group);
  }

  const electiveSummary = [...electiveGroups.values()].map(group => ({
    ...group,
    remainingCfu: Math.max(0, group.requiredCfu - group.passedCfu)
  }));

  return {
    courses,
    electiveGroups: electiveSummary,
    summary: {
      passedCourses: courses.filter(course => course.status === 'passed').length,
      missingCourses: courses.filter(course => course.status === 'missing').length,
      reviewCourses: courses.filter(course => course.status === 'needs_review').length,
      mandatoryMissingCfu: courses
        .filter(course => course.courseType === 'mandatory' && course.status === 'missing')
        .reduce((total, course) => total + (Number(course.cfu) || 0), 0),
      electiveRemainingCfu: electiveSummary.reduce((total, group) => total + group.remainingCfu, 0)
    }
  };
}

module.exports = { matchStudyPlan, normalizeCourseName, nameSimilarity, DEFAULT_THRESHOLD };