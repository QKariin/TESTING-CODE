import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ntrerrxudvgbjyscmdvh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50cmVycnh1ZHZnYmp5c2NtZHZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3MTAyNCwiZXhwIjoyMDg2NzQ3MDI0fQ.q1lwfVhJKIddxGyMOqwWliNScPaNAXK1uO6Q372b1c8';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Correct labor counts provided manually
const CORRECTIONS = [
    { name: 'andreas',      labor: 25  },
    { name: 'tonu',         labor: 0   },
    { name: 'shackleton',   labor: 82  },
    { name: 'samuel',       labor: 1   },
    { name: 'cleversmile',  labor: 2   },
    { name: 'kevin',        labor: 3   },
    { name: 'lei',          labor: 1   },
    { name: 'nobl slave',   labor: 138 },
    { name: 'mauro',        labor: 8   },
    { name: 'jacklyn',      labor: 6   },
    { name: 'robbie',       labor: 3   },
];

console.log('--- Fetching profiles ---');
const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('member_id, name');

if (profErr) { console.error('Failed to fetch profiles:', profErr.message); process.exit(1); }

let ok = 0, fail = 0;

for (const correction of CORRECTIONS) {
    const match = profiles.find(p =>
        (p.name || '').toLowerCase().trim() === correction.name.toLowerCase()
    );

    if (!match) {
        console.warn(`  NOT FOUND: "${correction.name}"`);
        fail++;
        continue;
    }

    const { error } = await supabase
        .from('tasks')
        .update({ 'Taskdom_CompletedTasks': String(correction.labor) })
        .eq('member_id', match.member_id);

    if (error) {
        console.error(`  FAIL ${match.member_id} (${match.name}): ${error.message}`);
        fail++;
    } else {
        console.log(`  ✓ ${match.name} (${match.member_id}) → labor = ${correction.labor}`);
        ok++;
    }
}

console.log(`\nDone. Updated: ${ok}, Failed/Not found: ${fail}`);
