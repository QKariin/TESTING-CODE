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

    const { data, error } = await supabaseAdmin
        .from('Wishlist')
        .update(updates)
        .eq('ID', id)
        .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: `No row matched ID="${id}" — check column name or value` }, { status: 404 });
    return NextResponse.json({ success: true, item: data[0] });
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await supabaseAdmin.from('Wishlist').delete().eq('ID', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
