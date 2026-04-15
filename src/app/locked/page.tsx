'use client';

import { useEffect, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';

function LockedContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reason = searchParams.get('reason') || '';

    useEffect(() => {
        const supabase = createClient();
        let channel: any = null;

        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            const emailLower = (user.email || '').toLowerCase();

            // Subscribe to profile changes - fires instantly when admin removes silence
            channel = supabase
                .channel('locked-silence-watch-' + emailLower)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
                    const fresh = payload.new;
                    if (!fresh) return;
                    if ((fresh.member_id || '').toLowerCase() !== emailLower) return;
                    if (fresh.silence !== true) router.push('/profile');
                })
                .subscribe();
        }

        init();
        return () => { if (channel) supabase.removeChannel(channel); };
    }, []);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(8,2,2,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box',
            fontFamily: 'Cinzel, serif',
        }}>
            <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <svg viewBox="0 0 24 24" width="52" height="52" fill="rgba(220,60,60,0.7)">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
                    </svg>
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(220,60,60,0.6)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>
                    ACCESS REVOKED
                </div>
                <div style={{ background: 'rgba(220,60,60,0.04)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 14, padding: '28px 24px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(220,60,60,0.4)', letterSpacing: '3px', marginBottom: 12, textTransform: 'uppercase' }}>
                        Message from Queen Karin
                    </div>
                    <div style={{ fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px' }}>
                        {reason}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LockedPage() {
    return (
        <Suspense fallback={
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(8,2,2,0.97)' }} />
        }>
            <LockedContent />
        </Suspense>
    );
}
