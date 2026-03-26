
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function test() {
    console.log('URL:', supabaseUrl ? 'Exists' : 'MISSING');
    console.log('KEY:', supabaseServiceKey ? 'Exists' : 'MISSING');

    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.from('global_messages').select('*').limit(5);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Data:', data);
    }
}

test();
