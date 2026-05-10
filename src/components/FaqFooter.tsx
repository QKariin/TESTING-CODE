'use client';
import { useEffect, useRef } from 'react';

/* FAQ DATA */
const faqData = [
    {
        title: 'About Queen Karin',
        icon: '\u265B\uFE0E',
        questions: [
            { q: 'Who is Queen Karin?', a: `<p>I have been building my FemDom brand since 2022, mastering the dynamics of every type of submissive along the way.</p><p style="margin-top:10px">Currently based in Greece with my lovely dog and crazy cat. I balance a love for fine food and hard work with a passion for global travel (nearly 100 countries visited).</p><p style="margin-top:10px">I have zero tolerance for laziness, dishonesty, or fake personalities. If you are honest, we will get along; if you lie, I will call you out instantly.</p><p style="margin-top:10px">My life goal is simple: own a boat, keep my Starlink active, and manage my subs from every corner of the world.</p><p style="margin-top:10px">You can learn more about me on my other platforms:</p><div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:280px;margin-left:auto;margin-right:auto"><a href="https://x.com/qkarin_com?s=21" target="_blank" style="display:block;padding:12px 10px;background:linear-gradient(135deg,rgba(255,0,199,0.15),rgba(0,0,0,0.3));border:1px solid rgba(255,0,199,0.3);border-radius:8px;color:#ff00c7;text-decoration:none;font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:2px;text-align:center;transition:all 0.3s ease">TWITTER/X</a><a href="https://fetlife.com/QKarin" target="_blank" style="display:block;padding:12px 10px;background:linear-gradient(135deg,rgba(255,0,199,0.15),rgba(0,0,0,0.3));border:1px solid rgba(255,0,199,0.3);border-radius:8px;color:#ff00c7;text-decoration:none;font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:2px;text-align:center;transition:all 0.3s ease">FETLIFE</a><a href="https://discord.gg/RMJqt7uvNc" target="_blank" style="display:block;padding:12px 10px;background:linear-gradient(135deg,rgba(255,0,199,0.15),rgba(0,0,0,0.3));border:1px solid rgba(255,0,199,0.3);border-radius:8px;color:#ff00c7;text-decoration:none;font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:2px;text-align:center;transition:all 0.3s ease">DISCORD</a><a href="https://www.qkarin.com/blog" target="_blank" style="display:block;padding:12px 10px;background:linear-gradient(135deg,rgba(255,0,199,0.15),rgba(0,0,0,0.3));border:1px solid rgba(255,0,199,0.3);border-radius:8px;color:#ff00c7;text-decoration:none;font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:2px;text-align:center;transition:all 0.3s ease">BLOG</a></div>` },
            { q: 'Is this website run by AI?', a: `<p>No. Everything here is me. I personally review tasks, I read every message, I decide who rises and who doesn't. But I built this platform with serious technology so the kingdom can run around the clock. When you kneel at 3am, I don't need to be awake for it to count. When you finish a task, you don't wait for me to notice. The system remembers everything you do, tracks your dedication, and makes sure nothing gets lost.</p><p style="margin-top:10px">That's the whole point. The tech handles the bookkeeping so I can focus on what matters. Reading your words. Watching how you behave. Deciding what you deserve next. The system tracks you. I lead you. Don't confuse the two.</p>` },
            { q: 'How does it work?', a: `<p>Once you're inside, you get your own profile where I can see everything about you: Your rank, your merit, what tasks you completed, what you skipped. Nothing disappears here.</p><p style="margin-top:10px">You get access to over 1,000 tasks the moment you walk in. Every single one is free. I built them for those who genuinely want to serve. The ones who show up and do the work? They earn. They rise. But the ones who get lazy, who skip what I gave them, who think they can cut corners? Those ones pay.</p><p style="margin-top:10px">That's how this kingdom works.</p><p style="margin-top:10px">Devotion is rewarded.</p><p style="margin-top:10px">Disobedience has a price.</p><p style="margin-top:10px">On top of that you get challenges, a leaderboards, a real hierarchy you climb through, and for those who earn it, total ownership programs.</p><p style="margin-top:10px">This isn't a website you visit. It's a kingdom you belong to.</p>` },
            { q: 'Can I trust the testimonials?', a: `<p>Every single one. Each review comes from a member with a real profile, a real rank, and a real history inside this kingdom. You can see their merit points, how long they've served, where they stand. I don't need to fabricate proof. My subjects speak for themselves.</p><p style="margin-top:10px">If you still need more, there are reviews outside of this platform that I have no control over. I was always the person who wanted to make sure my subjects feel safe and protected under my control. See for yourself.</p><p style="margin-top:14px;text-align:center"><a href="https://disboard.org/server/reviews/1167379948173000704" target="_blank" style="display:inline-block;padding:10px 20px;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.25);border-radius:6px;color:#c5a059;text-decoration:none;font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:2px;transition:all 0.3s ease">DISBOARD REVIEWS</a></p>` },
            { q: 'What makes this different from other Femdom sites?', a: `<p>I'd love to answer this question but I can't.</p><p style="margin-top:10px">You will not find another app like this because it doesn't exist. No domme has ever built her own platform from the ground up. This isn't a page I put together on Wix with a wishlist and a cash app link.</p><p style="margin-top:10px">This is a living, breathing kingdom that runs 24 hours a day whether I'm online or not. Most people are used to settling for mediocre, lazy garbage. I am shooting for the moon and I don't settle for hitting stars.</p>` },
        ]
    },
    {
        title: 'Privacy & Safety',
        icon: '\u25C6\uFE0E',
        questions: [
            { q: 'Is my identity protected?', a: `<p>Your real name is never shown anywhere. You pick an alias when you sign up and that's all anyone ever sees. Other members don't know who you are, where you live, or what your real name is. Payments go through Stripe so I never see your card details. No one can look you up here and connect it to your real life. You're as invisible as you want to be.</p>` },
            { q: 'Where do we communicate?', a: `<p>Everything stays inside this app. I don't use Instagram DMs, Telegram, WhatsApp, or any third party platform to talk to my subjects. Your conversations never touch a server owned by Meta, Google, or anyone else. No algorithms scanning your messages, no data harvesting, no risk of your kink life showing up in an ad suggestion. What you say here stays here.</p>` },
            { q: 'What stops you from blackmailing me?', a: `<p>Nothing. That's the honest answer. If I wanted to, I could. But that's exactly why you need to pay attention to who you're giving power to. I've been building this since 2022. My name, my face, my reputation is attached to everything here. I have subjects who have been with me for years. No one is locked in. You can walk away whenever you want. And the only guarantee I offer is the one that actually matters: years of consistency, a track record you can verify yourself, and a reputation I've never had a reason to hide.</p>` },
            { q: 'Convince me this is not a scam.', a: `<p>No.</p>` },
            { q: 'Can I disappear if I need to?', a: `<p>Leaving is free. Your account, your history, your data, gone. No questions asked. I genuinely encourage you to go out there and explore. This lifestyle has a lot to offer and you should see it all.</p><p style="margin-top:10px">Now, if one day you find yourself back at my door, that's a different conversation. One I'll enjoy very much.</p>` },
        ]
    },
    {
        title: 'Payments & Costs',
        icon: '\u2666\uFE0E',
        questions: [
            { q: 'What am I paying for?', a: `<p>The entry tribute is $55. That gets you full access to the kingdom. Your profile, over 1,000 tasks, kneeling hours, the global chat, the hierarchy, everything. That alone is more than any domme has ever offered for an entry fee. Every price range will find something inside. I'm not here to ruin your bank account. But I'm not here to be used for free either. Serving costs something. How much is between you and your devotion.</p>` },
            { q: 'Who handles my payment?', a: `<p>Stripe. The same payment system used by Amazon, Google, and Shopify. I never see your card number, your bank details, or your billing address. Every transaction is encrypted. Your financial information never touches my servers.</p>` },
            { q: 'Will my wife see this on our statement?', a: `<p>The charge shows up as a discreet description. Nothing that screams femdom, nothing that raises questions. Your privacy extends to your finances.</p>` },
            { q: 'Can I get a refund?', a: `<p>No. You knew what you were doing when you knelt. A tribute isn't a transaction. It's a decision. Make sure you're ready before you make it.</p>` },
            { q: "I'm not rich. Is this for me?", a: `<p>You don't need to be. The entry fee is $55. After that, the tasks are free, the kneeling is free, the hierarchy is free. The most devoted subjects in this kingdom aren't the ones who spend the most. They're the ones who show up every day. Your wallet doesn't determine your rank here. Your discipline does.</p>` },
        ]
    },
    {
        title: "Queen's Expectations",
        icon: '\u2606\uFE0E',
        questions: [
            { q: "I'm nervous to join.", a: `<p>Good. You should be. That means you're taking it seriously. Every subject who ever knelt for me was nervous the first time. The difference between you and them is they did it anyway.</p>` },
            { q: 'Do I need experience?', a: `<p>None. Most of my subjects started with nothing but curiosity. You don't need to know the terminology, the protocols, or the "right way" to submit. I'll teach you. The only thing I need from you is honesty about where you are and willingness to learn.</p>` },
            { q: 'What do you expect from me?', a: `<p>Honesty and consistency. That's all. I don't care how experienced you are, how much money you have, or how submissive you think you are. I care if you show up when you say you will. I care if you do what I assign you. I care if you tell me the truth even when it's uncomfortable. Everything else I can work with. But if you lie to me or waste my time, you won't last here.</p>` },
            { q: 'What if I fail?', a: `<p>You will. Everyone does. I don't expect perfection, I expect you to get back up. Missing a task, slipping on your routine, falling behind on kneeling. That happens. What matters is what you do after. The subjects who grow here aren't the ones who never fail. They're the ones who fail and come back the next day anyway.</p>` },
            { q: "I don't know what kind of submissive I am.", a: `<p>That's fine. Most don't when they start. You don't need to show up with a label. Some discover they're into keyholding. Some find out they need total ownership. Some just want structure and accountability. You'll figure it out here. I've seen every type and I know how to read what you need before you do. Just walk in honest and the rest will come.</p>` },
        ]
    }
];

const pickupLines = [
    'Glad you asked.', 'Good question.', 'I get this one a lot.',
    'Let me be direct.', 'Fair question.', "I'll tell you exactly how it is.",
    'Most are afraid to ask this.', "You're smart to ask.", 'Honest answer?',
    "Here's the truth.", 'I respect the curiosity.', 'No sugarcoating.',
    'Straight answer.', 'Since you asked nicely.', "That's worth answering.",
    "I'll give you the real answer.", 'You should know this.',
    'Important question.', 'Let me break it down.', 'Pay attention.'
];

/* Exact same CSS as landing.html but with !important to override Tailwind Preflight reset.
   /home loads landing.html in an iframe (no Tailwind). React pages get Tailwind resets on all buttons. */
const FOOTER_AND_FAQ_CSS = `
@font-face {
    font-family: 'Cinzel';
    src: url('/fonts/Cinzel-Regular.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
}
.fake-nav {
    position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 9999999 !important;
    height: calc(60px + env(safe-area-inset-bottom)) !important;
    padding-bottom: env(safe-area-inset-bottom) !important;
    background: rgba(4, 4, 12, 0.96) !important;
    backdrop-filter: blur(20px) !important; -webkit-backdrop-filter: blur(20px) !important;
    border-top: 1px solid rgba(197, 160, 89, 0.18) !important;
    display: flex !important; align-items: stretch !important; justify-content: space-around !important;
}
.fake-nav-btn {
    flex: 1 !important; background: transparent !important; border: none !important;
    display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important;
    gap: 5px !important; cursor: pointer !important; padding: 0 !important;
    -webkit-tap-highlight-color: transparent;
}
.fake-nav-icon { font-size: 1.6rem !important; color: rgba(197, 160, 89, 0.35) !important; line-height: 1 !important; font-variant-emoji: text !important; }
.fake-nav-label { font-family: 'Cinzel', serif !important; font-size: 0.55rem !important; color: rgba(197, 160, 89, 0.35) !important; letter-spacing: 1.5px !important; text-transform: uppercase !important; }
.fake-nav-center {
    flex: 1 !important; background: transparent !important; border: none !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    cursor: pointer !important; padding: 0 !important; position: relative !important;
    margin-top: -30px !important; transform: translateY(14px) !important;
    -webkit-tap-highlight-color: transparent;
}
.fake-nav-avatar {
    width: 75px !important; height: 75px !important; border-radius: 50% !important;
    overflow: hidden !important; background: #000 !important; flex-shrink: 0 !important;
}
.fake-nav-avatar img { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 50% !important; }

.faq-nav-speech {
    position: absolute !important; bottom: 72px !important; left: 50% !important; transform: translateX(-50%) !important;
    background: rgba(197,160,89,0.12) !important; border: 1px solid rgba(197,160,89,0.25) !important;
    border-radius: 12px 12px 12px 4px !important; padding: 6px 14px !important;
    font-family: 'Cormorant Garamond', serif !important; font-size: 0.8rem !important;
    color: rgba(255,255,255,0.6) !important; font-style: italic !important; white-space: nowrap !important;
    animation: faqSpeechFloat 3s ease-in-out infinite !important;
    pointer-events: none !important;
}
.faq-nav-speech::after {
    content: '' !important; position: absolute !important; bottom: -6px !important; left: 50% !important; transform: translateX(-50%) !important;
    width: 0 !important; height: 0 !important;
    border-left: 6px solid transparent !important; border-right: 6px solid transparent !important;
    border-top: 6px solid rgba(197,160,89,0.25) !important;
    border-bottom: none !important;
}
@keyframes faqSpeechFloat {
    0%,100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-4px); }
}

.faq-chat-overlay,
.faq-chat-overlay * {
    text-transform: none !important;
    font-variant: normal !important;
}
.faq-chat-overlay {
    position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
    bottom: calc(60px + env(safe-area-inset-bottom)) !important;
    z-index: 99999 !important; background: #020512 !important;
    display: flex !important; flex-direction: column !important;
    transform: translateY(100%) !important;
    visibility: hidden !important;
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), visibility 0.35s !important;
}
.faq-chat-overlay.open { transform: translateY(0) !important; visibility: visible !important; }
.faq-chat-header {
    flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: space-between !important;
    padding: calc(env(safe-area-inset-top) + 20px) 20px 20px !important;
    border-bottom: 1px solid rgba(197,160,89,0.25) !important;
    border-top: 3px solid rgba(197,160,89,0.55) !important;
    border-left: none !important; border-right: none !important;
    background: #020512 !important; z-index: 2 !important;
}
.faq-chat-header-left { display: flex !important; align-items: center !important; gap: 10px !important; }
.faq-chat-header-av-wrap { position: relative !important; width: 52px !important; height: 52px !important; }
.faq-chat-header-av {
    width: 52px !important; height: 52px !important; border-radius: 50% !important; object-fit: cover !important;
    border: 1.5px solid rgba(197,160,89,0.5) !important;
}
.faq-chat-online-dot {
    position: absolute !important; bottom: 1px !important; right: 1px !important; width: 10px !important; height: 10px !important;
    background: #4ade80 !important; border-radius: 50% !important; border: 2px solid #020512 !important;
}
.faq-chat-header-info { display: flex !important; flex-direction: column !important; }
.faq-chat-header-name {
    font-family: 'Cinzel', serif !important; font-size: 0.85rem !important;
    color: #c5a059 !important; letter-spacing: 3px !important; font-weight: bold !important; line-height: 1 !important;
}
.faq-chat-header-status {
    font-family: 'Orbitron', sans-serif !important; font-size: 0.28rem !important;
    color: #4ade80 !important; letter-spacing: 2px !important; margin-top: 4px !important;
    display: flex !important; align-items: center !important; gap: 4px !important;
}
.faq-chat-header-status::before {
    content: '' !important; width: 5px !important; height: 5px !important; background: #4ade80 !important;
    border-radius: 50% !important; flex-shrink: 0 !important;
}
.faq-chat-close {
    background: none !important; border: 1px solid rgba(255,255,255,0.1) !important;
    color: rgba(255,255,255,0.4) !important; width: 32px !important; height: 32px !important;
    border-radius: 50% !important; font-size: 0.8rem !important; cursor: pointer !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    padding: 0 !important; margin: 0 !important;
}
.faq-chat-body {
    flex: 1 !important; overflow-y: auto !important; padding: 20px 12px !important;
    display: flex !important; flex-direction: column !important; gap: 6px !important;
    -webkit-overflow-scrolling: touch;
}
.faq-chat-body::-webkit-scrollbar { display: none !important; }

.faq-cb-row { display: flex !important; align-items: flex-end !important; gap: 6px !important; padding: 0 4px !important;
    animation: faqSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards !important;
}
.faq-cb-row-queen { justify-content: flex-start !important; }
.faq-cb-row-user { justify-content: flex-end !important; }
.faq-cb-av {
    width: 32px !important; height: 32px !important; border-radius: 50% !important; object-fit: cover !important;
    border: 1.5px solid rgba(197,160,89,0.35) !important; flex-shrink: 0 !important;
    align-self: flex-end !important; margin-bottom: 20px !important;
}
.faq-cb-wrap-queen { display: flex !important; flex-direction: column !important; align-items: flex-start !important; max-width: 80% !important; }
.faq-cb-wrap-user { display: flex !important; flex-direction: column !important; align-items: flex-end !important; max-width: 80% !important; }
.faq-cb-queen {
    background: #000 !important; box-shadow: 0 0 0 1px rgba(197,160,89,0.6), inset 0 0 20px rgba(197,160,89,0.04) !important;
    color: #fff !important; font-family: 'Cinzel', serif !important; font-size: 1.05rem !important; line-height: 1.55 !important;
    letter-spacing: 0.2px !important; padding: 12px 16px !important; border-radius: 16px 16px 16px 3px !important;
    word-break: break-word !important; white-space: pre-wrap !important; border: none !important;
}
.faq-cb-user {
    background: #1c1c1e !important; color: #fff !important; font-family: 'Cinzel', serif !important;
    font-size: 1.05rem !important; line-height: 1.55 !important; letter-spacing: 0.2px !important;
    padding: 12px 16px !important; border-radius: 16px 16px 3px 16px !important;
    word-break: break-word !important; cursor: pointer !important; transition: background 0.2s !important; border: none !important;
}
.faq-cb-user:active { background: #2a2a2e !important; }

.faq-cat-chips {
    display: flex !important; flex-direction: column !important; align-items: center !important;
    gap: 0 !important; padding: 4px 0 !important;
}
.faq-cat-chip {
    background: linear-gradient(135deg,rgba(255,0,199,0.15),rgba(0,0,0,0.3)) !important; border: 1px solid rgba(255,0,199,0.3) !important;
    color: #ff00c7 !important; font-family: 'Cinzel', serif !important;
    font-size: 0.95rem !important; padding: 16px 24px !important; border-radius: 20px !important; width: 80% !important; box-sizing: border-box !important; text-align: center !important;
    cursor: pointer !important; transition: all 0.2s !important; letter-spacing: 1px !important; font-variant-emoji: text !important;
    opacity: 0; animation: faqQFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
}
.faq-cat-chip:active { background: rgba(255,0,199,0.25) !important; border-color: rgba(255,0,199,0.5) !important; }

.faq-q-wrap {
    display: flex !important; flex-direction: column !important; align-items: center !important;
    gap: 0 !important; padding: 4px 0 !important;
}
.faq-q-bubble {
    background: #1c1c1e !important; border: 1px solid rgba(197,160,89,0.1) !important;
    color: rgba(255,255,255,0.7) !important; font-family: 'Cinzel', serif !important;
    font-size: 0.85rem !important; line-height: 1.5 !important; padding: 14px 24px !important;
    border-radius: 20px !important; cursor: pointer !important; transition: all 0.2s !important;
    text-align: center !important; width: 80% !important; box-sizing: border-box !important;
    opacity: 0; animation: faqQFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
}
.faq-q-bubble:active { background: rgba(197,160,89,0.1) !important; border-color: rgba(197,160,89,0.3) !important; }

.faq-a-bubble {
    background: #000 !important; box-shadow: 0 0 0 1px rgba(197,160,89,0.6), inset 0 0 20px rgba(197,160,89,0.04) !important;
    color: rgba(255,255,255,0.92) !important; font-family: 'Cinzel', serif !important;
    font-size: 1.05rem !important; line-height: 1.8 !important; padding: 12px 14px !important;
    border-radius: 16px 16px 16px 3px !important; word-break: break-word !important;
    text-align: left !important; border: none !important;
    animation: faqBubbleIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards;
}

.faq-typing-row { display: flex !important; align-items: flex-end !important; gap: 6px !important; padding: 0 4px !important;
    animation: faqSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards;
}
.faq-typing-bubble {
    background: #000 !important; box-shadow: 0 0 0 1px rgba(197,160,89,0.3) !important;
    padding: 12px 18px !important; border-radius: 16px 16px 16px 3px !important;
    display: flex !important; gap: 5px !important; align-items: center !important;
    animation: faqBubbleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; border: none !important;
}
.faq-typing-dot {
    width: 7px !important; height: 7px !important; border-radius: 50% !important;
    background: rgba(197,160,89,0.5) !important;
    animation: faqTypingBounce 1.2s ease-in-out infinite;
}
.faq-typing-dot:nth-child(2) { animation-delay: 0.15s !important; }
.faq-typing-dot:nth-child(3) { animation-delay: 0.3s !important; }

.faq-chat-ts {
    font-family: 'Orbitron', sans-serif !important; font-size: 0.3rem !important;
    letter-spacing: 1px !important; margin-top: 3px !important; color: rgba(255,255,255,0.15) !important;
}
.faq-chat-ts-queen { color: rgba(197,160,89,0.35) !important; text-align: left !important; }
.faq-chat-ts-user { text-align: right !important; }

.faq-chat-actions {
    display: flex !important; flex-direction: column !important; align-items: center !important;
    gap: 8px !important; margin-top: 16px !important; padding-bottom: 20px !important;
    animation: faqFadeIn 0.4s ease forwards;
}
.faq-close-btn {
    background: none !important; border: 1px solid rgba(255,255,255,0.08) !important;
    color: rgba(255,255,255,0.25) !important; font-family: 'Cinzel', serif !important;
    font-size: 0.6rem !important; letter-spacing: 2px !important; padding: 12px 28px !important;
    border-radius: 14px !important; cursor: pointer !important;
}
.faq-keep-asking-wrap {
    display: flex !important; flex-direction: column !important; align-items: center !important;
    gap: 10px !important; margin-top: 18px !important;
    position: relative !important; z-index: 2 !important;
    animation: faqFadeIn 0.5s ease forwards;
}
.faq-change-topic-btn {
    background: transparent !important; border-color: rgba(197,160,89,0.15) !important;
    color: rgba(197,160,89,0.5) !important;
}
.faq-keep-asking-btn {
    background: rgba(197,160,89,0.08) !important; border: 1px solid rgba(197,160,89,0.3) !important;
    color: #c5a059 !important; font-family: 'Cinzel', serif !important;
    font-size: 0.7rem !important; letter-spacing: 3px !important; padding: 14px 32px !important;
    cursor: pointer !important; transition: all 0.3s !important;
    text-transform: uppercase !important;
    -webkit-tap-highlight-color: transparent;
}
.faq-keep-asking-btn:hover {
    background: rgba(197,160,89,0.15) !important; border-color: rgba(197,160,89,0.55) !important;
}

@keyframes faqBubbleIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes faqSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes faqTypingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-6px); opacity: 1; }
}
@keyframes faqQFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes faqFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

@media (min-width: 769px) {
    .fake-nav { display: none !important; }
}
`;

interface FaqFooterProps {
    onNavClick?: (section: string) => void;
    onUnlock?: () => void;
}

function showAccessDenied(section: string, onUnlock?: () => void) {
    // If overlay already visible, just remove it (toggle behavior)
    const existing = document.getElementById('accessDeniedOverlay');
    if (existing) { existing.remove(); return; }
    const label = section || 'this section';
    const overlay = document.createElement('div');
    overlay.id = 'accessDeniedOverlay';
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

export default function FaqFooter({ onNavClick, onUnlock }: FaqFooterProps) {
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        let pickupIndex = 0;
        const catFirstAnswer: Record<number, boolean> = {};
        const askedQuestions: Record<number, number[]> = {};

        function getNextPickup() {
            const line = pickupLines[pickupIndex % pickupLines.length];
            pickupIndex++;
            return line;
        }

        function getFaqTime() {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        }

        function scrollChat() {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            setTimeout(() => { body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' }); }, 50);
        }

        function showTyping() {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            const row = document.createElement('div');
            row.className = 'faq-typing-row';
            row.id = 'faqTyping';
            row.innerHTML = '<img src="/queen-nav.png" class="faq-cb-av">' +
                '<div class="faq-typing-bubble"><div class="faq-typing-dot"></div><div class="faq-typing-dot"></div><div class="faq-typing-dot"></div></div>';
            body.appendChild(row);
            scrollChat();
        }

        function removeTyping() {
            const el = document.getElementById('faqTyping');
            if (el) el.remove();
        }

        function addQueenBubble(text: string) {
            removeTyping();
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            const row = document.createElement('div');
            row.className = 'faq-cb-row faq-cb-row-queen';
            row.innerHTML = '<img src="/queen-nav.png" class="faq-cb-av">' +
                '<div class="faq-cb-wrap-queen"><div class="faq-cb-queen">' + text + '</div>' +
                '<div class="faq-chat-ts faq-chat-ts-queen">' + getFaqTime() + '</div></div>';
            body.appendChild(row);
            scrollChat();
        }

        function addUserBubble(text: string) {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            const row = document.createElement('div');
            row.className = 'faq-cb-row faq-cb-row-user';
            row.innerHTML = '<div class="faq-cb-wrap-user"><div class="faq-cb-user">' + text + '</div>' +
                '<div class="faq-chat-ts faq-chat-ts-user">' + getFaqTime() + '</div></div>';
            body.appendChild(row);
            scrollChat();
        }

        function addChatActions() {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            const actions = document.createElement('div');
            actions.className = 'faq-chat-actions';
            const close = document.createElement('button');
            close.className = 'faq-close-btn';
            close.textContent = 'CLOSE';
            close.onclick = () => closeFaq();
            actions.appendChild(close);
            body.appendChild(actions);
        }

        function addChangeTopic() {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            const wrap = document.createElement('div');
            wrap.className = 'faq-keep-asking-wrap';
            const btn = document.createElement('button');
            btn.className = 'faq-keep-asking-btn faq-change-topic-btn';
            btn.textContent = 'CHANGE TOPIC';
            btn.onclick = () => {
                const oldActions = body.querySelectorAll('.faq-chat-actions');
                oldActions.forEach(a => a.remove());
                wrap.remove();
                goBackToCategories();
            };
            wrap.appendChild(btn);
            body.appendChild(wrap);
        }

        function showCategoryChips() {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            for (let i = 0; i < faqData.length; i++) {
                ((idx: number) => {
                    setTimeout(() => {
                        const wrap = document.createElement('div');
                        wrap.className = 'faq-cat-chips';
                        const chip = document.createElement('button');
                        chip.className = 'faq-cat-chip';
                        chip.innerHTML = faqData[idx].icon + ' ' + faqData[idx].title;
                        chip.setAttribute('data-cat', String(idx));
                        chip.onclick = function() { selectCategory(parseInt(chip.getAttribute('data-cat')!)); };
                        wrap.appendChild(chip);
                        body.appendChild(wrap);
                        scrollChat();
                    }, idx * 350);
                })(i);
            }
        }

        function selectCategory(index: number) {
            const chips = document.querySelector('.faq-cat-chips');
            if (chips) chips.remove();
            addUserBubble(faqData[index].title);
            const questions = faqData[index].questions;
            setTimeout(() => {
                showTyping();
                setTimeout(() => {
                    addQueenBubble('Here are some common questions:');
                    setTimeout(() => showQuestionBubbles(index, questions), 400);
                }, 1000);
            }, 300);
        }

        function showQuestionBubbles(catIndex: number, questions: typeof faqData[0]['questions']) {
            const body = document.getElementById('faqChatBody');
            if (!body) return;
            let delay = 0;
            for (let i = 0; i < questions.length; i++) {
                ((idx: number) => {
                    setTimeout(() => {
                        const wrap = document.createElement('div');
                        wrap.className = 'faq-q-wrap';
                        const bubble = document.createElement('div');
                        bubble.className = 'faq-q-bubble';
                        bubble.textContent = questions[idx].q;
                        bubble.setAttribute('data-cat', String(catIndex));
                        bubble.setAttribute('data-q', String(idx));
                        bubble.onclick = function() {
                            selectQuestion(parseInt(bubble.getAttribute('data-cat')!), parseInt(bubble.getAttribute('data-q')!));
                        };
                        wrap.appendChild(bubble);
                        body.appendChild(wrap);
                        scrollChat();
                        if (idx === questions.length - 1) {
                            setTimeout(() => { addChatActions(); scrollChat(); }, 200);
                        }
                    }, delay);
                })(i);
                delay += 350;
            }
        }

        function selectQuestion(catIndex: number, qIndex: number) {
            const cat = faqData[catIndex];
            const item = cat.questions[qIndex];
            if (!askedQuestions[catIndex]) askedQuestions[catIndex] = [];
            if (askedQuestions[catIndex].indexOf(qIndex) === -1) askedQuestions[catIndex].push(qIndex);
            addUserBubble(item.q);
            let pickupHtml = '';
            if (!catFirstAnswer[catIndex]) {
                catFirstAnswer[catIndex] = true;
                pickupHtml = '<p style="color:#c5a059;margin:0 0 8px;font-family:Cinzel,serif;font-size:0.85rem;font-weight:600">' + getNextPickup() + '</p>';
            }
            setTimeout(() => showTyping(), 300);
            setTimeout(() => {
                removeTyping();
                const body = document.getElementById('faqChatBody');
                if (!body) return;
                const row = document.createElement('div');
                row.className = 'faq-cb-row faq-cb-row-queen';
                row.innerHTML = '<img src="/queen-nav.png" class="faq-cb-av">' +
                    '<div class="faq-cb-wrap-queen"><div class="faq-a-bubble">' + pickupHtml + item.a + '</div>' +
                    '<div class="faq-chat-ts faq-chat-ts-queen">' + getFaqTime() + '</div></div>';
                body.appendChild(row);
                const asked = askedQuestions[catIndex] || [];
                const remaining: number[] = [];
                for (let i = 0; i < cat.questions.length; i++) {
                    if (asked.indexOf(i) === -1) remaining.push(i);
                }
                if (remaining.length > 0) {
                    setTimeout(() => {
                        const keepWrap = document.createElement('div');
                        keepWrap.className = 'faq-keep-asking-wrap';
                        const keepBtn = document.createElement('button');
                        keepBtn.className = 'faq-keep-asking-btn';
                        keepBtn.textContent = 'KEEP ASKING';
                        keepBtn.onclick = () => {
                            const oldActions = body.querySelectorAll('.faq-chat-actions');
                            oldActions.forEach(a => { (a as HTMLElement).style.opacity = '0'; (a as HTMLElement).style.transition = 'opacity 0.3s'; });
                            keepWrap.style.opacity = '0';
                            keepWrap.style.transition = 'opacity 0.3s';
                            setTimeout(() => {
                                oldActions.forEach(a => a.remove());
                                keepWrap.remove();
                                showTyping();
                                setTimeout(() => {
                                    removeTyping();
                                    addQueenBubble('Sure, here you go:');
                                    setTimeout(() => {
                                        remaining.forEach((ri, idx) => {
                                            setTimeout(() => {
                                                const wrap = document.createElement('div');
                                                wrap.className = 'faq-q-wrap';
                                                const b = document.createElement('div');
                                                b.className = 'faq-q-bubble';
                                                b.textContent = cat.questions[ri].q;
                                                b.setAttribute('data-cat', String(catIndex));
                                                b.setAttribute('data-q', String(ri));
                                                b.onclick = function() {
                                                    selectQuestion(parseInt(b.getAttribute('data-cat')!), parseInt(b.getAttribute('data-q')!));
                                                };
                                                wrap.appendChild(b);
                                                body.appendChild(wrap);
                                                scrollChat();
                                                if (idx === remaining.length - 1) {
                                                    setTimeout(() => { addChangeTopic(); addChatActions(); scrollChat(); }, 200);
                                                }
                                            }, idx * 350);
                                        });
                                    }, 400);
                                }, 900);
                            }, 300);
                        };
                        keepWrap.appendChild(keepBtn);
                        body.appendChild(keepWrap);
                        addChatActions();
                        scrollChat();
                    }, 400);
                } else {
                    addChatActions();
                }
                scrollChat();
            }, 1500);
        }

        function goBackToCategories() {
            showTyping();
            setTimeout(() => {
                addQueenBubble('What else would you like to know?');
                setTimeout(() => showCategoryChips(), 400);
            }, 1000);
        }

        function openFaq() {
            const overlay = document.getElementById('faqChatOverlay');
            const body = document.getElementById('faqChatBody');
            const speech = document.querySelector('.faq-nav-speech') as HTMLElement;
            if (!overlay || !body) return;
            if (speech) speech.style.display = 'none';
            body.innerHTML = '';
            overlay.classList.add('open');
            setTimeout(() => showTyping(), 200);
            setTimeout(() => { addQueenBubble('What would you like to know?'); }, 1200);
            setTimeout(() => {
                showCategoryChips();
                setTimeout(() => { addChatActions(); scrollChat(); }, faqData.length * 350 + 200);
            }, 1600);
        }

        function closeFaq() {
            const overlay = document.getElementById('faqChatOverlay');
            if (overlay) overlay.classList.remove('open');
            const speech = document.querySelector('.faq-nav-speech') as HTMLElement;
            if (speech) speech.style.display = '';
        }

        function toggleFaq() {
            const overlay = document.getElementById('faqChatOverlay');
            if (!overlay) return;
            if (overlay.classList.contains('open')) { closeFaq(); return; }
            openFaq();
        }

        (window as any).toggleFaqChat = toggleFaq;
        (window as any).closeFaqChat = closeFaq;

    }, []);

    const handleNavClick = (section: string) => {
        // Close FAQ if it's open
        (window as any).closeFaqChat?.();
        if (onNavClick) { onNavClick(section); return; }
        showAccessDenied(section, onUnlock);
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: FOOTER_AND_FAQ_CSS }} />

            {/* FAQ Chat Overlay */}
            <div id="faqChatOverlay" className="faq-chat-overlay">
                <div className="faq-chat-header">
                    <div className="faq-chat-header-left">
                        <div className="faq-chat-header-av-wrap">
                            <img src="/queen-nav.png" className="faq-chat-header-av" alt="Queen Karin" />
                            <div className="faq-chat-online-dot" />
                        </div>
                        <div className="faq-chat-header-info">
                            <span className="faq-chat-header-name">QUEEN KARIN</span>
                            <span className="faq-chat-header-status">ONLINE NOW</span>
                        </div>
                    </div>
                    <button className="faq-chat-close" onClick={() => (window as any).closeFaqChat?.()}>&#10005;</button>
                </div>
                <div className="faq-chat-body" id="faqChatBody" />
            </div>

            {/* Footer Nav - exact same markup as landing.html */}
            <nav className="fake-nav">
                <button className="fake-nav-btn" onClick={() => handleNavClick('your Profile')}>
                    <span className="fake-nav-icon">{'\u25C6\uFE0E'}</span>
                    <span className="fake-nav-label">PROFILE</span>
                </button>
                <button className="fake-nav-btn" onClick={() => handleNavClick('your Record')}>
                    <span className="fake-nav-icon">{'\u25A6\uFE0E'}</span>
                    <span className="fake-nav-label">RECORD</span>
                </button>
                <button className="fake-nav-center" onClick={() => (window as any).toggleFaqChat?.()}>
                    <div className="faq-nav-speech">Any questions?</div>
                    <div className="fake-nav-avatar">
                        <img src="/queen-nav.png" alt="Queen" />
                    </div>
                </button>
                <button className="fake-nav-btn" onClick={() => handleNavClick("Queen's Wall")}>
                    <span className="fake-nav-icon">{'\u265B\uFE0E'}</span>
                    <span className="fake-nav-label">QUEEN</span>
                </button>
                <button className="fake-nav-btn" onClick={() => handleNavClick('Global Chat')}>
                    <span className="fake-nav-icon">{'\u25CE\uFE0E'}</span>
                    <span className="fake-nav-label">GLOBAL</span>
                </button>
            </nav>
        </>
    );
}
