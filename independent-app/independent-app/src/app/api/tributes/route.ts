import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET() {
    try {

        // Primary source of truth is the 'Wishlist' table (uppercase)
        let { data: tributes, error } = await supabase
            .from('Wishlist')
            .select('*')
            .order('Price', { ascending: true });

        // Fallback ONLY if uppercase 'Wishlist' is missing or fails
        if (error || !tributes) {
            console.log("[API/Tributes] Uppercase Wishlist failing, trying lowercase wishlist fallback");
            const fallbackRes = await supabase
                .from('wishlist')
                .select('*')
                .order('price', { ascending: true });

            if (fallbackRes.error) {
                console.error("Supabase Wishlist fetch error:", fallbackRes.error);
                return NextResponse.json({ success: false, error: fallbackRes.error.message }, { status: 500 });
            }
            tributes = fallbackRes.data;
        }

        console.log(`[API/Tributes] Successfully pulled ${tributes?.length || 0} rows from Supabase.`);

        // Format Image urls if they use the wix format
        const formattedTributes = await Promise.all((tributes || []).map(async (tribute: any) => {
            let imageUrl = tribute.Image || tribute.image_url || "";
            if (imageUrl.startsWith('wix:image://v1/')) {
                const wixId = imageUrl.split('/')[3].split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${wixId}`;
            }

            let topContributorName = null;
            const tributeId = tribute.id ?? tribute._id ?? tribute.Title;

            if (tribute.is_crowdfund) {
                const { data: topContrData } = await supabase
                    .from('crowdfund_contributions')
                    .select('member_id, amount_given')
                    .eq('tribute_id', tributeId.toString())
                    .order('amount_given', { ascending: false })
                    .limit(1)
                    .single();

                if (topContrData && topContrData.member_id) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('name')
                        .eq('member_id', topContrData.member_id)
                        .single();

                    topContributorName = profileData?.name || topContrData.member_id.split('@')[0];
                }
            }

            return {
                id: tributeId,
                title: tribute.Title || tribute.title,
                price: parseInt(tribute.Price || tribute.price) || 0,
                image: imageUrl,
                category: tribute.Category || tribute.category,
                is_crowdfund: tribute.is_crowdfund || tribute.Is_Crowdfund || false,
                goal_amount: parseInt(tribute.goal_amount ?? tribute.Goal_Amount ?? 0),
                raised_amount: parseInt(tribute.raised_amount ?? tribute.Raised_Amount ?? 0),
                top_contributor: topContributorName
            };
        }));

        // ── Last Tribute: most recent wishlist message from chats ──────────────
        let lastTribute = null;
        try {
            const { data: lastMsg } = await supabase
                .from('chats')
                .select('member_id, metadata, created_at')
                .eq('type', 'wishlist')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (lastMsg?.metadata) {
                const meta = lastMsg.metadata as any;
                const { data: senderProfile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('member_id', lastMsg.member_id)
                    .single();

                const senderName = (senderProfile as any)?.name
                    || (lastMsg.member_id as string)?.split('@')[0]?.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                    || 'Unknown';

                lastTribute = {
                    title: meta.title || '',
                    price: meta.price || 0,
                    senderName,
                    at: lastMsg.created_at
                };
            }
        } catch (ltErr) {
            console.warn('[API/Tributes] Could not fetch last tribute:', ltErr);
        }

        return NextResponse.json(
            { success: true, tributes: formattedTributes, lastTribute },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );

    } catch (err: any) {
        console.error("Tributes API threw an error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
