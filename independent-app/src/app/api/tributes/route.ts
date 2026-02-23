import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET() {
    try {

        let { data: tributes, error } = await supabase
            .from('wishlist')
            .select('*')
            .order('price', { ascending: true }); // standard postgres lowercase

        if (error) {
            console.log("[API/Tributes] lowercase wishlist failing, trying Velo fallback Wishlist");
            const fallback = await supabase
                .from('Wishlist')
                .select('*')
                .order('Price', { ascending: true });

            tributes = fallback.data;
            if (fallback.error) {
                console.error("Supabase Wishlist fetch error:", fallback.error);
                return NextResponse.json({ success: false, error: fallback.error.message }, { status: 500 });
            }
        }

        // Format Image urls if they use the wix format
        const formattedTributes = (tributes || []).map((tribute: any) => {
            let imageUrl = tribute.Image || tribute.image_url || "";
            if (imageUrl.startsWith('wix:image://v1/')) {
                // Extracts the media ID
                const wixId = imageUrl.split('/')[3].split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${wixId}`;
            }

            return {
                id: tribute.id || tribute._id || tribute.Title, // Fallback if no specific ID column exists
                title: tribute.Title || tribute.title,
                price: parseInt(tribute.Price || tribute.price) || 0,
                image: imageUrl,
                category: tribute.Category || tribute.category
            };
        });

        return NextResponse.json({ success: true, tributes: formattedTributes });

    } catch (err: any) {
        console.error("Tributes API threw an error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
