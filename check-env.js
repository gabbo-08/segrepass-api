require('dotenv').config();
const u = process.env.DOCENTI_USERNAME || '';
const p = process.env.DOCENTI_PASSWORD || '';
console.log('username: lunghezza', u.length, '| spazi ai bordi:', u !== u.trim());
console.log('password: lunghezza', p.length, '| spazi ai bordi:', p !== p.trim());
