"use client";

import { useEffect } from 'react';

export default function HomePage() {
    useEffect(() => {
        document.body.classList.add('home-page');
        return () => { document.body.classList.remove('home-page'); };
    }, []);

    return (
        <>
            <style jsx global>{`
                body.home-page {
                    background-color: transparent !important;
                    background-image: none !important;
                }
            `}</style>
            <iframe
                src="/landing.html"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    zIndex: 99999,
                }}
            />
        </>
    );
}
