import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://ntrerrxudvgbjyscmdvh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cmVycnh1ZHZnYmp5c2NtZHZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MTAyNCwiZXhwIjoyMDg2NzQ3MDI0fQ.q1lwfVhJKIddxGyMOqwWliNScPaNAXK1uO6Q372b1c8';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const s = (v) => (v === undefined || v === null || v === '') ? null : String(v).trim();
const n = (v) => { const x = Number(v); return isNaN(x) ? null : x; };
const j = (v) => { if (!v || v === '') return null; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };

const CSV_PATH = '/Users/liviacechova/Downloads/A-SLAVE+PROFILE (7).csv';
const raw = fs.readFileSync(CSV_PATH, 'utf-8');

const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
});

console.log(`Parsed ${rows.length} rows`);
const csvEmails = rows.map(r => s(r['MemberID'])).filter(Boolean);
console.log(`Emails in CSV: ${csvEmails.length}`);

// Pre-fetch existing profile IDs so we don't generate new ones for existing rows
const { data: existingProfileRows } = await supabase.from('profiles').select('id, member_id');
const existingIdMap = {};
for (const r of (existingProfileRows || [])) {
    if (r.member_id) existingIdMap[r.member_id.toLowerCase()] = r.id;
}

let profilesOk = 0, tasksOk = 0, errors = [];

for (const row of rows) {
    const email = s(row['MemberID']);
    if (!email) { console.log('Skipping row — no MemberID'); continue; }

    // ── PROFILES table columns: id, member_id, name, hierarchy, score, wallet,
    //    strike_count, last_active, joined_date, avatar_url, parameters, limits, kinks, routine, notes
    const existingId = existingIdMap[email.toLowerCase()];
    const profileRow = {
        id:           existingId || randomUUID(),
        member_id:    email,
        name:         s(row['Name']),
        hierarchy:    s(row['Hierarchy']) || 'Hall Boy',
        wallet:       n(row['Wallet']) ?? 0,
        score:        n(row['Score']) ?? n(row['Points']) ?? 0,
        avatar_url:   s(row['Profile pic']),
        kinks:        s(row['kink']),
        limits:       s(row['limits']),
        routine:      s(row['routine']),
        strike_count: n(row['strikeCount']) ?? 0,
        last_active:  s(row['Last Seen']),
        joined_date:  s(row['joined']),
        parameters:   j(row['Parameters']),
    };
    // Drop null-valued optional fields to avoid overwriting existing data with null
    ['avatar_url','kinks','limits','routine','last_active','joined_date','parameters'].forEach(k => {
        if (profileRow[k] === null) delete profileRow[k];
    });

    const { error: pe } = await supabase.from('profiles').upsert(profileRow, { onConflict: 'member_id' });
    if (pe) errors.push(`profiles ${email}: ${pe.message}`);
    else profilesOk++;

    // ── TASKS table: has ALL original CSV columns (Wix CMS structure)
    //    Skip Taskdom_History and routinehistory — already cleared, keep empty
    const taskRow = {
        member_id:              email,
        Status:                 s(row['Status']),
        Name:                   s(row['Name']),
        'Profile pic':          s(row['Profile pic']),
        reward:                 s(row['reward']),
        Score:                  n(row['Score']),
        ID:                     s(row['ID']),
        'Created Date':         s(row['Created Date']),
        'Updated Date':         s(row['Updated Date']),
        Owner:                  s(row['Owner']),
        'Daily Score':          n(row['Daily Score']),
        'Weekly Score':         n(row['Weekly Score']),
        'Monthly Score':        n(row['Monthly Score']),
        'Yearly Score':         n(row['Yearly Score']),
        Points:                 n(row['Points']),
        Hierarchy:              s(row['Hierarchy']),
        Taskdom_TotalTasks:     n(row['Taskdom_TotalTasks']),
        Taskdom_CompletedTasks: n(row['Taskdom_CompletedTasks']),
        Taskdom_Streak:         n(row['Taskdom_Streak']),
        Taskdom_Points:         n(row['Taskdom_Points']),
        PreferredCategories:    s(row['PreferredCategories']),
        Wallet:                 n(row['Wallet']),
        'Last Seen':            s(row['Last Seen']),
        taskdom_active_task:    s(row['taskdom_active_task']),
        taskdom_pending_state:  s(row['taskdom_pending_state']),
        'Task Review Queue':    s(row['Task Review Queue']),
        lastReadByAdmin:        s(row['lastReadByAdmin']),
        'Last Message Time':    s(row['Last Message Time']),
        'Last Read By Slave':   s(row['Last Read By Slave']),
        'Tribute History':      s(row['Tribute History']),
        Taskdom_SkippedTasks:   n(row['Taskdom_SkippedTasks']),
        APPROVED:               n(row['APPROVED']),
        'REJECTED:':            n(row['REJECTED:']),
        application:            s(row['application']),
        Parameters:             s(row['Parameters']),
        Statistics:             s(row['Statistics']),
        joined:                 s(row['joined']),
        lastWorship:            s(row['lastWorship']),
        kneelCount:             n(row['kneelCount']) ?? 0,
        'today kneeling':       s(row['today kneeling']) ?? '0',
        taskQueue:              j(row['taskQueue']),
        strikeCount:            n(row['strikeCount']),
        routine:                s(row['routine']),
        instalation:            s(row['instalation']),
        kink:                   s(row['kink']),
        limits:                 s(row['limits']),
        kneel_history:          j(row['kneel_history']),
        // Taskdom_History and routinehistory intentionally omitted — cleared, keep null
    };

    const { error: te } = await supabase.from('tasks').upsert(taskRow, { onConflict: 'member_id' });
    if (te) errors.push(`tasks ${email}: ${te.message}`);
    else tasksOk++;
}

console.log(`\nUpserted: ${profilesOk} profiles, ${tasksOk} tasks`);

// ── DELETE users not in CSV ───────────────────────────────────────────────────
const lowerCsvEmails = csvEmails.map(e => e.toLowerCase());

const { data: existingProfiles } = await supabase.from('profiles').select('member_id');
const { data: existingTasks }    = await supabase.from('tasks').select('member_id');

const toDeleteProfiles = (existingProfiles || []).map(r => r.member_id).filter(e => e && !lowerCsvEmails.includes(e.toLowerCase()));
const toDeleteTasks    = (existingTasks    || []).map(r => r.member_id).filter(e => e && !lowerCsvEmails.includes(e.toLowerCase()));

console.log(`\nTo delete — profiles: ${toDeleteProfiles.length}, tasks: ${toDeleteTasks.length}`);
if (toDeleteProfiles.length) console.log('  profiles:', toDeleteProfiles);
if (toDeleteTasks.length)    console.log('  tasks:', toDeleteTasks);

if (toDeleteProfiles.length) {
    const { error } = await supabase.from('profiles').delete().in('member_id', toDeleteProfiles);
    if (error) errors.push(`delete profiles: ${error.message}`);
    else console.log('Profiles deleted OK');
}
if (toDeleteTasks.length) {
    const { error } = await supabase.from('tasks').delete().in('member_id', toDeleteTasks);
    if (error) errors.push(`delete tasks: ${error.message}`);
    else console.log('Tasks deleted OK');
}

if (errors.length) {
    console.log('\nERRORS:');
    errors.forEach(e => console.log(' -', e));
} else {
    console.log('\nAll done — no errors.');
}
