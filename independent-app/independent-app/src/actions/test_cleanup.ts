import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log("Cleaning up rogue UUID tasks...");

    // Find all rows where member_id is a UUID (doesn't contain @)
    const { data: t } = await supabaseAdmin.from('tasks').select('member_id, Name').limit(1000);

    if (!t) {
        console.log("No tasks found.");
        return;
    }

    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    const rogueRows = t.filter(row => row.member_id && uuidPattern.test(row.member_id));

    console.log(`Found ${rogueRows.length} rogue UUID rows. Deleting them...`);

    for (const row of rogueRows) {
        const { error } = await supabaseAdmin.from('tasks').delete().eq('member_id', row.member_id);
        if (error) {
            console.error(`Error deleting row ${row.member_id}:`, error.message);
        } else {
            console.log(`Deleted rogue row: ${row.member_id} (${row.Name || 'Unknown Name'})`);
        }
    }

    console.log("Cleanup complete!");
}
run();
