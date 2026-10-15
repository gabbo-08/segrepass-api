const CFU_TOTALI_CORSO = parseInt(process.env.CFU_TOTALI_CORSO || '180');

function normalizzaIntestazione(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizzaEsame(r) {
  // Ricerca flessibile delle chiavi nella riga estratta da Segrepass
  const getVal = (patterns) => {
    const keys = Object.keys(r);
    for (const pat of patterns) {
      const match = keys.find(k => pat.test(normalizzaIntestazione(k)));
      if (match && r[match] !== null && r[match] !== undefined && String(r[match]).trim()) {
        return String(r[match]).trim();
      }
    }
    return '';
  };

  const votoRaw = getVal([/^valutazione/, /^voto/, /^giudizio/, /^esito/]);
  const lode = /30\s*l|lode/i.test(votoRaw);
  const votoMatch = votoRaw.match(/\d+(?:[.,]\d+)?/);
  const votoNum = votoMatch ? parseFloat(votoMatch[0].replace(',', '.')) : NaN;
  const cfuRaw = getVal([/cfu/, /^crediti/, /^peso/]);
  const cfu = parseInt(cfuRaw, 10) || 0;

  const materia = getVal([/^insegnamento/, /^denominazione/, /^descrizione/, /^materia/, /^esame/, /^attivita/, /^nome/]) || 'Esame';
  const dataEsame = getVal([/^data/, /^verbalizz/, /^superamento/]);

  return {
    codice: getVal([/^codice/, /^cod/]),
    materia,
    voto: isNaN(votoNum) || votoNum === 0 ? null : votoNum,
    giudizio: isNaN(votoNum) || votoNum === 0 ? (votoRaw || 'IDONEO') : null,
    lode,
    cfu,
    data: dataEsame
  };
}

function calcolaMetriche(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      esami: [],
      cfuAcquisiti: 0,
      cfuTotali: CFU_TOTALI_CORSO,
      avanzamentoCFU: 0,
      mediaAritmetica: null,
      mediaPonderata: null,
      baseLaurea: null
    };
  }

  const tuttiEsami = records.map(normalizzaEsame).filter(e => e.materia && (e.cfu > 0 || e.voto !== null || e.giudizio));
  const esamiConVoto = tuttiEsami.filter(e => typeof e.voto === 'number' && e.voto > 0 && e.cfu > 0);

  const cfuAcquisiti = tuttiEsami.reduce((acc, e) => acc + (e.cfu || 0), 0);
  const cfuPonderati = esamiConVoto.reduce((acc, e) => acc + (e.cfu || 0), 0);

  let mediaAritmetica = null;
  let mediaPonderata = null;
  let baseLaurea = null;

  if (esamiConVoto.length > 0) {
    mediaAritmetica = esamiConVoto.reduce((acc, e) => acc + e.voto, 0) / esamiConVoto.length;
    mediaPonderata = esamiConVoto.reduce((acc, e) => acc + (e.voto * e.cfu), 0) / (cfuPonderati || 1);
    baseLaurea = (mediaPonderata / 30) * 110;
  }

  const avanzamentoCFU = Math.min(Math.round((cfuAcquisiti / CFU_TOTALI_CORSO) * 100), 100);

  return {
    esami: tuttiEsami,
    cfuAcquisiti,
    cfuTotali: CFU_TOTALI_CORSO,
    avanzamentoCFU,
    mediaAritmetica: mediaAritmetica ? parseFloat(mediaAritmetica.toFixed(2)) : '--',
    mediaPonderata: mediaPonderata ? parseFloat(mediaPonderata.toFixed(2)) : '--',
    baseLaurea: baseLaurea ? parseFloat(baseLaurea.toFixed(2)) : '--'
  };
}

function simulaBaseLaurea(esamiAttuali = [], esamiFuturi = []) {
  const tutti = [...esamiAttuali, ...esamiFuturi].filter(e => typeof e.voto === 'number' && e.cfu);
  if (!tutti.length) return 0;
  const totCFU = tutti.reduce((acc, e) => acc + e.cfu, 0);
  const mp = tutti.reduce((acc, e) => acc + (e.voto * e.cfu), 0) / totCFU;
  return parseFloat(((mp / 30) * 110).toFixed(2));
}

module.exports = { calcolaMetriche, simulaBaseLaurea, normalizzaEsame };