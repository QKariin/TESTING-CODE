// ─────────────────────────────────────────────────────────────────
//  CENTRAL MECHANISM DATABASE
//  Single source of truth for every interactive mechanism in the app.
//  Import from here — never define mechanism data anywhere else.
// ─────────────────────────────────────────────────────────────────

/* ── Color tiers ── */
export const C_GOLD   = '#c5a059';   // devotion / tribute / worship
export const C_SILVER = '#8a8a9a';   // discipline / routine / effort
export const C_RED    = '#8b0000';   // punishment / intensity / sacrifice
export const C_BLACK  = '#555555';   // chance / random / unknown

/* ── Mechanism type definition ── */
export interface MechDef {
    id:    string;
    name:  string;
    icon:  string;
    color: string;
    label: string;        // display label (may differ from name)
    desc:  string;
}

/* ── Full mechanism list ──
   This is THE list. Every mechanism in the app lives here. */
export const MECH_LIST: MechDef[] = [
    { id: 'spin_wheel',       name: 'Spin Wheel',         icon: '◎',  color: C_BLACK,  label: 'Spin the Wheel',    desc: 'Spin the wheel of fate. Whatever it lands on, you obey.' },
    { id: 'coinflip',         name: 'Coinflip',            icon: '$',  color: C_BLACK,  label: 'Coinflip',          desc: 'Heads or tails — fate decides your punishment or reward. No take-backs.' },
    { id: 'card_pick',        name: 'Card Pick',           icon: '♠',  color: C_BLACK,  label: 'Card Pick',         desc: "Draw a card from Queen's deck. Each card holds a task or consequence. Accept it." },
    { id: 'dice_roll',        name: 'Dice Roll',           icon: '⚄',  color: C_BLACK,  label: 'Dice Roll',         desc: 'Roll the dice. The number determines your punishment intensity.' },
    { id: 'russian_roulette', name: 'Russian Roulette',    icon: '⊕',  color: C_RED,    label: 'Russian Roulette',  desc: 'One chamber holds a penalty. Pull the trigger and hope for the best.' },
    { id: 'quiz',             name: 'Quiz / Riddle',       icon: '❓', color: C_BLACK,  label: 'Quiz',              desc: "Answer Queen's question correctly. Wrong answers have consequences." },
    { id: 'writing',          name: 'Writing Prompt',      icon: '✎',  color: C_GOLD,   label: 'Writing',           desc: 'Write as instructed by Queen. Quality and obedience will be judged.' },
    { id: 'multi_video',      name: 'Multi-Stage Video',   icon: '✶',  color: C_RED,    label: 'Video Proof',       desc: 'Record a video as instructed. Show clear proof of completion.' },
    { id: 'photo_proof',      name: 'Photo Proof',         icon: '✍',  color: C_SILVER, label: 'Photo Proof',       desc: 'Take a clear photo as proof of task completion. No filters.' },
    { id: 'timed_photo',      name: 'Timed Photo',         icon: '◇',  color: C_SILVER, label: 'Timed Photo',       desc: 'Take a photo within the time limit. Speed and obedience matter.' },
    { id: 'ambush_snap',      name: 'Ambush Snap',         icon: '!',  color: C_RED,    label: 'Ambush Snap',       desc: 'Take a photo RIGHT NOW. No preparation, no posing, no delay.' },
    { id: 'endurance',        name: 'Endurance Timer',     icon: '▢',  color: C_SILVER, label: 'Endurance',         desc: 'Endure the challenge for the full duration. Film yourself as proof.' },
    { id: 'greed_game',       name: 'Greed Game',          icon: '↑',  color: C_BLACK,  label: 'Greed Game',        desc: 'Push your luck — the more you risk, the more you could win or lose.' },
    { id: 'truth_dare',       name: 'Truth or Dare',       icon: '?',  color: C_BLACK,  label: 'Truth or Dare',     desc: 'Choose truth or dare. Both will test you. Write your honest response.' },
    { id: 'simon_says',       name: 'Simon Says',          icon: '⚡', color: C_RED,    label: 'Simon Says',        desc: 'Follow the instructions exactly as given. One mistake and you fail.' },
    { id: 'payment',          name: 'Payment / Tribute',   icon: '◆',  color: C_GOLD,   label: 'Payment',           desc: 'Complete the required payment or tribute as ordered.' },
    // ── Non-interactive (self-report / devotion) ──
    { id: 'trial',            name: 'Daily Trial',         icon: '✎',  color: C_GOLD,   label: 'Daily Trial',       desc: 'Your daily written trial. Write from the heart.' },
    { id: 'tribute',          name: 'Tribute',             icon: '★',  color: C_GOLD,   label: 'Tribute',           desc: 'Send your tribute to Queen as ordered.' },
    { id: 'chastity_check',   name: 'Chastity Check',      icon: '◈',  color: C_SILVER, label: 'Chastity Check',    desc: 'Submit photo proof that your device is locked and secure.' },
    { id: 'corner_time',      name: 'Corner Time',         icon: '⏱',  color: C_RED,    label: 'Corner Time',       desc: 'Stand in the corner facing the wall. No phone. No distractions.' },
    { id: 'cold_shower',      name: 'Cold Shower',         icon: '❄',  color: C_RED,    label: 'Cold Shower',       desc: 'Take a cold shower. Film or photograph yourself as proof.' },
    { id: 'silence',          name: 'Silence',             icon: '🤐', color: C_SILVER, label: 'Silence',           desc: 'You are forbidden from messaging today. Endure the silence.' },
    { id: 'journal',          name: 'Journal',             icon: '✎',  color: C_GOLD,   label: 'Journal',           desc: 'Write your daily journal entry as instructed.' },
    { id: 'confession',       name: 'Confession',          icon: '✎',  color: C_GOLD,   label: 'Confession',        desc: 'Confess honestly. Queen sees everything.' },
    { id: 'worship',          name: 'Worship',             icon: '★',  color: C_GOLD,   label: 'Worship',           desc: 'Write a worship message to Queen Karin.' },
    { id: 'gratitude',        name: 'Gratitude',           icon: '★',  color: C_GOLD,   label: 'Gratitude',         desc: 'List what you are grateful for.' },
    { id: 'essay',            name: 'Essay',               icon: '✎',  color: C_GOLD,   label: 'Essay',             desc: 'Write your essay as assigned.' },
    { id: 'lines',            name: 'Lines',               icon: '✎',  color: C_SILVER, label: 'Lines',             desc: 'Write the assigned line repeatedly as punishment.' },
    { id: 'exercise',         name: 'Exercise',            icon: '▢',  color: C_SILVER, label: 'Exercise',          desc: 'Complete the required exercise reps. Photo or video proof required.' },
    { id: 'body_writing',     name: 'Body Writing',        icon: '✍',  color: C_RED,    label: 'Body Writing',      desc: 'Write the required word on your body. Take a clear photo.' },
    { id: 'edge',             name: 'Edge',                icon: '◆',  color: C_RED,    label: 'Edge',              desc: 'Edge as instructed. Do not release. Report when done.' },
    { id: 'denial',           name: 'Denial',              icon: '◆',  color: C_RED,    label: 'Denial',            desc: 'Full denial. No touching for 24 hours. Report compliance.' },
    { id: 'kneel',            name: 'Kneel',               icon: '◇',  color: C_GOLD,   label: 'Kneel',             desc: 'Complete your required kneeling sessions.' },
    { id: 'spin',             name: 'Spin the Wheel',      icon: '♛',  color: C_GOLD,   label: 'Spin the Wheel',    desc: 'Spin the wheel of fate. Whatever it lands on, you obey.' },
];

/* ── Fast lookup by id ── */
export const MECH_BY_ID: Record<string, MechDef> = Object.fromEntries(MECH_LIST.map(m => [m.id, m]));

/* ── MECH_ICON — icon/label/desc map used by MechRunner for rendering ──
   Derived from MECH_LIST so there is no duplication. */
export const MECH_ICON: Record<string, { icon: string; label: string; desc?: string }> = Object.fromEntries(
    MECH_LIST.map(m => [m.id, { icon: m.icon, label: m.label, desc: m.desc }])
);

/* ── Default spin wheel segments (used when no custom config is set) ── */
export const WHEEL_SEGMENTS = [
    { text: 'Edge 3 times. No release.',   type: 'punishment' },
    { text: '+2 days added to sentence',   type: 'punishment' },
    { text: 'Queen grants 50 coins',        type: 'reward'     },
    { text: 'Cold shower proof — 1 hour',  type: 'challenge'  },
    { text: 'Write why you\'re grateful',  type: 'task'       },
    { text: '1 day removed',               type: 'reward'     },
    { text: 'Hold ice 60s — video proof',  type: 'challenge'  },
    { text: 'Nothing happens. Suffer.',    type: 'nothing'    },
];

/* ── Preset configs per mechanism ──
   Keyholders pick one of these when adding a mechanism to a program day.
   Each preset ships a ready-to-use `config` object. */
export const MECH_PRESETS: Record<string, { name: string; desc: string; config: any }[]> = {
    spin_wheel: [
        { name: 'Punishment Roulette', desc: '6 punishments — random fate', config: { label: 'Punishment Roulette', segments: [
            { text: 'Cold shower 60s',       followUpType: 'endurance', followUpDuration: 60 },
            { text: 'Corner time 10min',     followUpType: 'endurance', followUpDuration: 600 },
            { text: 'Write lines x50',       followUpType: 'writing',   followUpPrompt: 'I will obey without question' },
            { text: 'Edge & deny',           followUpType: 'video',     followUpTarget: 1 },
            { text: 'Body writing photo',    followUpType: 'photo',     followUpInstruction: 'Write OWNED on your body' },
            { text: 'Confession essay',      followUpType: 'writing',   followUpPrompt: 'Confess your deepest weakness' },
        ]}},
        { name: 'Reward vs Risk', desc: 'Win coins or get punished', config: { label: 'Reward vs Risk', segments: [
            { text: '+50 coins',             followUpType: 'instant' },
            { text: '+1 day locked',         followUpType: 'instant' },
            { text: 'Skip a task today',     followUpType: 'instant' },
            { text: 'Double next task',      followUpType: 'instant' },
            { text: '+100 coins',            followUpType: 'instant' },
            { text: '3 min cold shower',     followUpType: 'endurance', followUpDuration: 180 },
        ]}},
        { name: 'Writing Wheel', desc: 'Land on a writing task', config: { label: 'Writing Wheel', segments: [
            { text: 'Gratitude list (10)',   followUpType: 'writing', followUpPrompt: 'List 10 things you are grateful for about your Queen' },
            { text: 'Journal entry',         followUpType: 'writing', followUpPrompt: 'Write about your journey today' },
            { text: 'Confession',            followUpType: 'writing', followUpPrompt: 'Confess something you have been hiding' },
            { text: 'Love letter',           followUpType: 'writing', followUpPrompt: 'Write a devotion letter to your Queen' },
            { text: 'Self-reflection',       followUpType: 'writing', followUpPrompt: 'What have you learned about yourself this week?' },
        ]}},
        { name: 'Physical Challenge', desc: 'Random body tasks', config: { label: 'Physical Challenge', segments: [
            { text: '50 pushups',            followUpType: 'video',     followUpTarget: 1 },
            { text: '100 squats',            followUpType: 'video',     followUpTarget: 1 },
            { text: '2 min plank',           followUpType: 'endurance', followUpDuration: 120 },
            { text: 'Cold shower 90s',       followUpType: 'endurance', followUpDuration: 90 },
            { text: '30 burpees',            followUpType: 'video',     followUpTarget: 1 },
            { text: 'Wall sit 3 min',        followUpType: 'endurance', followUpDuration: 180 },
        ]}},
    ],
    coinflip: [
        { name: 'Coins or Lock',       desc: 'Win coins or extend lock',       config: { label: 'Coins or Lock',       headsText: '+50 coins',                                  tailsText: '+1 day locked' }},
        { name: 'Mercy or Punishment', desc: 'Skip a task or double it',        config: { label: 'Mercy or Punishment', headsText: 'Skip one task today',                        tailsText: 'Double your next task' }},
        { name: 'Easy or Hard',        desc: 'Simple writing or endurance',     config: { label: 'Easy or Hard',        headsText: 'Write 5 things you love about Queen',        tailsText: '3 min cold shower on camera' }},
        { name: 'Reward Flip',         desc: 'Small or big reward',             config: { label: 'Reward Flip',         headsText: '+20 coins',                                  tailsText: '+200 coins' }},
        { name: 'Photo or Essay',      desc: 'Proof type decided by fate',      config: { label: 'Photo or Essay',      headsText: 'Submit a devotion selfie',                   tailsText: 'Write a 200-word essay on obedience' }},
    ],
    card_pick: [
        { name: 'Devotion Deck', desc: 'Worship & gratitude tasks', config: { label: 'Devotion Deck', cards: [
            { text: 'Write a worship message',   followUpType: 'writing', followUpPrompt: 'Express your devotion in at least 100 words' },
            { text: 'Gratitude list (10 items)', followUpType: 'writing', followUpPrompt: 'List 10 things you are grateful for' },
            { text: 'Devotion photo',            followUpType: 'photo',   followUpInstruction: 'Photo showing your devotion pose' },
            { text: 'Journal entry',             followUpType: 'writing', followUpPrompt: 'Reflect on your obedience today' },
            { text: 'Tribute 10 coins',          followUpType: 'instant' },
        ]}},
        { name: 'Punishment Deck', desc: 'Random punishment cards', config: { label: 'Punishment Deck', cards: [
            { text: 'Cold shower 2 min',         followUpType: 'endurance', followUpDuration: 120 },
            { text: 'Edge and deny',             followUpType: 'video',     followUpTarget: 1 },
            { text: 'Corner time 15 min',        followUpType: 'endurance', followUpDuration: 900 },
            { text: 'Write lines x100',          followUpType: 'writing',   followUpPrompt: 'I exist to serve and obey' },
            { text: 'Body writing: SLAVE',       followUpType: 'photo',     followUpInstruction: 'Write SLAVE on your chest and photograph' },
            { text: '75 pushups on camera',      followUpType: 'video',     followUpTarget: 1 },
        ]}},
        { name: 'Mixed Fate', desc: 'Rewards and punishments mixed', config: { label: 'Mixed Fate', cards: [
            { text: '+100 coins!',               followUpType: 'instant' },
            { text: 'Cold shower 60s',           followUpType: 'endurance', followUpDuration: 60 },
            { text: 'Skip next task',            followUpType: 'instant' },
            { text: 'Write 200-word confession', followUpType: 'writing',   followUpPrompt: 'Confess your failures this week' },
            { text: '+1 day locked',             followUpType: 'instant' },
            { text: '-1 day off lock!',          followUpType: 'instant' },
        ]}},
    ],
    dice_roll: [
        { name: 'Punishment Dice', desc: '6 punishments, 1 per face', config: { label: 'Punishment Dice', outcomes: [
            { text: 'Write lines x30',         followUpType: 'writing',   followUpPrompt: 'I will never disobey' },
            { text: 'Cold shower 60s',         followUpType: 'endurance', followUpDuration: 60 },
            { text: 'Edge 3 times on camera',  followUpType: 'video',     followUpTarget: 3 },
            { text: 'Corner time 10 min',      followUpType: 'endurance', followUpDuration: 600 },
            { text: 'Body writing photo',      followUpType: 'photo',     followUpInstruction: 'Write OBEY on your body' },
            { text: '50 pushups on camera',    followUpType: 'video',     followUpTarget: 1 },
        ]}},
        { name: 'Time Multiplier', desc: 'Roll decides duration', config: { label: 'Time Multiplier', outcomes: [
            { text: '1 minute endurance',  followUpType: 'endurance', followUpDuration: 60 },
            { text: '2 minutes endurance', followUpType: 'endurance', followUpDuration: 120 },
            { text: '3 minutes endurance', followUpType: 'endurance', followUpDuration: 180 },
            { text: '4 minutes endurance', followUpType: 'endurance', followUpDuration: 240 },
            { text: '5 minutes endurance', followUpType: 'endurance', followUpDuration: 300 },
            { text: '10 minutes endurance',followUpType: 'endurance', followUpDuration: 600 },
        ]}},
        { name: 'Coin Dice', desc: 'Roll for coin reward', config: { label: 'Coin Dice', outcomes: [
            { text: '+10 coins',          followUpType: 'instant' },
            { text: '+20 coins',          followUpType: 'instant' },
            { text: '+30 coins',          followUpType: 'instant' },
            { text: '+50 coins',          followUpType: 'instant' },
            { text: '+100 coins!',        followUpType: 'instant' },
            { text: 'NOTHING — lost it all', followUpType: 'instant' },
        ]}},
    ],
    russian_roulette: [
        { name: 'Classic',           desc: '6 chambers, 1 loaded',  config: { label: 'Russian Roulette' }},
        { name: 'Punishment Shot',   desc: 'Loaded = cold shower',   config: { label: 'Punishment Roulette', punishment: 'Cold shower 2 minutes' }},
        { name: 'Lock Extension',    desc: 'Loaded = +3 days',       config: { label: 'Lock Roulette',       punishment: '+3 days added to lock' }},
    ],
    quiz: [
        { name: 'Obedience Rules', desc: 'Test knowledge of the rules',     config: { label: 'Obedience Quiz',  question: 'What is the first rule of service?',                                    answers: ['Always obey immediately', 'Ask questions first', 'Negotiate terms', 'Wait for instructions'], correctIdx: 0, timeLimit: 30 }},
        { name: 'Devotion Test',   desc: 'How well do you know your Queen?', config: { label: 'Devotion Quiz',  question: 'What is the most important quality in a devoted servant?',              answers: ['Consistency', 'Obedience', 'Patience', 'All of the above'], correctIdx: 3, timeLimit: 45 }},
        { name: 'Protocol Check',  desc: 'Do you know proper protocol?',    config: { label: 'Protocol Quiz',  question: 'When addressed by your Queen, what is the correct first response?',    answers: ['Yes, my Queen', 'What do you need?', 'Hello', 'One moment'], correctIdx: 0, timeLimit: 20 }},
    ],
    writing: [
        { name: 'Daily Journal',          desc: 'Reflect on the day',       config: { label: 'Daily Journal',           prompt: 'Write about your service today. What did you do well? Where can you improve?',                       minWords: 100 }},
        { name: 'Gratitude Letter',       desc: '10 things grateful for',   config: { label: 'Gratitude Letter',        prompt: 'List and explain 10 things you are grateful for about your Queen and your dynamic',                  minWords: 150 }},
        { name: 'Confession',             desc: 'Honest confession',        config: { label: 'Confession',              prompt: 'Confess something you have been holding back. Be completely honest.',                                minWords: 80  }},
        { name: 'Devotion Essay',         desc: 'Why you serve',            config: { label: 'Devotion Essay',          prompt: 'Write about why you chose to serve and what it means to you. Be vulnerable.',                       minWords: 200 }},
        { name: 'Punishment Reflection',  desc: 'Reflect on discipline',    config: { label: 'Punishment Reflection',   prompt: 'Reflect on your recent punishment. What did you learn? How will you be better?',                     minWords: 100 }},
        { name: 'Rules Recitation',       desc: 'Write out the rules',      config: { label: 'Rules Recitation',        prompt: 'Write out every rule you must follow, and explain why each one matters.',                           minWords: 150 }},
        { name: 'Write Lines',            desc: 'Repetitive obedience',     config: { label: 'Write Lines',             prompt: 'I will obey my Queen without hesitation.',                                                          minWords: 50  }},
    ],
    multi_video: [
        { name: 'Edge Series',    desc: 'Record multiple edges',       config: { label: 'Edge Series',    instruction: 'Record yourself edging. Each recording = 1 edge. Stay on camera.',           target: 3 }},
        { name: 'Exercise Proof', desc: 'Multi-set workout video',     config: { label: 'Exercise Proof', instruction: 'Record each exercise set separately. Full form visible on camera.',           target: 3 }},
        { name: 'Devotion Clips', desc: 'Multiple worship recordings', config: { label: 'Devotion Clips', instruction: 'Record a devotion message in each clip. Say what you are grateful for.',     target: 2 }},
    ],
    photo_proof: [
        { name: 'Body Writing',   desc: 'Write a word on body',    config: { label: 'Body Writing Photo', instruction: 'Write OWNED on your body clearly and photograph it' }},
        { name: 'Devotion Selfie',desc: 'On your knees',           config: { label: 'Devotion Selfie',    instruction: 'Take a photo on your knees, head bowed, showing devotion' }},
        { name: 'Chastity Proof', desc: 'Prove device is on',      config: { label: 'Chastity Proof',     instruction: 'Photograph your chastity device clearly showing it is locked' }},
        { name: 'Clean Space',    desc: 'Prove area is clean',     config: { label: 'Clean Space Photo',  instruction: 'Photograph your cleaned living space — bed made, floor clear' }},
        { name: 'Outfit Check',   desc: 'Show required outfit',    config: { label: 'Outfit Check',       instruction: 'Show your full outfit as instructed by your Queen' }},
    ],
    timed_photo: [
        { name: 'Morning Check-in', desc: 'Photo within 5 min of waking', config: { label: 'Morning Check-in', instruction: 'Take a photo within 5 minutes of your alarm. Show you are awake and ready to serve.' }},
        { name: 'Surprise Snap',    desc: 'Photo right now',              config: { label: 'Surprise Snap',    instruction: 'Take a photo of exactly what you are doing right now. No preparation allowed.' }},
        { name: 'Pose on Command',  desc: 'Strike the required pose',     config: { label: 'Pose on Command',  instruction: 'Get on your knees, hands behind your back, head bowed. Photo within 60 seconds.' }},
    ],
    ambush_snap: [
        { name: 'Light Surveillance', desc: '3 random snaps',             config: { label: 'Light Surveillance', target: 3  }},
        { name: 'Heavy Watch',        desc: '6 random snaps',             config: { label: 'Heavy Surveillance', target: 6  }},
        { name: 'Full Monitoring',    desc: '10 snaps throughout the day',config: { label: 'Full Monitoring',    target: 10 }},
    ],
    endurance: [
        { name: 'Cold Shower 60s',    desc: '1 minute cold shower',    config: { label: 'Cold Shower',          instruction: 'Stand under cold water. Camera must show water running on you.',             duration: 60,  target: 60  }},
        { name: 'Cold Shower 3min',   desc: '3 minute cold shower',    config: { label: 'Cold Shower Extended', instruction: 'Full 3 minutes under cold water. No breaks. Camera on.',                    duration: 180, target: 180 }},
        { name: 'Corner Time 10min',  desc: 'Stand in corner',         config: { label: 'Corner Time',          instruction: 'Stand in the corner, nose touching the wall, hands behind your back.',     duration: 600, target: 600 }},
        { name: 'Plank Hold',         desc: '2 min plank on camera',   config: { label: 'Plank Hold',           instruction: 'Hold a plank position. Proper form. Camera shows full body.',               duration: 120, target: 120 }},
        { name: 'Wall Sit',           desc: '3 min wall sit',          config: { label: 'Wall Sit',             instruction: 'Wall sit position, thighs parallel to floor. No cheating.',                duration: 180, target: 180 }},
        { name: 'Kneeling Hold',      desc: '5 min kneeling still',    config: { label: 'Kneeling Hold',        instruction: 'Kneel perfectly still, hands on thighs, head bowed. Do not move.',          duration: 300, target: 300 }},
    ],
    greed_game: [
        { name: 'Low Stakes',    desc: 'Max 20 coins',  config: { label: 'Greed Game',       ceiling: 20  }},
        { name: 'Medium Stakes', desc: 'Max 50 coins',  config: { label: 'Greed Game',       ceiling: 50  }},
        { name: 'High Stakes',   desc: 'Max 200 coins', config: { label: 'High Stakes Greed',ceiling: 200 }},
    ],
    truth_dare: [
        { name: 'Confession or Challenge', desc: 'Write confession or physical task', config: { label: 'Truth or Dare',    truthText: 'Write a 150-word confession about your deepest fantasy',         truthFollowUp: 'writing', dareText: '2 minute cold shower on camera',            dareFollowUp: 'endurance' }},
        { name: 'Reveal or Endure',        desc: 'Share a secret or suffer',          config: { label: 'Reveal or Endure', truthText: 'Reveal something embarrassing about yourself in writing',         truthFollowUp: 'writing', dareText: '3 min plank hold on camera',                dareFollowUp: 'endurance' }},
        { name: 'Words or Proof',          desc: 'Essay or photo proof',              config: { label: 'Words or Proof',   truthText: 'Why do you need to be controlled? 200 words.',                  truthFollowUp: 'writing', dareText: 'Body writing photo — write PROPERTY on your chest', dareFollowUp: 'photo' }},
    ],
    simon_says: [
        { name: 'Quick Obedience', desc: '3 fast tasks, 30s each', config: { label: 'Quick Obedience', intervalMinutes: 60, chainTasks: [
            { text: 'Drop and do 10 pushups',               timeLimit: 30, proofType: 'video' },
            { text: 'Take a selfie on your knees',          timeLimit: 30, proofType: 'photo' },
            { text: 'Write "I obey" 5 times — photo of it', timeLimit: 30, proofType: 'photo' },
        ]}},
        { name: 'Endurance Chain', desc: '4 longer tasks', config: { label: 'Endurance Chain', intervalMinutes: 120, chainTasks: [
            { text: 'Hold plank position',      timeLimit: 60, proofType: 'video' },
            { text: '20 squats — go',           timeLimit: 45, proofType: 'video' },
            { text: 'Wall sit — hold it',       timeLimit: 60, proofType: 'video' },
            { text: '15 burpees — no breaks',   timeLimit: 60, proofType: 'video' },
        ]}},
        { name: 'Devotion Drill', desc: 'Rapid devotion tasks', config: { label: 'Devotion Drill', intervalMinutes: 90, chainTasks: [
            { text: 'Say "I serve my Queen" out loud 5 times', timeLimit: 20, proofType: 'video' },
            { text: 'Bow your head and count to 10',           timeLimit: 15, proofType: 'video' },
            { text: 'Write 3 things you are grateful for',     timeLimit: 45, proofType: 'photo' },
            { text: 'Photo of yourself in devotion pose',      timeLimit: 30, proofType: 'photo' },
        ]}},
    ],
    payment: [
        { name: 'Small Tribute',     desc: '5 coins',    config: { label: 'Small Tribute',    amount: 5,   target: 5   }},
        { name: 'Standard Tribute',  desc: '10 coins',   config: { label: 'Tribute',          amount: 10,  target: 10  }},
        { name: 'Heavy Tribute',     desc: '25 coins',   config: { label: 'Heavy Tribute',    amount: 25,  target: 25  }},
        { name: 'Grand Tribute',     desc: '50 coins',   config: { label: 'Grand Tribute',    amount: 50,  target: 50  }},
        { name: 'Ultimate Offering', desc: '100 coins',  config: { label: 'Ultimate Offering',amount: 100, target: 100 }},
    ],
};
