const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePopupText, getCourseOptions, selectStudyGroup } = require('../services/easyacademy-provider');

test('parses course, teacher, date, time, room and campus from an EasyAcademy event', () => {
  const event = parsePopupText('DettagliNome insegnamentoANALISI MATEMATICA I (FG1:A-DIL)  Argomento lezioneANALISI MATEMATICA I (FG1:A-DIL)DocentiPASSARELLI DI NAPOLI ANTONIAData e Oralunedì 12 ottobre 202608:30 - 10:30AulaNome aula: CL-T-1Capacità: 180Sede: Via Claudio [Via Claudio, 21, 80125 Napoli NA]Google MapsPercorso didatticoINGEGNERIA INFORMATICA [DE3] Laurea - 1 - Corso generico A-DILNumero eventi collegati40 eventi');
  assert.equal(event.courseName, 'ANALISI MATEMATICA I');
  assert.equal(event.channel, 'FG1:A-DIL');
  assert.deepEqual(event.teachers, ['PASSARELLI DI NAPOLI ANTONIA']);
  assert.equal(event.date, '2026-10-12');
  assert.equal(event.startTime, '08:30');
  assert.equal(event.endTime, '10:30');
  assert.equal(event.room, 'CL-T-1');
  assert.equal(event.campus, 'Via Claudio');
});

test('selects the course variant matching the requested study year', () => {
  const options = [
    { value: 'DE3', text: 'INGEGNERIA INFORMATICA (Laurea)' },
    { value: 'N46', text: 'INGEGNERIA INFORMATICA (Terzo Anno) (Laurea)' }
  ];
  assert.equal(getCourseOptions(options, { courseId: 'N46', courseName: 'Ingegneria Informatica', studyYear: 2 }).option.value, 'DE3');
  assert.equal(getCourseOptions(options, { courseId: 'DE3', courseName: 'Ingegneria Informatica', studyYear: 3 }).option.value, 'N46');
});

test('maps surname initials to EasyAcademy groups that vary by study year', () => {
  const firstYear = [
    { value: 'A-DIL|1', text: '1 - Corso generico A-DIL' },
    { value: 'DIM-NES|1', text: '1 - Corso generico DIM-NES' },
    { value: 'NET-Z|1', text: '1 - Corso generico NET-Z' }
  ];
  const secondYear = [
    { value: 'A-I|2', text: '2 - Corso generico A-I' },
    { value: 'J-Z|2', text: '2 - Corso generico J-Z' }
  ];
  assert.equal(selectStudyGroup(firstYear, 1, 'FG1:A-DIL', 'C').value, 'A-DIL|1');
  assert.equal(selectStudyGroup(secondYear, 2, 'A-D', 'C').value, 'A-I|2');
  assert.equal(selectStudyGroup(secondYear, 2, 'A-DIL', 'T').value, 'J-Z|2');
});