import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: t } = await supabaseAdmin.from('tasks').select('Name, member_id, ID').ilike('Name', '%slave%').limit(10);
    console.log('slaves:', t);
}
run();
