import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get('filePath');

        if (!filePath) {
            return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
        }

        // 1. Get Keys from Env
        const hmacKey = process.env.BYTESCALE_HMAC_KEY_ADMIN;
        const apiKeyId = process.env.BYTESCALE_API_KEY_ID_ADMIN;

        if (!hmacKey || !apiKeyId) {
            console.warn("[Bytescale Sign] Missing keys:", {
                hasHmac: !!hmacKey,
                hasApiKeyId: !!apiKeyId
            });
            // Fallback to original path if signing is impossible
            return NextResponse.json(filePath);
        }

        // 2. Parse URL if it's a full URL
        let urlObj: URL;
        try {
            urlObj = new URL(filePath);
        } catch (e) {
            // Assume it's already a relative path or partial URL
            return NextResponse.json(filePath);
        }

        // 3. Build the signable string (remove scheme)
        // Format: upcdn.io/kW2K8hR/raw/path/to/file?exp=...
        const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        urlObj.searchParams.set('exp', expiry.toString());

        const signable = urlObj.href.replace(/^https?:\/\//, '');

        // 4. Generate HMAC-SHA256
        const hmac = crypto.createHmac('sha256', hmacKey);
        hmac.update(signable);
        const signature = hmac.digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''); // Base64Url encode

        // 5. Append sig=1.<apiKeyId>.<signature>
        urlObj.searchParams.set('sig', `1.${apiKeyId}.${signature}`);

        return NextResponse.json(urlObj.href);

    } catch (error: any) {
        console.error("Bytescale Sign Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
