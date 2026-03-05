import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log("Adding email column to tasks...");

    // In Supabase, we can execute SQL via the REST API if we have a function, but we can't do raw SQL without the postgres connection.
    // Wait, the postgres connection isn't available. Instead, I'll update the rows.
    // Does the `email` column exist? If not, inserting it via the regular client will fail.
    // Let's first check if we can add it, or if I need to tell the user to use the Supabase UI.

    const { data: p } = await supabaseAdmin.from('profiles').select('id, member_id');
    const profiles = p || [];

    console.log("Fetching tasks...");
    const { data: t, error } = await supabaseAdmin.from('tasks').select('member_id, ID');
    if (error) {
        console.error("Error fetching tasks:", error);
        return;
    }

    // We cannot automatically ALTER TABLE from the js client unless there's an RPC.
    console.log("Checking if email column exists by trying to update one row...");
    const { error: testErr } = await supabaseAdmin.from('tasks').update({ email: 'test@test.com' }).limit(1);
    if (testErr) {
        console.log("Email column does not exist! Please add it in the Supabase UI.");
        console.log("Error:", testErr.message);
    } else {
        console.log("Email column exists! Proceeding to populate...");
        for (const task of t) {
            let email = null;
            if (task.member_id && task.member_id.includes('@')) {
                email = task.member_id;
            } else {
                const profile = profiles.find(pr => pr.id === task.member_id || pr.member_id === task.member_id);
                if (profile) email = profile.member_id;
            }
            if (email) {
                await supabaseAdmin.from('tasks').update({ email }).eq('member_id', task.member_id);
            }
        }
        console.log("Populated all emails!");
    }
}
run();
