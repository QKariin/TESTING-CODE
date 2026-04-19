import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
    femdom: 'FEMDOM',
    regularlife: 'DAILY LIFE',
    feet: 'FEET',
};

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('media_vault')
            .select('id, media_url, media_type, thumbnail_url, category, price, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const items = data || [];
        const grouped: Record<string, typeof items> = {};
        for (const item of items) {
            const cat = item.category || 'uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        }

        const albums = Object.entries(grouped).map(([category, catItems]) => ({
            category,
            label: CATEGORY_LABELS[category] || category.toUpperCase(),
            count: catItems.length,
            coverUrl: catItems[0]?.thumbnail_url || catItems[0]?.media_url || '',
            items: catItems,
        }));

        return NextResponse.json({ albums });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
