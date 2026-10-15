// Turns on "Continue with Google": asks for your Google Client ID, checks it, and saves it in server/.env
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const ID_RE = /^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i;

if (!fs.existsSync(envPath)) fs.copyFileSync(examplePath, envPath);

let id = (process.argv[2] || '').trim().replace(/^["']|["']$/g, '');
if (!id) {
  console.log(`
=== Google sign-in setup ===
1. Open https://console.cloud.google.com/apis/credentials
2. Create credentials -> OAuth client ID -> Application type: Web application
3. Authorized JavaScript origins -> ADD URI:  http://localhost:5173
   (Do NOT add a redirect URI. Not needed.)
4. Copy the Client ID. It looks like 123456789-abc123.apps.googleusercontent.com
`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  id = (await rl.question('Paste your Client ID here: ')).trim().replace(/^["']|["']$/g, '');
  rl.close();
}

if (!ID_RE.test(id)) {
  console.error('\nThat does not look like a Google Client ID.');
  console.error('It must look like: 123456789012-abcdefghij.apps.googleusercontent.com');
  console.error('(Do not paste the "Client secret". It is not needed.)\n');
  process.exit(1);
}

let env = fs.readFileSync(envPath, 'utf8');
if (/^GOOGLE_CLIENT_ID=.*$/m.test(env)) env = env.replace(/^GOOGLE_CLIENT_ID=.*$/m, `GOOGLE_CLIENT_ID=${id}`);
else env += `\nGOOGLE_CLIENT_ID=${id}\n`;
fs.writeFileSync(envPath, env);

console.log('\nDone. Saved to server/.env');
console.log('Restart the app (close it, run setup-and-run.bat again). The Google button will now work.');
console.log('Open the site at EXACTLY http://localhost:5173 (not 127.0.0.1, not an IP address).\n');
