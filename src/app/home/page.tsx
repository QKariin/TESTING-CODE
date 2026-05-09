"use client";

import { useEffect, useRef } from 'react';

export default function HomePage() {
    const gateRef = useRef<HTMLDivElement>(null);
    const fillRef = useRef<HTMLDivElement>(null);
    const mountRef = useRef<HTMLElement>(null);
    const progressRef = useRef(0);
    const holdingRef = useRef(false);
    const frameRef = useRef<number>(0);
    const resistanceRef = useRef(1.0);

    useEffect(() => {
        document.body.classList.add('locked');

        /* --- KNEEL HOLD LOGIC --- */
        const btn = document.getElementById('kneelBtn')!;
        const fill = fillRef.current!;
        const gate = gateRef.current!;

        function tick() {
            if (holdingRef.current && progressRef.current < 100) {
                progressRef.current += resistanceRef.current;
                fill.style.width = progressRef.current + '%';
                if (progressRef.current >= 100) {
                    gate.style.opacity = '0';
                    setTimeout(() => { gate.style.visibility = 'hidden'; }, 300);
                    window.scrollTo(0, 0);
                    document.body.classList.remove('locked');
                } else {
                    frameRef.current = requestAnimationFrame(tick);
                }
            }
        }

        function startHolding(e: Event) {
            if ((e as TouchEvent).cancelable) e.preventDefault();
            holdingRef.current = true;
            resistanceRef.current = Math.random() * (1.66 - 0.33) + 0.33;
            tick();
        }

        function stopHolding() {
            holdingRef.current = false;
            progressRef.current = 0;
            fill.style.width = '0%';
            cancelAnimationFrame(frameRef.current);
        }

        btn.addEventListener('mousedown', startHolding);
        window.addEventListener('mouseup', stopHolding);
        btn.addEventListener('touchstart', startHolding);
        window.addEventListener('touchend', stopHolding);

        /* --- SCROLL LOGIC --- */
        function onScroll() {
            if (window.scrollY > 50) document.body.classList.add('scrolled');
            else document.body.classList.remove('scrolled');

            const mnt = mountRef.current;
            if (!mnt) return;
            const rect = mnt.getBoundingClientRect();
            const totalDist = mnt.offsetHeight - window.innerHeight;
            const prog = -rect.top / totalDist;

            const stages = Array.from({ length: 7 }, (_, i) => document.getElementById(`stage${i + 1}`));
            const bots = Array.from({ length: 4 }, (_, i) => document.getElementById(`bot${i + 1}`));

            const activateStage = (index: number) => {
                stages.forEach((s, i) => {
                    if (!s) return;
                    if (i === index) { s.classList.add('active-stage'); s.classList.remove('exit-stage'); }
                    else if (i < index) { s.classList.add('exit-stage'); s.classList.remove('active-stage'); }
                    else { s.classList.remove('active-stage', 'exit-stage'); }
                });
                bots.forEach((b, i) => {
                    if (!b) return;
                    if (i === index) b.classList.add('lit');
                    else b.classList.remove('lit');
                });
            };

            if (prog >= -0.60 && prog < 0.14) activateStage(0);
            else if (prog < -0.60) {
                stages.forEach(s => s?.classList.remove('active-stage', 'exit-stage'));
                bots.forEach(b => b?.classList.remove('lit'));
            }
            else if (prog >= 0.14 && prog < 0.28) activateStage(1);
            else if (prog >= 0.28 && prog < 0.42) activateStage(2);
            else if (prog >= 0.42 && prog < 0.56) activateStage(3);
            else if (prog >= 0.56 && prog < 0.70) activateStage(4);
            else if (prog >= 0.70 && prog < 0.84) activateStage(5);
            else if (prog >= 0.84) activateStage(6);
        }

        window.addEventListener('scroll', onScroll);

        /* --- CONTENT FADE IN --- */
        const focusObs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sharp'); });
        }, { threshold: 0.1 });
        document.querySelectorAll('.glass-box').forEach(b => focusObs.observe(b));

        return () => {
            btn.removeEventListener('mousedown', startHolding);
            window.removeEventListener('mouseup', stopHolding);
            btn.removeEventListener('touchstart', startHolding);
            window.removeEventListener('touchend', stopHolding);
            window.removeEventListener('scroll', onScroll);
            document.body.classList.remove('locked', 'scrolled');
            focusObs.disconnect();
        };
    }, []);

    return (
        <>
            <style jsx global>{`
                @font-face { font-family: 'Cinzel'; src: url('/fonts/Cinzel-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
                @font-face { font-family: 'Inter'; src: url('/fonts/Inter_18pt-Light.woff2') format('woff2'); font-weight: 300; font-display: swap; }
                @font-face { font-family: 'Inter'; src: url('/fonts/Inter_18pt-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
                @font-face { font-family: 'Italianno'; src: url('/fonts/Italianno-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }

                :root {
                    --gold: #c5a059;
                    --gold-dim: rgba(197, 160, 89, 0.4);
                    --bg-dark: #08080a;
                    --glass-bg: rgba(15, 15, 18, 0.7);
                    --glass-border: rgba(197, 160, 89, 0.2);
                    --blur: blur(25px) saturate(180%);
                    --transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
                }

                * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
                html { width: 100%; }
                body { width: 100%; min-height: 100vh; overflow-x: hidden; background-color: transparent !important; color: #fff; font-family: 'Cinzel', serif; line-height: 1.6; text-align: center; }
                body.locked { overflow: hidden !important; height: 100vh !important; }

                #loader-gate {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.15);
                    backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                    z-index: 20000; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 35vh; align-items: center;
                    transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
                }

                .kneel-wrapper {
                    position: relative; width: 280px; height: 60px; cursor: pointer; overflow: hidden;
                    background: transparent !important;
                    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                    border: 1px solid var(--glass-border);
                    box-shadow: none !important;
                    transition: transform 0.2s ease;
                }
                .kneel-fill { position: absolute; top: 0; left: 0; bottom: 0; width: 0%; background: linear-gradient(90deg, #000000 0%, var(--gold) 50%, #000000 100%); z-index: 1; transition: width 0.1s linear; }
                .kneel-text { position: relative; z-index: 2; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; font-family: 'Cinzel', serif; color: var(--gold); font-size: 14px; letter-spacing: 4px; font-weight: 700; pointer-events: none; }

                .btn-slave {
                    margin-top: 25px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #555; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 3px;
                    padding: 10px 25px; text-decoration: none; transition: all 0.3s ease; text-transform: uppercase;
                }
                .btn-slave:hover { color: var(--gold); border-color: var(--gold); background: rgba(197, 160, 89, 0.05); }

                .fixed-shelf {
                    position: fixed; top: 0; left: 0; right: 0; width: auto;
                    height: 100vh; z-index: 10000;
                    display: flex; align-items: flex-start; justify-content: center; padding-top: 10vh;
                    background: rgba(5, 5, 6, 0.6);
                    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    transition: var(--transition);
                }
                .header-inner { display: flex; flex-direction: column; align-items: center; transition: var(--transition); width: 100%; }
                .welcome { font-family: 'Cinzel', serif; font-weight: 400; font-size: 11px; letter-spacing: 8px; color: #777; text-transform: uppercase; margin-bottom: 10px; }
                .royal-brand { font-family: 'Cinzel', serif; font-weight: 700; font-size: clamp(2rem, 8vw, 80px); letter-spacing: 15px; color: var(--gold); text-transform: uppercase; line-height: 1; transition: var(--transition); }
                .mix-box { display: flex; align-items: baseline; justify-content: center; margin-top: -10px; transition: var(--transition); white-space: nowrap; }
                .s-kink { font-family: 'Italianno', cursive; font-size: clamp(4rem, 15vw, 9rem); color: #fff; text-shadow: 0 0 30px rgba(197, 160, 89, 0.2); }
                .s-dom { font-family: 'Cinzel', serif; font-weight: 400; font-size: clamp(1rem, 4vw, 2.2rem); color: #fff; opacity: 0.6; margin-left: 10px; letter-spacing: 4px; }
                .tiny-seal { padding: 15px 0; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); width: 300px; margin-top: 25px; }
                .tiny-seal h2 { font-family: 'Cinzel'; font-size: 9px; letter-spacing: 5px; color: var(--gold); opacity: 0.8; }
                .btn-join { background: rgba(197, 160, 89, 0.05); border: 1px solid var(--gold); color: var(--gold); padding: 16px 70px; font-family: 'Cinzel'; font-weight: 700; text-transform: uppercase; letter-spacing: 8px; font-size: 16px; text-decoration: none; margin-top: 25px; transition: 0.4s ease; white-space: nowrap; cursor: pointer; }

                body.scrolled .fixed-shelf { height: 90px !important; padding-top: 0 !important; align-items: center !important; background: var(--glass-bg) !important; backdrop-filter: var(--blur) !important; -webkit-backdrop-filter: var(--blur) !important; border-bottom: 1px solid var(--glass-border); }
                body.scrolled .header-inner { flex-direction: row !important; display: flex !important; justify-content: space-between !important; padding: 0 5% !important; }
                body.scrolled .welcome, body.scrolled .tiny-seal { display: none !important; }
                body.scrolled .royal-brand { width: 25% !important; font-size: 14px !important; letter-spacing: 4px !important; color: #fff !important; text-align: center !important; white-space: nowrap !important; margin: 0 !important; }
                body.scrolled .mix-box { width: 50% !important; transform: scale(0.6) !important; margin: 0 !important; display: flex !important; justify-content: center !important; white-space: nowrap !important; }
                body.scrolled .btn-join { width: 25% !important; margin-top: 0 !important; padding: 10px 0 !important; font-size: 11px !important; text-align: center !important; background: transparent !important; white-space: nowrap !important; }

                .ladder-region { height: 500vh; width: 100%; position: relative; margin-top: 50vh; }
                .ladder-sticky { position: sticky; top: 0; width: 100%; height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding-top: 35vh; }
                .bloom-area { position: relative; width: 100%; height: 200px; display: flex; justify-content: center; }
                .stage-wrap { position: absolute; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 15px; transition: opacity 0.3s ease-out; opacity: 0; pointer-events: none; }
                .stage-wrap.active-stage { opacity: 1; transform: none !important; }
                .stage-wrap.exit-stage { opacity: 0; transform: translateY(-50px); filter: blur(10px); transition: all 0.8s ease; }
                .stage-wrap[style] { width: 100% !important; max-width: 100% !important; left: 0 !important; right: 0 !important; }

                .s-line { font-family: 'Cinzel', serif !important; font-weight: 400 !important; letter-spacing: 6px; text-transform: lowercase; white-space: nowrap; transition: all 1s ease; }
                .s-top { color: var(--gold); text-shadow: 0 0 15px var(--gold-dim); font-size: 2rem; opacity: 1; }
                .s-bot { color: #444; filter: blur(8px); font-size: 1.2rem; opacity: 0; margin-top: 15px; transition: all 0.8s ease; }
                .s-bot.lit { color: #c0c0c0 !important; filter: blur(0) !important; opacity: 1 !important; text-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
                .s-final { font-weight: 400 !important; letter-spacing: 8px; text-transform: uppercase; }

                .focus-flow { max-width: 1200px; margin: 0 auto; padding: 0 20px 200px; display: flex; flex-direction: column; align-items: center; gap: 10vh; }
                .glass-box {
                    background: transparent !important;
                    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                    border: 1px solid var(--glass-border); border-radius: 2px; padding: 60px 40px;
                    width: 90% !important; max-width: 1800px !important;
                    opacity: 0; transform: scale(0.9);
                    transition: opacity 0.5s ease, transform 0.5s ease;
                    color: #fff !important; margin: -50px auto 0;
                }
                .stage-wrap.active-stage .glass-box { opacity: 1 !important; transform: scale(1) !important; }
                .glass-box h3 { font-family: 'Cinzel', serif; color: var(--gold); font-size: 1.5rem; margin-bottom: 25px; letter-spacing: 5px; font-weight: 700; }
                .glass-box p { font-family: 'Cinzel', serif !important; font-weight: 400; color: #ddd; font-size: 1.1rem; margin-bottom: 20px; line-height: 1.8; letter-spacing: 1px; }
                .glass-box.violation { border-color: rgba(200, 50, 50, 0.3); }
                .glass-box.violation h3 { color: #cc4444; }
                .nob-bullets { font-family: 'Cinzel'; font-size: 0.9rem; color: #aaa; margin-top: 20px; letter-spacing: 3px; word-spacing: 10px; }

                @media only screen and (max-width: 768px) {
                    .fixed-shelf { padding-top: 15vh !important; height: 100vh !important; align-items: flex-start !important; justify-content: center !important; background: rgba(5, 5, 6, 0.3) !important; backdrop-filter: blur(15px) !important; -webkit-backdrop-filter: blur(15px) !important; width: 100% !important; max-width: 100% !important; right: 0 !important; left: 0 !important; }
                    .header-inner { display: flex !important; flex-direction: column !important; align-items: center !important; width: 100% !important; max-width: 100% !important; }
                    .royal-brand { font-size: 30px !important; letter-spacing: 5px !important; margin-bottom: 0px !important; width: 100% !important; text-align: center !important; display: block !important; white-space: normal !important; }
                    .mix-box { transform: scale(1) !important; margin-top: -15px !important; display: flex !important; justify-content: center !important; position: relative !important; top: -15px !important; max-width: 100% !important; }
                    .btn-join { display: block !important; margin-top: 100px !important; width: 85% !important; padding: 14px 0 !important; font-size: 13px !important; }

                    body.scrolled .fixed-shelf { height: 70px !important; padding: 0 !important; background: rgba(15, 15, 18, 0.98) !important; backdrop-filter: blur(25px) saturate(180%) !important; -webkit-backdrop-filter: blur(25px) saturate(180%) !important; align-items: center !important; }
                    body.scrolled .header-inner { padding-top: 0 !important; flex-direction: column !important; align-items: flex-start !important; justify-content: center !important; padding-left: 20px !important; width: 100% !important; height: 100% !important; position: relative !important; }
                    body.scrolled .royal-brand { font-size: 14px !important; letter-spacing: 2px !important; width: auto !important; text-align: left !important; margin: 0 !important; line-height: 1 !important; }
                    body.scrolled .mix-box { transform: scale(0.7) !important; transform-origin: left center !important; margin: 2px 0 0 0 !important; width: auto !important; justify-content: flex-start !important; z-index: 2 !important; }
                    body.scrolled .s-kink { font-size: 30px !important; }
                    body.scrolled .s-dom { font-size: 10px !important; }
                    body.scrolled .btn-join { position: absolute !important; right: 10px !important; top: 50% !important; transform: translateY(-50%) !important; margin: 0 !important; width: auto !important; padding: 6px 10px !important; font-size: 10px !important; border-color: var(--gold-dim) !important; background: transparent !important; }

                    .ladder-sticky { padding-top: 35vh !important; align-items: flex-start !important; }
                    .s-top { font-size: 20px !important; }
                    .s-bot { font-size: 14px !important; }
                    .focus-flow { gap: 5vh !important; width: 100% !important; overflow-x: hidden !important; }
                    .glass-box { padding: 30px 10px !important; -webkit-backdrop-filter: blur(10px) !important; backdrop-filter: blur(10px) !important; background: transparent !important; width: 92% !important; max-width: 95vw !important; margin: -25px auto 0 !important; }
                    .glass-box h3 { font-size: 16px !important; margin-bottom: 15px !important; letter-spacing: 3px !important; }
                    .glass-box p { font-size: 11px !important; line-height: 1.5 !important; margin-bottom: 12px !important; }
                    .nob-bullets { font-size: 10px !important; word-spacing: 5px !important; }
                }
            `}</style>

            <div id="loader-gate" ref={gateRef}>
                <div className="kneel-wrapper" id="kneelBtn">
                    <div className="kneel-text">KNEEL TO ENTER</div>
                    <div className="kneel-fill" ref={fillRef}></div>
                </div>
                <a href="https://throne.qkarin.com/" className="btn-slave">ALREADY A SLAVE</a>
            </div>

            <header className="fixed-shelf" id="cmd">
                <div className="header-inner">
                    <div className="welcome">WELCOME TO</div>
                    <h1 className="royal-brand">Queen Karin&apos;s</h1>
                    <div className="mix-box">
                        <span className="s-kink">Kink</span>
                        <span className="s-dom">-dom</span>
                    </div>
                    <div className="tiny-seal">
                        <h2>NO AGENCIES &bull; NO BOTS &bull; NO FAKES</h2>
                    </div>
                    <a href="https://www.qkarin.com/submit-qk" className="btn-join">JOIN NOW</a>
                </div>
            </header>

            <main className="content-flow">
                <section className="ladder-region" id="mountL" ref={mountRef as any}>
                    <div className="ladder-sticky">
                        <div className="bloom-area">
                            <div className="stage-wrap" id="stage1">
                                <div className="s-line s-top">from curiosity</div>
                                <div className="s-line s-bot" id="bot1">...to craving</div>
                            </div>
                            <div className="stage-wrap" id="stage2">
                                <div className="s-line s-top">from craving</div>
                                <div className="s-line s-bot" id="bot2">...to dependence</div>
                            </div>
                            <div className="stage-wrap" id="stage3">
                                <div className="s-line s-top">from dependence</div>
                                <div className="s-line s-bot" id="bot3">...to devotion</div>
                            </div>
                            <div className="stage-wrap" id="stage4">
                                <div className="s-line s-top">from devotion</div>
                                <div className="s-line s-bot s-final" id="bot4">total ownership</div>
                            </div>
                            <div className="stage-wrap" id="stage5">
                                <article className="glass-box">
                                    <h3>ARCHITECTURE</h3>
                                    <p>This is a private FemDom page, not a marketplace.</p>
                                    <p>You are not browsing a catalog, and I am not an &quot;option&quot; on a list.</p>
                                    <p>You are here because you crave true power. I have spent three years perfecting this space, turning discipline into an art form. In this world, you prove your worth to me - not the other way around.</p>
                                </article>
                            </div>
                            <div className="stage-wrap" id="stage6">
                                <article className="glass-box">
                                    <h3>FEMDOM POLICY</h3>
                                    <p>Most sites are built to protect the &quot;buyer&quot; and Dommes became the actual clowns in their own game.</p>
                                    <p>Here you are stepping into a cold silence and a total darkness that scares you. There is no menu at the front door and you are not used to this lack of control.</p>
                                    <p>That fear? It is the only honest thing about you right now.</p>
                                </article>
                            </div>
                            <div className="stage-wrap" id="stage7">
                                <article className="glass-box violation">
                                    <h3>YOUR RIGHTS</h3>
                                    <p>In my world, you have no votes and no leverage. However, I grant you exactly one right: The right to leave.</p>
                                    <p>You may execute this right at any time, for any reason.</p>
                                </article>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}
