import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const fallbackTributes = [
            { title: "Coffee", price: 100, image_url: "https://static.wixstatic.com/media/ce3e5b_fc21c33f2c5d4fbba210b37cdbf6c8b9~mv2.jpg" },
            { title: "Lunch", price: 500, image_url: "https://static.wixstatic.com/media/ce3e5b_0493aeec02b74075af347ddbac9101f3~mv2.jpg" },
            { title: "Nails", price: 1500, image_url: "https://static.wixstatic.com/media/ce3e5b_40d4fbb1cbed40fbaa1cc9af15b54203~mv2.jpg" },
            { title: "Hair", price: 3000, image_url: "https://static.wixstatic.com/media/ce3e5b_f49b14068bd34a50ba836bfa57161836~mv2.jpg" },
            { title: "Shopping", price: 5000, image_url: "https://static.wixstatic.com/media/ce3e5b_38407cd294714dbfbdbcd917fc9fe1ce~mv2.jpg" },
            { title: "Dinner", price: 8000, image_url: "https://static.wixstatic.com/media/ce3e5b_e92ab4d314054a7c88acc10695027581~mv2.jpg" }
        ];

        // 1. Try standard 'wishlist' schema
        let insertErr = null;
        const { error: err1 } = await supabase.from('wishlist').insert(fallbackTributes);

        // 2. Try Velo capitalized 'Wishlist' schema fallback
        if (err1) {
            console.log("Failed to insert into lowercase 'wishlist', trying 'Wishlist'.", err1.message);
            const VeloFallback = fallbackTributes.map(t => ({
                Title: t.title,
                Price: t.price,
                Image: t.image_url
            }));

            const { error: err2 } = await supabase.from('Wishlist').insert(VeloFallback);
            if (err2) {
                insertErr = err2;
            }
        }

        if (insertErr) {
            return NextResponse.json({ success: false, error: "Failed to seed either wishlist table.", details: insertErr }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "Successfully seeded your Supabase Database Wishlist with the default fallback Tributes!"
        });

    } catch (err: any) {
        console.error("Seeder API Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
