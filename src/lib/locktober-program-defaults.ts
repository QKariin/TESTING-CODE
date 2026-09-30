// Locktober 2026 — 31-day program template
// Every day has 3 mandatory tasks: kneel + chastity check + daily video task
// Queen can add more tasks per day from the dashboard on top of this base

import { kneelTarget } from './vault-program-defaults';

// The daily video task prompt for each day of Locktober.
// Queen can override these from the dashboard — these are just the defaults.
const LOCKTOBER_VIDEO_PROMPTS: Record<number, string> = {
    1:  'Day 1. Look at the camera. Tell me your name and why you chose to lock for Locktober. No script. Just the truth.',
    2:  'Day 2. Show me the device. Tell me how it feels today.',
    3:  'Day 3. Three days in. Record yourself on your knees. Tell me one thing you are already learning.',
    4:  'Day 4. Look straight at the camera. Say: "I am locked and I belong to Queen Karin." Mean it.',
    5:  'Day 5. Tell me about the moment today when you felt the lock most. What were you doing? What did it remind you of?',
    6:  'Day 6. Record a 60-second video. No talking allowed. Just kneel, hands on thighs, eyes down. Show me your stillness.',
    7:  'Day 7. One week. Record yourself and tell me honestly: what is harder than you expected?',
    8:  'Day 8. Show me your obedience. On your knees, look at the camera, and read today\'s chastity check date out loud.',
    9:  'Day 9. Tell me one fantasy you have had since locking. Be honest. I already know.',
    10: 'Day 10. Double digits. Record yourself saying exactly what you are willing to endure to reach Day 31.',
    11: 'Day 11. Show me your discipline today. Record a 30-second plank on camera, then look at me and say "I will not break."',
    12: 'Day 12. Tell me what the lock has taken from you. Then tell me what it has given you.',
    13: 'Day 13. Record yourself writing my name on your wrist. Show the camera. Do not wash it off today.',
    14: 'Day 14. Halfway. Get on your knees, look at the camera. Tell me: do you deserve release? Explain your answer.',
    15: 'Day 15. The second half starts now. Record yourself stating your commitment to finish. Say it like you mean it.',
    16: 'Day 16. Tell me the hardest moment of today. No performance. Just what actually happened inside you.',
    17: 'Day 17. Show me 3 minutes of stillness. Kneel. Timer visible. No movement.',
    18: 'Day 18. Record a devotion message to me. Speak to me directly. Tell me what this month is teaching you.',
    19: 'Day 19. Show me your edge of control. Tell me how much pressure is building and why you will not give in.',
    20: 'Day 20. You have 11 days left. Record yourself writing "LOCKTOBER" on your skin. Show me.',
    21: 'Day 21. Three weeks. Record yourself confessing every time this week you almost broke. Every time.',
    22: 'Day 22. Tell me who you were on Day 1 and who you are becoming. Specific. Real.',
    23: 'Day 23. Show me your most obedient moment today. Describe it and demonstrate it on camera.',
    24: 'Day 24. Record a letter to yourself on Day 31. What do you want to tell that version of you?',
    25: 'Day 25. Get on your knees. Look at the camera. Say: "I will finish what I started." Say it until you believe it.',
    26: 'Day 26. Five days left. Show me that the lock is still on. Tell me what finishing this month means to you.',
    27: 'Day 27. Record yourself in the position you kneel in every morning. Hold it for 60 seconds. Then look at me.',
    28: 'Day 28. Tell me the one thing you will never forget about this month. Make it honest. Make it yours.',
    29: 'Day 29. Second to last day. What are you afraid to feel when it ends? Tell me.',
    30: 'Day 30. Tomorrow it ends. Record yourself: what have you proven? What do you want me to know?',
    31: 'Day 31. You made it. Get on your knees. Look at me. Tell me everything. Then thank me.',
};

export function generateLocktoberProgram(): Record<string, any[]> {
    const program: Record<string, any[]> = {};
    for (let d = 1; d <= 31; d++) {
        const kt = kneelTarget(d);
        program[String(d)] = [
            { type: 'kneel',         target: kt, label: `Kneel ${kt} times` },
            { type: 'chastity_check', target: 1,  label: 'Chastity check-in' },
            { type: 'video_task',    target: 1,  label: `Day ${d} video`, config: {
                instruction: LOCKTOBER_VIDEO_PROMPTS[d] || `Day ${d}. Record your daily Locktober video.`,
            }},
        ];
    }
    return program;
}
