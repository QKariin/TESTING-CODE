import { createClient } from "@supabase/supabase-js";
(async () => {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const testContent = Buffer.from("test upload");
        const { data, error } = await supabase.storage.from("proofs").upload("test/test.txt", testContent, {
            contentType: "text/plain",
            upsert: true,
        });

        if (error) {
            console.error("UPLOAD ERROR (ANON KEY):", error.message);
        } else {
            console.log("UPLOAD SUCCESS (ANON KEY):", data);
        }
    } catch (e) {
        console.error("FATAL ERROR", e);
    }
})();
