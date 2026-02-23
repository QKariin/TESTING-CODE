import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: tributes, error } = await supabase
            .from('Wishlist')
            .select('*')
            .order('Price', { ascending: true }); // Ensure capitalization matches DB

        if (error) {
            console.error("Supabase Wishlist fetch error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Format Image urls if they use the wix format
        const formattedTributes = (tributes || []).map((tribute: any) => {
            let imageUrl = tribute.Image || "";
            if (imageUrl.startsWith('wix:image://v1/')) {
                // Extracts the media ID
                const wixId = imageUrl.split('/')[3].split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${wixId}`;
            }

            return {
                id: tribute.id || tribute.Title, // Fallback if no specific ID column exists
                title: tribute.Title,
                price: parseInt(tribute.Price) || 0,
                image: imageUrl,
                category: tribute.Category
            };
        });

        return NextResponse.json({ success: true, tributes: formattedTributes });

    } catch (err: any) {
        console.error("Tributes API threw an error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
