import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('Wishlist')
        .select('*')
        .order('Price', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { title, price, imageUrl, category, is_crowdfund, goal_amount } = body;
    if (!title || price === undefined) {
        return NextResponse.json({ error: 'Title and price are required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
        .from('Wishlist')
        .insert({
            Title: title,
            Price: price,
            Image: imageUrl || '',
            Category: category || '',
            is_crowdfund: is_crowdfund || false,
            goal_amount: goal_amount || 0,
            raised_amount: 0,
        })
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data });
}

export async function PUT(req: Request) {
    const body = await req.json();
    const { id, title, price, imageUrl, category, is_crowdfund, goal_amount } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updates: any = {};
    if (title !== undefined) updates.Title = title;
    if (imageUrl !== undefined) updates.Image = imageUrl;
    if (category !== undefined) updates.Category = category;
    if (is_crowdfund !== undefined) updates.is_crowdfund = is_crowdfund;
    if (is_crowdfund) {
        // For crowdfund items, goal_amount IS the price
        if (goal_amount !== undefined) { updates.goal_amount = goal_amount; updates.Price = goal_amount; }
    } else {
        if (price !== undefined) updates.Price = price;
    }

    let { data, error } = await supabaseAdmin.from('Wishlist').update(updates).eq('ID', id).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fallback: some rows have NULL ID - match by Title instead
    if (!data || data.length === 0) {
        const result = await supabaseAdmin.from('Wishlist').update(updates).eq('Title', id).select();
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        data = result.data;
    }

    if (!data || data.length === 0) return NextResponse.json({ error: `Item not found` }, { status: 404 });
    return NextResponse.json({ success: true, item: data[0] });
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    let { error } = await supabaseAdmin.from('Wishlist').delete().eq('ID', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Fallback for rows with NULL ID
    const { error: err2 } = await supabaseAdmin.from('Wishlist').delete().eq('Title', id);
    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
