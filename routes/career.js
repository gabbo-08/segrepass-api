const express=require('express');
const {getDatiCarriera}=require('../scraper/segrepass');
const {calcolaMetriche,simulaBaseLaurea}=require('../lib/metriche');
const router=express.Router();
function getCredentials(req,res){
  const {codiceFiscale,password}=req.body||{};
  if(typeof codiceFiscale!=='string'||!codiceFiscale.trim()||typeof password!=='string'||!password){
    res.status(400).json({error:'Inserisci codice fiscale e password Segrepass.'});
    return null;
  }
  return {codiceFiscale,password};
}
function handleScraperError(err,res,next){
  if(err.message==='Credenziali Segrepass non valide.')return res.status(401).json({error:err.message});
  return next(err);
}
router.post('/esami',async(req,res,next)=>{const credentials=getCredentials(req,res);if(!credentials)return;try{const{tabellaEsami}=await getDatiCarriera(credentials);res.json({headers:tabellaEsami.headers,esami:tabellaEsami.records,totale:tabellaEsami.rowCount});}catch(err){handleScraperError(err,res,next);}});
router.post('/metriche',async(req,res,next)=>{const credentials=getCredentials(req,res);if(!credentials)return;try{const{tabellaEsami}=await getDatiCarriera(credentials);res.json(calcolaMetriche(tabellaEsami.records));}catch(err){handleScraperError(err,res,next);}});
router.post('/riepilogo',async(req,res,next)=>{const credentials=getCredentials(req,res);if(!credentials)return;try{const{tabelleRiepilogo}=await getDatiCarriera(credentials);res.json({tabelle:tabelleRiepilogo});}catch(err){handleScraperError(err,res,next);}});
router.post('/simula',async(req,res,next)=>{const credentials=getCredentials(req,res);if(!credentials)return;try{const{esamiFuturi=[]}=req.body;if(!Array.isArray(esamiFuturi))return res.status(400).json({error:'esamiFuturi deve essere un array.'});const{tabellaEsami}=await getDatiCarriera(credentials);const{esami}=calcolaMetriche(tabellaEsami.records);res.json({baseLaureaSimulata:simulaBaseLaurea(esami,esamiFuturi),esamiFuturi});}catch(err){handleScraperError(err,res,next);}});
module.exports=router;
