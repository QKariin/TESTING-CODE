import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log("Fetching global messages...");
    try {
        const { data, error } = await supabaseAdmin
            .from('global_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error("Supabase Error:", error);
            return;
        }

        console.log("Fetched", data?.length, "messages.");
        
        const QUEEN_EMAILS = ['ceo@qkarin.com'];
        const safe = (data || []).map(({ sender_email, ...rest }: any) => ({
            ...rest,
            is_queen: QUEEN_EMAILS.includes((sender_email || '').toLowerCase()),
        }));

        console.log("Mapped safely. First message:", safe[0]);
    } catch (e) {
        console.error("Crash during GET execution:", e);
    }
}
run();
