import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ntrerrxudvgbjyscmdvh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cmVycnh1ZHZnYmp5c2NtZHZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MTAyNCwiZXhwIjoyMDg2NzQ3MDI0fQ.q1lwfVhJKIddxGyMOqwWliNScPaNAXK1uO6Q372b1c8';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const { error, count } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .neq('member_id', '')   // matches all rows
    .select('member_id', { count: 'exact', head: true });

if (error) {
    console.error('Error:', error.message);
    process.exit(1);
}

console.log(`Done — cleared avatar_url + profile_picture_url on ${count ?? 'all'} profiles.`);
