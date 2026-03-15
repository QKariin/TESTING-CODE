import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
    const { data: t } = await supabaseAdmin.from('tasks').select('member_id, taskdom_active_task, "Taskdom_History", taskQueue').eq('member_id', 'pr.finsko@gmail.com');
    if (t && t[0]) {
        console.log("activeTask:", t[0].taskdom_active_task ? JSON.stringify(t[0].taskdom_active_task) : "null");
        console.log("queue:", t[0].taskQueue ? String(t[0].taskQueue) : "empty");
        console.log("history:", t[0].Taskdom_History ? String(t[0].Taskdom_History) : "empty");
    }
}
run();
