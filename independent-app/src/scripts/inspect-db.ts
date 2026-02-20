import { createClient } from '@supabase/supabase-js'

async function inspect() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profileColumns, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)

    const { data: legacyTasks, error: taskError } = await supabase
        .from('Tasks')
        .select('*')
        .limit(1)

    console.log('\n--- Tasks SAMPLE ---')
    console.log(legacyTasks ? Object.keys(legacyTasks[0]) : 'No data or error')
    if (legacyTasks) console.log(legacyTasks[0])
    if (taskError) console.error(taskError)
}

inspect()
