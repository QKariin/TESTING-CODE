import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: p } = await supabaseAdmin.from('profiles').select('id, member_id').in('id', ['15a5d17f-3567-42ee-817a-5ec14b90eb6e', '20c6c730-ebb3-4c91-81f1-34533df0ede5']);
    console.log("Profiles matching deleted UUIDs:", p);

    if (p) {
        const emails = p.map(x => x.member_id);
        const { data: t } = await supabaseAdmin.from('tasks').select('Name, member_id, taskQueue, "Taskdom_History"').in('member_id', emails);
        console.log("Tasks for their email counterparts:", JSON.stringify(t, null, 2));
    }
}
run();
