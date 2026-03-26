import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '../independent-app/.env.local');
const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
for (const line of lines) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

supabase.storage.from('media').list('avatars', { limit: 100 }).then(({ data, error }) => {
    if (error) console.error(error);
    else console.log(data!.map(f => f.name).join('\n'));
});
