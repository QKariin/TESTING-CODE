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
            {/* SEO content — invisible to users, crawlable by Google */}
            <main aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                <header>
                    <h1>Queen Karin — Femdom, Findom &amp; Female Domination</h1>
                    <p>No agencies. No bots. No fakes.</p>
                    <a href="/login">Join Now</a>
                </header>

                <section>
                    <h2>The Sovereign — Queen Karin</h2>
                    <p>Three years building what no platform dared to create. Not a profile on someone else&apos;s site. Not a clip store. A private world with its own economy, its own hierarchy, and one absolute ruler.</p>
                    <p>I don&apos;t audition. I don&apos;t negotiate. I don&apos;t convince. I open doors, and I close them just as easily.</p>
                </section>

                <section>
                    <h2>Services — What Happens Inside</h2>

                    <article>
                        <h3>Keyholding &amp; Chastity Control</h3>
                        <p>Your lock. Her rules. Daily check-ins, real-time control, strict accountability. Not a game, a commitment.</p>
                        <a href="/keyholder">Surrender Key</a>
                    </article>

                    <article>
                        <h3>Financial Domination</h3>
                        <p>Tribute isn&apos;t a transaction. It&apos;s proof of devotion. An economy built on worship, not negotiation.</p>
                    </article>

                    <article>
                        <h3>Task Training &amp; Obedience</h3>
                        <p>Daily assignments. Photo proof. Deadlines. Real consequences. A structured system of obedience with merit and punishment.</p>
                    </article>

                    <article>
                        <h3>Sissification &amp; Guided Transformation</h3>
                        <p>Guided transformation under absolute authority. Wardrobe. Behavior. Identity. Nothing is optional.</p>
                    </article>

                    <article>
                        <h3>Online Domination</h3>
                        <p>Real-time control from anywhere. Not a fantasy you browse, a lifestyle you live under Her command.</p>
                    </article>
                </section>

                <section>
                    <h2>Testimonials — From Those Who Knelt</h2>
                    <p>Real reviews from verified members of Queen Karin&apos;s household.</p>
                </section>

                <section>
                    <h2>The Hierarchy — Leaderboard</h2>
                    <p>Your place is earned. Rise through the ranks by proving your devotion through tasks, tributes, and obedience.</p>
                </section>

                <footer>
                    <p>Queen Karin — Real femdom, real control. Apply to serve or stay locked out.</p>
                    <a href="/apply">Apply to Serve</a>
                    <a href="/login">Sign In</a>
                    <a href="/keyholder">Keyholder Sessions</a>
                </footer>
            </main>
        </>
    );
}
