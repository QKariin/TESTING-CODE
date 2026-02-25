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

        console.log(`[API/Tributes] Successfully pulled ${tributes?.length || 0} rows from Supabase.`);
        if (tributes && tributes.length > 0) {
            console.log(`[API/Tributes] Sample Row 0 Structure:`, JSON.stringify(tributes[0], null, 2));
        }

        // Format Image urls if they use the wix format
        const formattedTributes = await Promise.all((tributes || []).map(async (tribute: any) => {
            let imageUrl = tribute.Image || tribute.image_url || "";
            if (imageUrl.startsWith('wix:image://v1/')) {
                // Extracts the media ID
                const wixId = imageUrl.split('/')[3].split('~')[0];
                imageUrl = `https://static.wixstatic.com/media/${wixId}`;
            }

            let topContributorName = null;
            const tributeId = tribute.id || tribute._id || tribute.Title;

            if (tribute.is_crowdfund) {
                // 1. Find member with max amount_given for this tribute
                const { data: topContrData } = await supabase
                    .from('crowdfund_contributions')
                    .select('member_id, amount_given')
                    .eq('tribute_id', tributeId.toString())
                    .order('amount_given', { ascending: false })
                    .limit(1)
                    .single();

                if (topContrData && topContrData.member_id) {
                    // 2. Fetch their username
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('name')
                        .eq('member_id', topContrData.member_id)
                        .single();

                    topContributorName = profileData?.name || topContrData.member_id.split('@')[0];
                }
            }

            return {
                id: tributeId, // Fallback if no specific ID column exists
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

        return NextResponse.json({ success: true, tributes: formattedTributes });

    } catch (err: any) {
        console.error("Tributes API threw an error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
