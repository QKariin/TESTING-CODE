'use client';
import { useEffect, useRef, useState } from 'react';

interface FaqFooterProps {
    onNavClick?: (section: string) => void;
    onUnlock?: () => void;
    hideOnDesktop?: boolean;
}

function showAccessDenied(section: string, onUnlock?: () => void) {
    const existing = document.getElementById('accessDeniedOverlay') as HTMLElement | null;
    // If same section is already open, toggle off
    if (existing && existing.dataset.section === section) { existing.remove(); return; }
    // If different section is open, remove it first
    if (existing) existing.remove();
    const label = section || 'this section';
    const overlay = document.createElement('div');
    overlay.id = 'accessDeniedOverlay';
    overlay.dataset.section = section;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(60px + env(safe-area-inset-bottom));z-index:9999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
    overlay.innerHTML = '<div style="text-align:center;padding:40px 30px;max-width:320px;">' +
        '<div style="font-family:Cinzel,serif;font-size:0.5rem;color:rgba(197,160,89,0.5);letter-spacing:4px;margin-bottom:16px;">ACCESS DENIED</div>' +
        '<div style="font-family:Cinzel,serif;font-size:1.1rem;color:rgba(255,255,255,0.7);margin-bottom:12px;line-height:1.5;">You don\'t have access to ' + label + '</div>' +
        '<div style="font-family:Cinzel,serif;font-size:0.85rem;color:rgba(255,255,255,0.3);line-height:1.6;margin-bottom:24px;">Unlock your experience to explore everything inside.</div>' +
        '<div style="display:flex;gap:8px;">' +
            '<button id="adClose" style="flex:1;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);padding:10px 0;border-radius:8px;font-family:Cinzel,serif;font-size:0.5rem;letter-spacing:2px;cursor:pointer;">CLOSE</button>' +
            '<button id="adUnlock" style="flex:2;background:linear-gradient(135deg,#c5a059 0%,#8a6d30 100%);color:#020202;border:none;padding:10px 0;border-radius:8px;font-family:Cinzel,serif;font-size:0.5rem;font-weight:700;letter-spacing:2px;cursor:pointer;">UNLOCK</button>' +
        '</div></div>';
    overlay.querySelector('#adClose')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); });
    overlay.querySelector('#adUnlock')?.addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); if (onUnlock) onUnlock(); });
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

export default function FaqFooter({ onNavClick, onUnlock, hideOnDesktop }: FaqFooterProps) {
    const [faqOpen, setFaqOpen] = useState(false);
    const [notifVisible, setNotifVisible] = useState(false);
    const onNavClickRef = useRef(onNavClick);
    const onUnlockRef = useRef(onUnlock);
    onNavClickRef.current = onNavClick;
    onUnlockRef.current = onUnlock;

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (!e.data || typeof e.data.type !== 'string') return;
            switch (e.data.type) {
                case 'navClick':
                    if (onNavClickRef.current) {
                        onNavClickRef.current(e.data.section);
                    } else {
                        showAccessDenied(e.data.section, onUnlockRef.current);
                    }
                    break;
                case 'faqOpen':
                    setFaqOpen(true);
                    break;
                case 'faqClose':
                    setTimeout(() => setFaqOpen(false), 400);
                    break;
                case 'notifShow':
                    setNotifVisible(true);
                    break;
                case 'notifHide':
                    setNotifVisible(false);
                    break;
                case 'dismissAccessDenied': {
                    const el = document.getElementById('accessDeniedOverlay');
                    if (el) el.remove();
                    break;
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <>
            {hideOnDesktop && (
                <style>{`@media (min-width: 769px) { #footer-faq-frame { display: none !important; } }`}</style>
            )}
            <iframe
                id="footer-faq-frame"
                src="/footer-faq.html?v=6"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: faqOpen ? '100%' : notifVisible ? 'calc(220px + env(safe-area-inset-bottom))' : 'calc(140px + env(safe-area-inset-bottom))',
                    top: faqOpen ? 0 : 'auto',
                    border: 'none',
                    zIndex: 9999999,
                    background: 'transparent',
                    colorScheme: 'dark',
                    pointerEvents: faqOpen ? 'auto' : undefined,
                }}
            />
        </>
    );
}
