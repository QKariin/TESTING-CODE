// Shared vault program defaults — THE SINGLE SOURCE OF TRUTH
// Used by both the dashboard (KeyholderProgram) and all API routes for program generation.
// If you update this, the dashboard and all API routes will use the same defaults.

export function kneelTarget(d: number): number {
    if (d<=3) return 4; if (d<=5) return 5; if (d<=7) return 6;
    if (d<=10) return 8; if (d<=14) return 10;
    if (d<=17) return 12; if (d<=21) return 14;
    if (d<=25) return 16; if (d<=28) return 18; return 20;
}

export function defaultDayTasks(d: number): any[] {
    const t: any[] = [{ type: 'kneel', target: kneelTarget(d), label: `Kneel ${kneelTarget(d)} times` }];

    // PHASE 1 - OBEDIENCE - Foundation (Days 1-7)
    if (d===1) {
        t.push({ type: 'writing', target: 1, label: 'Why I submitted', config: {
            prompt: 'Write about why you chose to submit. What brought you here? What do you hope to become? Be honest and vulnerable.', minWords: 100,
        }});
        t.push({ type: 'photo_proof', target: 1, label: 'First devotion photo', config: {
            instruction: 'Take a photo on your knees, head bowed. Your first act of visible submission.',
        }});
    }
    if (d===2) {
        t.push({ type: 'coinflip', target: 1, label: 'Mercy or punishment', config: {
            headsText: '+20 coins — Queen shows mercy', tailsText: 'Write 30 lines: "I will obey without question"',
        }});
        t.push({ type: 'payment', target: 5, label: 'First tribute', config: { amount: 5 }});
    }
    if (d===3) {
        t.push({ type: 'spin_wheel', target: 1, label: 'Spin the Wheel of Fate', config: {
            segments: [
                { text: '+30 coins', followUpType: 'instant' },
                { text: 'Gratitude list (5 items)', followUpType: 'writing', followUpPrompt: 'List 5 things you are grateful for about your Queen' },
                { text: 'Devotion selfie', followUpType: 'photo', followUpInstruction: 'Photo on your knees showing devotion' },
                { text: '30 second plank', followUpType: 'endurance', followUpDuration: 30 },
                { text: 'Write 20 lines', followUpType: 'writing', followUpPrompt: 'I am learning to obey' },
                { text: 'Lucky — nothing extra', followUpType: 'instant' },
            ],
        }});
    }
    if (d===4) {
        t.push({ type: 'endurance', target: 60, label: 'Kneeling hold — 60s on camera', config: {
            instruction: 'Kneel perfectly still, hands on thighs, head bowed. Do not move for 60 seconds. Camera must show you.', duration: 60,
        }});
        t.push({ type: 'writing', target: 1, label: 'Evening journal', config: {
            prompt: 'How did today feel? What was hard? What are you learning about yourself?', minWords: 80,
        }});
    }
    if (d===5) {
        t.push({ type: 'quiz', target: 1, label: "Queen's rules quiz", config: {
            question: 'What is the first thing you must do each morning in the program?', answers: ['Check phone', 'Complete your kneeling', 'Send a message', 'Wait for instructions'], correctIdx: 1, timeLimit: 30,
        }});
        t.push({ type: 'photo_proof', target: 1, label: 'Clean space photo', config: {
            instruction: 'Photograph your clean, organized space — bed made, floor clear. Order reflects discipline.',
        }});
    }
    if (d===6) {
        t.push({ type: 'card_pick', target: 1, label: 'Draw from the Devotion Deck', config: {
            cards: [
                { text: 'Write a worship message', followUpType: 'writing', followUpPrompt: 'Express your devotion in at least 100 words' },
                { text: 'Gratitude list (5 items)', followUpType: 'writing', followUpPrompt: 'List 5 things you are grateful for' },
                { text: 'Devotion photo', followUpType: 'photo', followUpInstruction: 'Photo showing your devotion pose' },
                { text: 'Tribute 5 coins', followUpType: 'instant' },
                { text: '1 min plank on camera', followUpType: 'endurance', followUpDuration: 60 },
            ],
        }});
        t.push({ type: 'payment', target: 5, label: 'Daily tribute', config: { amount: 5 }});
    }
    if (d===7) {
        t.push({ type: 'truth_dare', target: 1, label: 'Truth or Dare', config: {
            truthText: 'What is one thing you failed at this week? Confess completely.', truthFollowUp: 'writing',
            dareText: 'Cold water on your face for 30 seconds — on camera', dareFollowUp: 'endurance',
        }});
        t.push({ type: 'writing', target: 1, label: 'Week 1 confession', config: {
            prompt: 'Confess every moment this week where you hesitated, questioned, or resisted. Hold nothing back.', minWords: 150,
        }});
    }

    // PHASE 2 - DISCIPLINE - Building (Days 8-14)
    if (d===8) {
        t.push({ type: 'dice_roll', target: 1, label: 'Roll the Punishment Dice', config: {
            outcomes: [
                { text: 'Write lines x40', followUpType: 'writing', followUpPrompt: 'I exist to serve' },
                { text: 'Cold shower 30s', followUpType: 'endurance', followUpDuration: 30 },
                { text: '20 pushups on camera', followUpType: 'video', followUpTarget: 1 },
                { text: 'Body writing: OBEY', followUpType: 'photo', followUpInstruction: 'Write OBEY on your wrist and photograph it' },
                { text: 'Gratitude essay (100 words)', followUpType: 'writing', followUpPrompt: 'Why are you grateful for discipline?' },
                { text: '2 min wall sit on camera', followUpType: 'endurance', followUpDuration: 120 },
            ],
        }});
        t.push({ type: 'multi_video', target: 2, label: 'Record 2 devotion clips', config: {
            instruction: 'In each clip, say one thing you have learned about obedience. Look at the camera.', target: 2,
        }});
    }
    if (d===9) {
        t.push({ type: 'greed_game', target: 1, label: 'Greed Game — push your luck', config: { ceiling: 30 }});
        t.push({ type: 'endurance', target: 90, label: 'Corner time 90s', config: {
            instruction: 'Stand in the corner, nose to the wall, hands behind your back. No moving. Camera on.', duration: 90,
        }});
        t.push({ type: 'payment', target: 8, label: 'Tribute 8 coins', config: { amount: 8 }});
    }
    if (d===10) {
        t.push({ type: 'timed_photo', target: 1, label: 'Morning check-in photo', config: {
            instruction: 'Take a photo within 5 minutes of waking. Show you are alert and ready to serve.',
        }});
        t.push({ type: 'spin_wheel', target: 1, label: 'Spin for your punishment', config: {
            segments: [
                { text: 'Cold shower 45s', followUpType: 'endurance', followUpDuration: 45 },
                { text: '40 squats on camera', followUpType: 'video', followUpTarget: 1 },
                { text: 'Write 50 lines', followUpType: 'writing', followUpPrompt: 'I belong to my Queen' },
                { text: 'Edge and deny', followUpType: 'video', followUpTarget: 1 },
                { text: 'Body writing photo', followUpType: 'photo', followUpInstruction: 'Write OWNED on your chest' },
                { text: '+1 day added to lock', followUpType: 'instant' },
            ],
        }});
        t.push({ type: 'writing', target: 1, label: 'Discipline journal', config: {
            prompt: 'How has your behavior changed since day 1? What habits are forming?', minWords: 100,
        }});
    }
    if (d===11) {
        t.push({ type: 'simon_says', target: 1, label: 'Obedience drill', config: {
            chainTasks: [
                { text: 'Drop and do 10 pushups — NOW', timeLimit: 30 },
                { text: 'Take a selfie on your knees', timeLimit: 20 },
                { text: 'Write "I obey" 10 times', timeLimit: 40 },
                { text: 'Stand at attention for 15 seconds', timeLimit: 20 },
            ],
        }});
        t.push({ type: 'writing', target: 1, label: 'Obedience reflection', config: {
            prompt: 'How did it feel to obey instantly without thinking? What did the drill teach you?', minWords: 80,
        }});
    }
    if (d===12) {
        t.push({ type: 'card_pick', target: 1, label: 'Punishment Deck draw', config: {
            cards: [
                { text: 'Cold shower 60s', followUpType: 'endurance', followUpDuration: 60 },
                { text: 'Edge 3 times on camera', followUpType: 'video', followUpTarget: 3 },
                { text: 'Write lines x60', followUpType: 'writing', followUpPrompt: 'I will never disobey my Queen' },
                { text: 'Corner time 5 min', followUpType: 'endurance', followUpDuration: 300 },
                { text: 'Body writing: SLAVE', followUpType: 'photo', followUpInstruction: 'Write SLAVE on your inner thigh and photograph' },
                { text: '50 pushups on camera', followUpType: 'video', followUpTarget: 1 },
            ],
        }});
        t.push({ type: 'endurance', target: 120, label: 'Plank hold — 2 min', config: {
            instruction: 'Hold plank position for the full duration. Proper form. Camera shows full body.', duration: 120,
        }});
        t.push({ type: 'payment', target: 10, label: 'Tribute 10 coins', config: { amount: 10 }});
    }
    if (d===13) {
        t.push({ type: 'ambush_snap', target: 3, label: '3 ambush snaps today', config: { target: 3 }});
        t.push({ type: 'coinflip', target: 1, label: 'Double or nothing', config: {
            headsText: 'Skip the evening writing task', tailsText: 'Writing task doubled — 200 words minimum',
        }});
        t.push({ type: 'writing', target: 1, label: 'Gratitude letter', config: {
            prompt: 'Write a letter of gratitude to your Queen. What has she given you through this structure?', minWords: 100,
        }});
    }
    if (d===14) {
        t.push({ type: 'quiz', target: 1, label: 'Discipline quiz', config: {
            question: 'What is the purpose of punishment in your training?', answers: ['To cause pain', 'To correct behavior and build discipline', 'Entertainment', 'Random'], correctIdx: 1, timeLimit: 30,
        }});
        t.push({ type: 'truth_dare', target: 1, label: 'Halfway Truth or Dare', config: {
            truthText: 'What is the hardest thing you have done so far and why did it matter?', truthFollowUp: 'writing',
            dareText: 'Cold shower 60 seconds — full body, on camera', dareFollowUp: 'endurance',
        }});
        t.push({ type: 'writing', target: 1, label: 'Halfway confession', config: {
            prompt: 'You are halfway through. Confess your failures. Where did you cheat, hesitate, or resist? What will you do differently?', minWords: 200,
        }});
        t.push({ type: 'payment', target: 10, label: 'Tribute 10 coins', config: { amount: 10 }});
    }

    // PHASE 3 - ENDURANCE - Testing (Days 15-21)
    if (d===15) {
        t.push({ type: 'russian_roulette', target: 1, label: 'Russian Roulette', config: {
            punishment: 'Cold shower 2 minutes + 50 lines: "I accept my fate"',
        }});
        t.push({ type: 'spin_wheel', target: 1, label: 'Spin for extra punishment', config: {
            segments: [
                { text: 'Edge 3 times on camera', followUpType: 'video', followUpTarget: 3 },
                { text: 'Cold shower 60s', followUpType: 'endurance', followUpDuration: 60 },
                { text: '3 min wall sit', followUpType: 'endurance', followUpDuration: 180 },
                { text: 'Write 75 lines', followUpType: 'writing', followUpPrompt: 'I am nothing without discipline' },
                { text: 'Body writing: PROPERTY', followUpType: 'photo', followUpInstruction: 'Write PROPERTY across your chest' },
                { text: 'Lucky — you escape', followUpType: 'instant' },
            ],
        }});
        t.push({ type: 'payment', target: 10, label: 'Tribute 10 coins', config: { amount: 10 }});
    }
    if (d===16) {
        t.push({ type: 'endurance', target: 180, label: 'Corner time — 3 minutes', config: {
            instruction: 'Nose to the wall. Hands behind your back. Do not move. Camera records everything.', duration: 180,
        }});
        t.push({ type: 'greed_game', target: 1, label: 'High stakes Greed Game', config: { ceiling: 50 }});
        t.push({ type: 'photo_proof', target: 1, label: 'Body writing: OWNED', config: {
            instruction: 'Write OWNED across your lower stomach. Clear photograph.',
        }});
    }
    if (d===17) {
        t.push({ type: 'ambush_snap', target: 5, label: '5 ambush snaps — heavy watch', config: { target: 5 }});
        t.push({ type: 'multi_video', target: 3, label: 'Record 3 proof clips', config: {
            instruction: 'Three separate clips. Each one: state your name, day number, and one rule you follow. On your knees.', target: 3,
        }});
        t.push({ type: 'quiz', target: 1, label: 'Protocol quiz', config: {
            question: 'When your Queen gives an order, what is the correct first response?', answers: ['Why?', 'Yes, my Queen', 'Can we discuss it?', 'One moment'], correctIdx: 1, timeLimit: 15,
        }});
    }
    if (d===18) {
        t.push({ type: 'simon_says', target: 1, label: 'Endurance drill', config: {
            chainTasks: [
                { text: 'Plank — hold it', timeLimit: 45 },
                { text: '20 squats — no breaks', timeLimit: 40 },
                { text: 'Wall sit — hold', timeLimit: 45 },
                { text: '15 pushups — full form', timeLimit: 35 },
                { text: 'Stand at attention 10 seconds', timeLimit: 15 },
            ],
        }});
        t.push({ type: 'dice_roll', target: 1, label: 'Roll for tribute amount', config: {
            outcomes: [
                { text: 'Tribute 5 coins', followUpType: 'instant' },
                { text: 'Tribute 10 coins', followUpType: 'instant' },
                { text: 'Tribute 15 coins', followUpType: 'instant' },
                { text: 'Tribute 20 coins', followUpType: 'instant' },
                { text: 'Tribute 25 coins', followUpType: 'instant' },
                { text: 'Tribute 30 coins!', followUpType: 'instant' },
            ],
        }});
        t.push({ type: 'payment', target: 15, label: 'Base tribute 15', config: { amount: 15 }});
    }
    if (d===19) {
        t.push({ type: 'card_pick', target: 1, label: 'Draw from the Punishment Deck', config: {
            cards: [
                { text: 'Cold shower 90s', followUpType: 'endurance', followUpDuration: 90 },
                { text: 'Edge 5 times on camera', followUpType: 'video', followUpTarget: 5 },
                { text: 'Write lines x100', followUpType: 'writing', followUpPrompt: 'My body belongs to my Queen' },
                { text: 'Corner time 10 min', followUpType: 'endurance', followUpDuration: 600 },
                { text: '100 squats on camera', followUpType: 'video', followUpTarget: 1 },
                { text: 'Body writing full set', followUpType: 'photo', followUpInstruction: 'Write OBEY, SERVE, SUBMIT — one word on each limb' },
            ],
        }});
        t.push({ type: 'endurance', target: 120, label: 'Kneeling hold — 2 min', config: {
            instruction: 'Kneel perfectly still. Hands on thighs. Head bowed. Do not move until the timer ends.', duration: 120,
        }});
        t.push({ type: 'timed_photo', target: 1, label: 'Surprise pose', config: {
            instruction: 'Get on your knees, hands behind your back, head down. Photo within 60 seconds of notification.',
        }});
    }
    if (d===20) {
        t.push({ type: 'russian_roulette', target: 1, label: 'Russian Roulette', config: {
            punishment: 'Edge 5 times then deny + cold shower 90 seconds',
        }});
        t.push({ type: 'spin_wheel', target: 1, label: 'Wheel of Suffering', config: {
            segments: [
                { text: 'Cold shower 2 min', followUpType: 'endurance', followUpDuration: 120 },
                { text: '75 pushups on camera', followUpType: 'video', followUpTarget: 1 },
                { text: 'Write 100 lines', followUpType: 'writing', followUpPrompt: 'Suffering is the path to devotion' },
                { text: 'Edge 5x on camera', followUpType: 'video', followUpTarget: 5 },
                { text: '5 min corner time', followUpType: 'endurance', followUpDuration: 300 },
                { text: 'Body writing: full torso', followUpType: 'photo', followUpInstruction: 'Cover your torso in devotion words — OWNED, SLAVE, OBEY, PROPERTY. Photograph.' },
            ],
        }});
        t.push({ type: 'multi_video', target: 2, label: '2 suffering clips', config: {
            instruction: 'Two clips. Each one: describe what you are enduring today and why you accept it.', target: 2,
        }});
        t.push({ type: 'payment', target: 15, label: 'Tribute 15 coins', config: { amount: 15 }});
    }
    if (d===21) {
        t.push({ type: 'truth_dare', target: 1, label: 'Final test — Truth or Dare', config: {
            truthText: 'What is the one thing about yourself you are most afraid to admit? Write it completely.', truthFollowUp: 'writing',
            dareText: 'Cold shower 2 minutes. Full body. No flinching. On camera.', dareFollowUp: 'endurance',
        }});
        t.push({ type: 'endurance', target: 300, label: 'Kneeling meditation — 5 min', config: {
            instruction: 'Kneel in silence for 5 full minutes. Eyes closed. Reflect on everything. Camera on.', duration: 300,
        }});
        t.push({ type: 'writing', target: 1, label: 'Endurance phase confession', config: {
            prompt: 'The hardest phase is over. What broke you? What built you? What do you understand now that you did not on Day 1?', minWords: 250,
        }});
    }

    // PHASE 4 - DEVOTION - Proving (Days 22-30)
    if (d===22) {
        t.push({ type: 'writing', target: 1, label: 'Devotion letter', config: {
            prompt: 'Write a letter to your Queen. Tell her what this journey has meant. What you have become. What you are willing to give.', minWords: 200,
        }});
        t.push({ type: 'greed_game', target: 1, label: 'Greed Game — high stakes', config: { ceiling: 75 }});
        t.push({ type: 'payment', target: 15, label: 'Tribute 15 coins', config: { amount: 15 }});
    }
    if (d===23) {
        t.push({ type: 'spin_wheel', target: 1, label: 'Wheel of Devotion', config: {
            segments: [
                { text: 'Write a love letter to Queen', followUpType: 'writing', followUpPrompt: 'Pour your heart out. No holding back.' },
                { text: 'Record a devotion video', followUpType: 'video', followUpTarget: 1 },
                { text: 'Body writing: HER NAME', followUpType: 'photo', followUpInstruction: "Write your Queen's title over your heart" },
                { text: 'Gratitude list (10)', followUpType: 'writing', followUpPrompt: 'List 10 transformations you have experienced' },
                { text: '3 min plank of devotion', followUpType: 'endurance', followUpDuration: 180 },
                { text: '+50 coins for loyalty', followUpType: 'instant' },
            ],
        }});
        t.push({ type: 'dice_roll', target: 1, label: 'Roll for endurance', config: {
            outcomes: [
                { text: '1 min kneeling', followUpType: 'endurance', followUpDuration: 60 },
                { text: '2 min kneeling', followUpType: 'endurance', followUpDuration: 120 },
                { text: '3 min kneeling', followUpType: 'endurance', followUpDuration: 180 },
                { text: '4 min kneeling', followUpType: 'endurance', followUpDuration: 240 },
                { text: '5 min kneeling', followUpType: 'endurance', followUpDuration: 300 },
                { text: '7 min kneeling!', followUpType: 'endurance', followUpDuration: 420 },
            ],
        }});
        t.push({ type: 'payment', target: 15, label: 'Tribute 15 coins', config: { amount: 15 }});
    }
    if (d===24) {
        t.push({ type: 'ambush_snap', target: 6, label: '6 ambush snaps — full watch', config: { target: 6 }});
        t.push({ type: 'simon_says', target: 1, label: 'Devotion drill', config: {
            chainTasks: [
                { text: 'Say "I serve my Queen" out loud 5 times', timeLimit: 20 },
                { text: 'Bow your head and hold for 10 seconds', timeLimit: 15 },
                { text: 'Write 5 things you are grateful for', timeLimit: 45 },
                { text: 'Photo in devotion pose', timeLimit: 30 },
                { text: '15 pushups — full form', timeLimit: 35 },
            ],
        }});
        t.push({ type: 'timed_photo', target: 1, label: 'Outfit check', config: {
            instruction: 'Show your full outfit or state of dress as instructed. Photo within 60 seconds.',
        }});
    }
    if (d===25) {
        t.push({ type: 'truth_dare', target: 1, label: 'Deep Truth or Dare', config: {
            truthText: 'Write about the moment you realized you truly wanted to be controlled. Every detail.', truthFollowUp: 'writing',
            dareText: 'Full body writing session — 5 words of devotion on your body, photographed', dareFollowUp: 'photo',
        }});
        t.push({ type: 'card_pick', target: 1, label: 'Draw from the Devotion Deck', config: {
            cards: [
                { text: 'Record a worship video', followUpType: 'video', followUpTarget: 1 },
                { text: 'Write an apology for past disobedience', followUpType: 'writing', followUpPrompt: 'Apologize for every time you resisted or hesitated' },
                { text: 'Devotion photo — forehead on the ground', followUpType: 'photo', followUpInstruction: 'Full prostration. Forehead touching the floor. Photograph.' },
                { text: '+30 coins — reward for loyalty', followUpType: 'instant' },
                { text: '3 min plank', followUpType: 'endurance', followUpDuration: 180 },
            ],
        }});
        t.push({ type: 'payment', target: 20, label: 'Heavy tribute 20 coins', config: { amount: 20 }});
    }
    if (d===26) {
        t.push({ type: 'endurance', target: 120, label: 'Cold shower — 2 min', config: {
            instruction: 'Full body under cold water for 2 minutes. No flinching. Camera on.', duration: 120,
        }});
        t.push({ type: 'russian_roulette', target: 1, label: 'Russian Roulette', config: {
            punishment: 'Additional 2 minutes cold shower + write 100 lines',
        }});
        t.push({ type: 'greed_game', target: 1, label: 'Ultimate Greed Game', config: { ceiling: 100 }});
        t.push({ type: 'payment', target: 20, label: 'Tribute 20 coins', config: { amount: 20 }});
    }
    if (d===27) {
        t.push({ type: 'writing', target: 1, label: 'Essay: What I have become', config: {
            prompt: 'Write a full essay about your transformation. Who were you on Day 1? Who are you now? What has obedience taught you? What will you carry forward?', minWords: 300,
        }});
        t.push({ type: 'multi_video', target: 3, label: '3 reflection clips', config: {
            instruction: 'Three clips. Clip 1: What you learned about obedience. Clip 2: What you learned about yourself. Clip 3: What you promise going forward.', target: 3,
        }});
        t.push({ type: 'payment', target: 20, label: 'Tribute 20 coins', config: { amount: 20 }});
    }
    if (d===28) {
        t.push({ type: 'spin_wheel', target: 1, label: 'Final Spin', config: {
            segments: [
                { text: 'Cold shower 90s', followUpType: 'endurance', followUpDuration: 90 },
                { text: 'Edge 5x on camera', followUpType: 'video', followUpTarget: 5 },
                { text: '5 min corner time', followUpType: 'endurance', followUpDuration: 300 },
                { text: 'Write 100 lines', followUpType: 'writing', followUpPrompt: 'I am forever devoted' },
                { text: '100 pushups', followUpType: 'video', followUpTarget: 1 },
                { text: 'MERCY — Queen forgives you', followUpType: 'instant' },
            ],
        }});
        t.push({ type: 'coinflip', target: 1, label: 'Final coin flip', config: {
            headsText: '+100 coins — loyalty rewarded', tailsText: '+2 days added to lock',
        }});
        t.push({ type: 'russian_roulette', target: 1, label: 'Final Roulette', config: {
            punishment: 'Write a 500-word essay on total surrender',
        }});
        t.push({ type: 'quiz', target: 1, label: 'Final protocol quiz', config: {
            question: 'After 28 days, what is the true meaning of submission?', answers: ['Following orders', 'Giving up control willingly as an act of trust and devotion', 'Being punished', 'Doing tasks'], correctIdx: 1, timeLimit: 45,
        }});
    }
    if (d===29) {
        t.push({ type: 'endurance', target: 300, label: '5 min kneeling hold', config: {
            instruction: 'Kneel in perfect stillness for 5 full minutes. This is the body you have built. Show it.', duration: 300,
        }});
        t.push({ type: 'multi_video', target: 3, label: '3 proof-of-devotion clips', config: {
            instruction: 'Three final clips. Show your discipline, your control, your transformation. Make them count.', target: 3,
        }});
        t.push({ type: 'photo_proof', target: 1, label: 'Final body writing', config: {
            instruction: 'Write DEVOTED across your chest. This is your mark. Photograph it with pride.',
        }});
        t.push({ type: 'payment', target: 25, label: 'Grand tribute 25 coins', config: { amount: 25 }});
    }
    if (d===30) {
        t.push({ type: 'writing', target: 1, label: 'Final devotion letter', config: {
            prompt: 'This is your last writing. Write to your Queen — tell her everything. The pain, the growth, the gratitude. What you were. What you are. What you will be. Hold nothing back.', minWords: 400,
        }});
        t.push({ type: 'truth_dare', target: 1, label: 'Final Truth or Dare', config: {
            truthText: 'The deepest truth: What do you need? Write it without shame.', truthFollowUp: 'writing',
            dareText: 'Full prostration photo — forehead on the floor, arms extended, total surrender', dareFollowUp: 'photo',
        }});
        t.push({ type: 'photo_proof', target: 1, label: 'Graduation photo', config: {
            instruction: 'Your final photo. On your knees, looking at the camera. Show the person you have become.',
        }});
        t.push({ type: 'greed_game', target: 1, label: 'Final Greed Game', config: { ceiling: 200 }});
        t.push({ type: 'payment', target: 30, label: 'Final tribute — 30 coins', config: { amount: 30 }});
    }

    return t;
}

export function generateDefaultProgram(): Record<string, any[]> {
    const program: Record<string, any[]> = {};
    for (let d = 1; d <= 30; d++) {
        program[String(d)] = defaultDayTasks(d);
    }
    return program;
}
