// Genera las llaves para los avisos push (VAPID). Ejecutar una sola vez:
//   node scripts/generar-claves-vapid.mjs
// Copia cada valor en los secretos del repositorio en GitHub (ver docs/PUESTA-EN-MARCHA.md).
import { webcrypto as c } from 'node:crypto';

const k = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await c.subtle.exportKey('raw', k.publicKey)).toString('base64url');
const jwk = await c.subtle.exportKey('jwk', k.privateKey);
const pepper = Buffer.from(c.getRandomValues(new Uint8Array(32))).toString('base64url');

console.log('\nVAPID_PUBLIC_KEY\n' + pub);
console.log('\nVAPID_PRIVATE_JWK\n' + JSON.stringify(jwk));
console.log('\nAUTH_PEPPER (secreto aleatorio para proteger sesiones y códigos)\n' + pepper + '\n');
