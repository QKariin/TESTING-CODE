// ─────────────────────────────────────────────────────────────────
//  CENTRAL MECHANISM DATABASE
//  Single source of truth for every interactive mechanism in the app.
//  Import from here. never define mechanism data anywhere else.
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
    { id: 'coinflip',         name: 'Coinflip',            icon: '$',  color: C_BLACK,  label: 'Coinflip',          desc: 'Heads or tails. fate decides your punishment or reward. No take-backs.' },
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
    { id: 'greed_game',       name: 'Greed Game',          icon: '↑',  color: C_BLACK,  label: 'Greed Game',        desc: 'Push your luck. the more you risk, the more you could win or lose.' },
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

/* ── Proof types. what a follow-up task can require ──
   This is the single definition of proof requirements.
   The overlay reads from here. nothing is hardcoded in the UI. */
export const PROOF_TYPES: Record<string, { label: string; accept: string; capture: boolean; isVideo: boolean; isWriting: boolean; isInstant: boolean }> = {
    photo:   { label: 'PHOTO REQUIRED',          accept: 'image/*',       capture: true,  isVideo: false, isWriting: false, isInstant: false },
    video:   { label: 'VIDEO REQUIRED',           accept: 'video/*',       capture: true,  isVideo: true,  isWriting: false, isInstant: false },
    writing: { label: 'WRITTEN RESPONSE',         accept: '',              capture: false, isVideo: false, isWriting: true,  isInstant: false },
    instant: { label: 'MARK AS COMPLETE',         accept: '',              capture: false, isVideo: false, isWriting: false, isInstant: true  },
};

/* ── Fast lookup by id ── */
export const MECH_BY_ID: Record<string, MechDef> = Object.fromEntries(MECH_LIST.map(m => [m.id, m]));

/* ── MECH_ICON. icon/label/desc map used by MechRunner for rendering ──
   Derived from MECH_LIST so there is no duplication. */
export const MECH_ICON: Record<string, { icon: string; label: string; desc?: string }> = Object.fromEntries(
    MECH_LIST.map(m => [m.id, { icon: m.icon, label: m.label, desc: m.desc }])
);

/* ── Default spin wheel segments (used when no custom config is set) ── */
export const WHEEL_SEGMENTS = [
    { text: 'Edge 3 times. No release.',   type: 'punishment' },
    { text: '+2 days added to sentence',   type: 'punishment' },
    { text: 'Queen grants 50 coins',        type: 'reward'     },
    { text: 'Cold shower proof. 1 hour',  type: 'challenge'  },
    { text: 'Write why you\'re grateful',  type: 'task'       },
    { text: '1 day removed',               type: 'reward'     },
    { text: 'Hold ice 60s. video proof',  type: 'challenge'  },
    { text: 'Nothing happens. Suffer.',    type: 'nothing'    },
];

/* ── Preset configs per mechanism ──
   Keyholders pick one of these when adding a mechanism to a program day.
   Each preset ships a ready-to-use `config` object. */
export const MECH_PRESETS: Record<string, { name: string; desc: string; config: any }[]> = {
    spin_wheel: [
        // ── PUNISHMENT ──
        { name: 'Punishment Roulette',   desc: '6 punishments. random fate',       config: { label: 'Punishment Roulette', segments: [
            { text: 'Cold shower 60s',                followUpType: 'endurance', followUpDuration: 60  },
            { text: 'Corner time 10 minutes',         followUpType: 'endurance', followUpDuration: 600 },
            { text: 'Write lines x50: I will obey',  followUpType: 'writing',   followUpPrompt: 'Write this line 50 times: I will obey without question' },
            { text: 'Edge & deny. on camera',        followUpType: 'video',     followUpTarget: 1 },
            { text: 'Body writing: OWNED',            followUpType: 'photo',     followUpInstruction: 'Write OWNED on your body clearly and photograph it' },
            { text: 'Confession essay',               followUpType: 'writing',   followUpPrompt: 'Confess your deepest weakness in at least 150 words' },
        ]}},
        { name: 'Discipline Wheel',      desc: 'Escalating discipline tasks',       config: { label: 'Discipline Wheel', segments: [
            { text: '100 squats on camera',           followUpType: 'video',     followUpTarget: 1 },
            { text: 'Cold shower 3 min',              followUpType: 'endurance', followUpDuration: 180 },
            { text: 'Write 100 lines: I am property', followUpType: 'writing',   followUpPrompt: 'Write this line 100 times: I am property and I have no say' },
            { text: 'Corner time 20 min',             followUpType: 'endurance', followUpDuration: 1200 },
            { text: 'Body writing: PUNISHED',         followUpType: 'photo',     followUpInstruction: 'Write PUNISHED on your chest and send a clear photo' },
            { text: '50 pushups + plank 2 min',       followUpType: 'video',     followUpTarget: 1 },
        ]}},
        // ── CHASTITY ──
        { name: 'Chastity Control',      desc: 'Denial & device tasks',             config: { label: 'Chastity Control', segments: [
            { text: 'Device check photo. now',       followUpType: 'photo',     followUpInstruction: 'Photograph your chastity device showing it is locked and secure' },
            { text: 'Edge 3 times. No release.',      followUpType: 'video',     followUpTarget: 3 },
            { text: '+1 day added to sentence',       followUpType: 'add_day',   followUpAmount: 1 },
            { text: 'Confess your horniest thought',  followUpType: 'writing',   followUpPrompt: 'Write out your most desperate thought right now. Be honest.' },
            { text: 'Edge 5 times. No release.',      followUpType: 'video',     followUpTarget: 5 },
            { text: '-1 day. Queen is merciful',     followUpType: 'remove_day',followUpAmount: 1 },
        ]}},
        { name: 'Denial Roulette',       desc: 'Edging & suffering by chance',      config: { label: 'Denial Roulette', segments: [
            { text: 'Edge 1 time',                    followUpType: 'instant' },
            { text: 'Edge 3 times. no release',      followUpType: 'video',     followUpTarget: 3 },
            { text: 'Edge 5 times. Video each.', followUpType: 'video',     followUpTarget: 5 },
            { text: 'No touching for 24 hours',       followUpType: 'instant' },
            { text: 'Ruined orgasm. Video proof.',    followUpType: 'video',     followUpTarget: 1 },
            { text: 'Edge + wear ice pack after',     followUpType: 'video',     followUpTarget: 1 },
        ]}},
        // ── DEVOTION ──
        { name: 'Devotion Wheel',        desc: 'Worship & gratitude tasks',         config: { label: 'Devotion Wheel', segments: [
            { text: 'Write a worship letter',         followUpType: 'writing',   followUpPrompt: 'Write a heartfelt worship letter to your Queen. At least 150 words.' },
            { text: 'Gratitude list (10 items)',      followUpType: 'writing',   followUpPrompt: 'List 10 specific things you are grateful for about your Queen and this dynamic' },
            { text: 'Kneeling devotion photo',        followUpType: 'photo',     followUpInstruction: 'Kneel, head bowed, hands on knees. Take a photo showing your devotion.' },
            { text: 'Journal: what service means',    followUpType: 'writing',   followUpPrompt: 'Write about what service means to you today. Be vulnerable and honest.' },
            { text: 'Say your affirmation 10x video', followUpType: 'video',     followUpTarget: 1 },
            { text: 'Write 5 rules you live by',      followUpType: 'writing',   followUpPrompt: 'Write the 5 most important rules of your service and why each one matters.' },
        ]}},
        { name: 'Service Roulette',      desc: 'Daily service tasks',               config: { label: 'Service Roulette', segments: [
            { text: 'Morning selfie: show readiness', followUpType: 'photo',    followUpInstruction: 'Photograph yourself ready to serve: clean, presentable, kneeling' },
            { text: 'Confess one failure today',       followUpType: 'writing',  followUpPrompt: 'Confess one thing you failed at or could have done better today. No excuses.' },
            { text: 'Clean your space. Photo proof.',  followUpType: 'photo',    followUpInstruction: 'Clean your bedroom/living area and photograph the result' },
            { text: 'Write why you need control',      followUpType: 'writing',  followUpPrompt: 'Write about why you need to be controlled and what happens when you are not. 100 words minimum.' },
            { text: '+50 coins reward',                followUpType: 'add_coins',followUpAmount: 50 },
            { text: 'Self-reflection essay',           followUpType: 'writing',  followUpPrompt: 'Reflect on your obedience this week. What improved? What failed? What will change?' },
        ]}},
        // ── REWARD ──
        { name: 'Reward vs Risk',        desc: 'Win coins or get punished',         config: { label: 'Reward vs Risk', segments: [
            { text: '+50 coins',                      followUpType: 'add_coins', followUpAmount: 50  },
            { text: '+1 day locked',                  followUpType: 'add_day',   followUpAmount: 1 },
            { text: 'Skip a task today',              followUpType: 'instant' },
            { text: 'Double next task',               followUpType: 'instant' },
            { text: '+150 coins',                     followUpType: 'add_coins', followUpAmount: 150 },
            { text: '3 min cold shower. proof',      followUpType: 'endurance', followUpDuration: 180 },
        ]}},
        { name: 'Fortune & Misfortune',  desc: 'High stakes. big win or big loss', config: { label: 'Fortune & Misfortune', segments: [
            { text: '+300 coins. you lucky thing',   followUpType: 'add_coins', followUpAmount: 300 },
            { text: '+3 days locked. bad luck',      followUpType: 'add_day',   followUpAmount: 3 },
            { text: '+1 skip pass awarded',           followUpType: 'add_skippass', followUpAmount: 1 },
            { text: '-1 day off your sentence',       followUpType: 'remove_day',followUpAmount: 1 },
            { text: 'Cold shower 5 min. Suffer.',     followUpType: 'endurance', followUpDuration: 300 },
            { text: '+500 coins. jackpot',           followUpType: 'add_coins', followUpAmount: 500 },
        ]}},
        // ── WRITING ──
        { name: 'Writing Wheel',         desc: 'Land on a writing task',            config: { label: 'Writing Wheel', segments: [
            { text: 'Gratitude list (10)',            followUpType: 'writing', followUpPrompt: 'List 10 specific things you are grateful for about your Queen' },
            { text: 'Daily journal entry',            followUpType: 'writing', followUpPrompt: 'Write about your day, your feelings, and your service. Minimum 100 words.' },
            { text: 'Confession: be honest',         followUpType: 'writing', followUpPrompt: 'Confess something you have been hiding or are ashamed of. No holding back.' },
            { text: 'Love letter to your Queen',      followUpType: 'writing', followUpPrompt: 'Write a heartfelt devotion letter. Tell her what she means to you.' },
            { text: 'Self-reflection on obedience',  followUpType: 'writing', followUpPrompt: 'What have you learned about yourself and your obedience this week?' },
            { text: 'Rules recitation essay',         followUpType: 'writing', followUpPrompt: 'Write out every rule you live by and explain why each one matters to you.' },
        ]}},
        // ── PHYSICAL ──
        { name: 'Physical Challenge',    desc: 'Random body tasks',                 config: { label: 'Physical Challenge', segments: [
            { text: '50 pushups on camera',           followUpType: 'video',     followUpTarget: 1 },
            { text: '100 squats on camera',           followUpType: 'video',     followUpTarget: 1 },
            { text: '2 min plank hold',               followUpType: 'endurance', followUpDuration: 120 },
            { text: 'Cold shower 90 seconds',         followUpType: 'endurance', followUpDuration: 90  },
            { text: '30 burpees. no rest',           followUpType: 'video',     followUpTarget: 1 },
            { text: 'Wall sit 3 minutes',             followUpType: 'endurance', followUpDuration: 180 },
        ]}},
        { name: 'Extreme Physical',      desc: 'Brutal physical punishments',       config: { label: 'Extreme Physical', segments: [
            { text: '150 squats. go',                followUpType: 'video',     followUpTarget: 1 },
            { text: 'Cold shower 5 minutes',          followUpType: 'endurance', followUpDuration: 300 },
            { text: '75 pushups then wall sit 2min',  followUpType: 'video',     followUpTarget: 1 },
            { text: '20 burpees. film each set',     followUpType: 'video',     followUpTarget: 1 },
            { text: '4 min plank. no dropping',      followUpType: 'endurance', followUpDuration: 240 },
            { text: 'Kneel 30 min. no movement',     followUpType: 'endurance', followUpDuration: 1800 },
        ]}},
        // ── HUMILIATION ──
        { name: 'Humiliation Wheel',     desc: 'Degrading tasks by chance',         config: { label: 'Humiliation Wheel', segments: [
            { text: 'Body writing: PROPERTY',         followUpType: 'photo',   followUpInstruction: 'Write PROPERTY across your chest in bold letters and photograph it' },
            { text: 'Corner time 15min. photo proof',followUpType: 'photo',   followUpInstruction: 'Stand in the corner nose to wall for 15 minutes, photograph the end result' },
            { text: 'Body writing: SLAVE',            followUpType: 'photo',   followUpInstruction: 'Write SLAVE across your body. make it clear and legible in the photo' },
            { text: 'Write 50 lines: I am nothing',   followUpType: 'writing', followUpPrompt: 'Write this line 50 times: I am nothing without my Queen\'s control' },
            { text: 'Confession of shame',            followUpType: 'writing', followUpPrompt: 'Write about something shameful or embarrassing. be completely honest. No hiding.' },
            { text: 'Body writing: DENIED',           followUpType: 'photo',   followUpInstruction: 'Write DENIED across your stomach and photograph it clearly' },
        ]}},
    ],
    coinflip: [
        { name: 'Mercy or Wrath',        desc: 'Queen spares or strikes',         config: { label: 'Mercy or Wrath',        headsText: 'Queen shows mercy. Skip one task today',      headsFollowUpType: 'instant',        tailsText: '+2 days locked. No appeal.',                           tailsFollowUpType: 'add_day',      tailsFollowUpAmount: 2 }},
        { name: 'Coin or Cage',          desc: 'Coins vs extra lock days',        config: { label: 'Coin or Cage',          headsText: '+150 coins',                                   headsFollowUpType: 'add_coins',      headsFollowUpAmount: 150,  tailsText: '+3 days locked',                               tailsFollowUpType: 'add_day',      tailsFollowUpAmount: 3 }},
        { name: 'Freedom Flip',          desc: 'Day removed or added',            config: { label: 'Freedom Flip',          headsText: '-1 day off your lock',                         headsFollowUpType: 'remove_day',     headsFollowUpAmount: 1,    tailsText: '+2 days. you don\'t deserve freedom',         tailsFollowUpType: 'add_day',      tailsFollowUpAmount: 2 }},
        { name: 'Jackpot or Sentence',   desc: 'Big reward or brutal extension',  config: { label: 'Jackpot or Sentence',   headsText: '+500 coins. fate rewards you',                headsFollowUpType: 'add_coins',      headsFollowUpAmount: 500,  tailsText: '+7 days locked. you gambled and lost',        tailsFollowUpType: 'add_day',      tailsFollowUpAmount: 7 }},
        { name: 'Bad or Worse',          desc: 'Two punishments. one is worse',  config: { label: 'Bad or Worse',          headsText: 'Cold shower 3 minutes. Photograph. proof',     headsFollowUpType: 'photo',          tailsText: 'Cold shower 5 minutes on camera, no stopping',         tailsFollowUpType: 'video' }},
        { name: 'Sin & Penance',         desc: 'Confession or marked',            config: { label: 'Sin & Penance',         headsText: 'Write a 200-word confession of your failures', headsFollowUpType: 'writing',         tailsText: 'Write PROPERTY on your body and photograph it',        tailsFollowUpType: 'photo' }},
        { name: 'Suffer or Suffer More', desc: 'Pain vs greater pain',            config: { label: 'Suffer or Suffer More', headsText: '50 squats. report when done',                 headsFollowUpType: 'instant',        tailsText: '100 squats on camera, no breaks',                      tailsFollowUpType: 'video' }},
        { name: 'Crown or Cross',        desc: 'Reward vs sacrifice',             config: { label: 'Crown or Cross',        headsText: '+200 coins. Queen is pleased',                headsFollowUpType: 'add_coins',      headsFollowUpAmount: 200,  tailsText: '15 minutes corner time, nose to wall. Photograph.', tailsFollowUpType: 'photo' }},
        { name: 'Devotion Flip',         desc: 'Write or kneel for Queen',        config: { label: 'Devotion Flip',         headsText: 'Write 10 reasons you worship Queen',           headsFollowUpType: 'writing',         tailsText: 'Kneel for 20 minutes and submit proof photo',          tailsFollowUpType: 'photo' }},
        { name: 'All or Nothing',        desc: 'Double reward or double penalty', config: { label: 'All or Nothing',        headsText: '+300 coins. fate smiles on you.',              headsFollowUpType: 'add_coins',      headsFollowUpAmount: 300,  tailsText: '+2 days locked + edge 5 times, no release',    tailsFollowUpType: 'add_day',      tailsFollowUpAmount: 2 }},
    ],
    card_pick: [
        // ── DEVOTION ──
        { name: 'Devotion Deck',      desc: 'Worship & gratitude tasks',           config: { label: 'Devotion Deck', cards: [
            { text: 'Write a worship message',          followUpType: 'writing', followUpPrompt: 'Express your devotion to your Queen in at least 100 words' },
            { text: 'Gratitude list (10 items)',        followUpType: 'writing', followUpPrompt: 'List 10 things you are genuinely grateful for about your Queen and your dynamic' },
            { text: 'Devotion selfie: on your knees',  followUpType: 'photo',   followUpInstruction: 'Kneel, head bowed, hands on thighs. Photograph your devotion.' },
            { text: 'Journal: obedience reflection',   followUpType: 'writing', followUpPrompt: 'Reflect honestly on your obedience today. What was hard? What felt right?' },
            { text: 'Write why you need control',       followUpType: 'writing', followUpPrompt: 'Explain in your own words why you need to be controlled. Be vulnerable.' },
            { text: 'Say affirmation 10x on video',      followUpType: 'video',   followUpTarget: 1 },
        ]}},
        // ── PUNISHMENT ──
        { name: 'Punishment Deck',    desc: 'Random punishment cards',             config: { label: 'Punishment Deck', cards: [
            { text: 'Cold shower 2 minutes',            followUpType: 'endurance', followUpDuration: 120 },
            { text: 'Edge 3 times. Deny yourself.',     followUpType: 'video',     followUpTarget: 3 },
            { text: 'Corner time 15 minutes',           followUpType: 'endurance', followUpDuration: 900 },
            { text: 'Write 100 lines: I exist to obey', followUpType: 'writing',   followUpPrompt: 'Write this line 100 times: I exist to serve and obey without question' },
            { text: 'Body writing: SLAVE',              followUpType: 'photo',     followUpInstruction: 'Write SLAVE on your chest in bold letters and photograph it clearly' },
            { text: '75 pushups on camera',             followUpType: 'video',     followUpTarget: 1 },
        ]}},
        // ── CHASTITY ──
        { name: 'Chastity Control Deck', desc: 'Device, denial & lock tasks',     config: { label: 'Chastity Control', cards: [
            { text: 'Device check. photo now',         followUpType: 'photo',     followUpInstruction: 'Photograph your chastity device right now. locked and secure, clearly visible' },
            { text: '+1 day added to your sentence',    followUpType: 'add_day',   followUpAmount: 1 },
            { text: 'Edge 5 times. No release. Report.',followUpType: 'video',     followUpTarget: 5 },
            { text: '-1 day. Queen is merciful today', followUpType: 'remove_day',followUpAmount: 1 },
            { text: 'Confess your most desperate urge', followUpType: 'writing',   followUpPrompt: 'Write honestly about the most desperate thought or urge you have had today. No filter.' },
            { text: '+2 days locked. Fate is cruel.',   followUpType: 'add_day',   followUpAmount: 2 },
        ]}},
        // ── OBEDIENCE ──
        { name: 'Obedience Deck',     desc: 'Protocol & service tasks',           config: { label: 'Obedience Deck', cards: [
            { text: 'Kneeling 20 min. photo proof',    followUpType: 'photo',   followUpInstruction: 'Kneel in proper position for 20 minutes. Photograph yourself at the end.' },
            { text: 'Write all your rules from memory', followUpType: 'writing', followUpPrompt: 'Write out every rule you are required to follow, entirely from memory. Miss one and you fail.' },
            { text: 'Report your status now',           followUpType: 'writing', followUpPrompt: 'Write a full status report: where you are, what you are wearing, what you are feeling, your state of mind.' },
            { text: 'Confess one rule you broke',       followUpType: 'writing', followUpPrompt: 'Confess a rule you broke recently. When. Why. What you will do differently.' },
            { text: 'Morning routine photo',            followUpType: 'photo',   followUpInstruction: 'Photograph yourself clean, presentable and ready to serve. No mess visible.' },
            { text: 'Write 50 lines: I must obey',      followUpType: 'writing', followUpPrompt: 'Write this line 50 times: I must obey my Queen immediately and without question' },
        ]}},
        // ── HUMILIATION ──
        { name: 'Humiliation Deck',   desc: 'Marking, corner time & shame',       config: { label: 'Humiliation Deck', cards: [
            { text: 'Body writing: PROPERTY',           followUpType: 'photo',   followUpInstruction: 'Write PROPERTY across your chest in bold. Make it legible. Photograph it.' },
            { text: 'Corner time 20 min. nose to wall',followUpType: 'endurance', followUpDuration: 1200 },
            { text: 'Body writing: DENIED',             followUpType: 'photo',   followUpInstruction: 'Write DENIED across your stomach or thigh. Clear photo required.' },
            { text: 'Confession of deepest shame',      followUpType: 'writing', followUpPrompt: 'Write about something you are deeply ashamed of. No editing, no softening it.' },
            { text: 'Body writing: WORTHLESS',          followUpType: 'photo',   followUpInstruction: 'Write WORTHLESS on your body and photograph it. Hold the photo up so it is clear.' },
            { text: 'Write what you deserve',           followUpType: 'writing', followUpPrompt: 'Write honestly about what you deserve as a servant. Be brutal. Be real.' },
        ]}},
        // ── MIXED ──
        { name: 'Mixed Fate',         desc: 'Rewards and punishments mixed',      config: { label: 'Mixed Fate', cards: [
            { text: '+100 coins. lucky draw',          followUpType: 'add_coins', followUpAmount: 100 },
            { text: 'Cold shower 60 seconds',           followUpType: 'endurance', followUpDuration: 60 },
            { text: 'Skip next task. Queen\'s gift',   followUpType: 'instant' },
            { text: 'Write 200-word confession',        followUpType: 'writing',   followUpPrompt: 'Confess your failures this week. All of them. No excuses.' },
            { text: '+1 day locked',                    followUpType: 'add_day',   followUpAmount: 1 },
            { text: '-1 day off lock',                  followUpType: 'remove_day',followUpAmount: 1 },
        ]}},
        { name: 'Wildcard Deck',      desc: 'Extreme. very good or very bad',    config: { label: 'Wildcard', cards: [
            { text: '+500 coins. jackpot!',            followUpType: 'add_coins', followUpAmount: 500 },
            { text: '+7 days locked. brutal',          followUpType: 'add_day',   followUpAmount: 7 },
            { text: '+1 skip pass awarded',             followUpType: 'add_skippass', followUpAmount: 1 },
            { text: 'Cold shower 5 minutes. no mercy', followUpType: 'endurance', followUpDuration: 300 },
            { text: '-2 days off sentence',             followUpType: 'remove_day',followUpAmount: 2 },
            { text: 'Body writing + 100 lines + essay', followUpType: 'writing',   followUpPrompt: 'You drew the worst card. Write 100 lines (I am nothing without control) AND a 150-word essay on your failures.' },
        ]}},
    ],
    dice_roll: [
        // ── PUNISHMENT ──
        { name: 'Punishment Dice',      desc: '6 punishments, 1 per face',          config: { label: 'Punishment Dice', outcomes: [
            { text: 'Write 30 lines: I will never disobey',  followUpType: 'writing',   followUpPrompt: 'Write this line 30 times: I will never disobey my Queen again' },
            { text: 'Cold shower 60 seconds',                followUpType: 'endurance', followUpDuration: 60 },
            { text: 'Edge 3 times on camera',                followUpType: 'video',     followUpTarget: 3 },
            { text: 'Corner time 10 minutes',                followUpType: 'endurance', followUpDuration: 600 },
            { text: 'Body writing: OBEY',                    followUpType: 'photo',     followUpInstruction: 'Write OBEY on your body in a visible place. Clear photo.' },
            { text: '50 pushups on camera',                  followUpType: 'video',     followUpTarget: 1 },
        ]}},
        { name: 'Humiliation Dice',     desc: 'Face = intensity of shame',          config: { label: 'Humiliation Dice', outcomes: [
            { text: 'Write 20 lines: I am property',         followUpType: 'writing',   followUpPrompt: 'Write this line 20 times: I am property and I obey without question' },
            { text: 'Body writing: OWNED',                   followUpType: 'photo',     followUpInstruction: 'Write OWNED on your body. Photo proof required.' },
            { text: 'Corner time 15 min. nose to wall',     followUpType: 'endurance', followUpDuration: 900 },
            { text: 'Body writing: SLAVE',                   followUpType: 'photo',     followUpInstruction: 'Write SLAVE on your chest. Make it bold. Clear photo.' },
            { text: 'Write 50 lines: I am nothing',          followUpType: 'writing',   followUpPrompt: 'Write this line 50 times: I am nothing without my Queen\'s control' },
            { text: 'Body writing: DENIED + corner time',    followUpType: 'photo',     followUpInstruction: 'Write DENIED on your body, stand in corner 10min, then photograph both.' },
        ]}},
        // ── CHASTITY ──
        { name: 'Chastity Sentence Dice', desc: 'Roll = days added to lock',       config: { label: 'Chastity Sentence', outcomes: [
            { text: '+1 day added to your lock',             followUpType: 'add_day',   followUpAmount: 1 },
            { text: '+2 days added to your lock',            followUpType: 'add_day',   followUpAmount: 2 },
            { text: '+3 days added to your lock',            followUpType: 'add_day',   followUpAmount: 3 },
            { text: '+4 days added to your lock',            followUpType: 'add_day',   followUpAmount: 4 },
            { text: '+5 days. You rolled the worst.',        followUpType: 'add_day',   followUpAmount: 5 },
            { text: '-1 day. Queen is merciful today',      followUpType: 'remove_day',followUpAmount: 1 },
        ]}},
        { name: 'Denial Dice',          desc: 'Face = number of edges required',    config: { label: 'Denial Dice', outcomes: [
            { text: 'Edge 1 time. Deny yourself.',               followUpType: 'instant' },
            { text: 'Edge 2 times. Video each',         followUpType: 'video',   followUpTarget: 2 },
            { text: 'Edge 3 times. No release.',     followUpType: 'video',   followUpTarget: 3 },
            { text: 'Edge 4 times. Suffer.',              followUpType: 'video',   followUpTarget: 4 },
            { text: 'Edge 5 times. No release.',     followUpType: 'video',   followUpTarget: 5 },
            { text: 'No touching for 48 hours. Absolute denial.',followUpType: 'instant' },
        ]}},
        // ── PHYSICAL ──
        { name: 'Physical Intensity',   desc: 'Face = how hard you work',           config: { label: 'Physical Intensity', outcomes: [
            { text: '20 pushups. Warm up.',                  followUpType: 'video',     followUpTarget: 1 },
            { text: '50 squats.',                  followUpType: 'video',     followUpTarget: 1 },
            { text: '2 min plank + 50 pushups',              followUpType: 'video',     followUpTarget: 1 },
            { text: '100 squats + 2 min plank',              followUpType: 'video',     followUpTarget: 1 },
            { text: '75 pushups and 100 squats. Brutal.',      followUpType: 'video',     followUpTarget: 1 },
            { text: '150 squats and 3 min plank. Suffer.',     followUpType: 'video',     followUpTarget: 1 },
        ]}},
        { name: 'Cold Shower Dice',     desc: 'Face = duration in the cold',        config: { label: 'Cold Shower Dice', outcomes: [
            { text: 'Cold shower 30 seconds',                followUpType: 'endurance', followUpDuration: 30  },
            { text: 'Cold shower 60 seconds',                followUpType: 'endurance', followUpDuration: 60  },
            { text: 'Cold shower 90 seconds',                followUpType: 'endurance', followUpDuration: 90  },
            { text: 'Cold shower 2 minutes',                 followUpType: 'endurance', followUpDuration: 120 },
            { text: 'Cold shower 3 minutes',                 followUpType: 'endurance', followUpDuration: 180 },
            { text: 'Cold shower 5 minutes. Full suffer.',   followUpType: 'endurance', followUpDuration: 300 },
        ]}},
        // ── REWARDS ──
        { name: 'Coin Dice',            desc: 'Roll for coin reward',               config: { label: 'Coin Dice', outcomes: [
            { text: '+10 coins',                             followUpType: 'add_coins', followUpAmount: 10  },
            { text: '+25 coins',                             followUpType: 'add_coins', followUpAmount: 25  },
            { text: '+50 coins',                             followUpType: 'add_coins', followUpAmount: 50  },
            { text: '+100 coins',                            followUpType: 'add_coins', followUpAmount: 100 },
            { text: '+200 coins',                            followUpType: 'add_coins', followUpAmount: 200 },
            { text: 'ZERO. Luck ran out.',                   followUpType: 'instant' },
        ]}},
        // ── TIME ──
        { name: 'Time Multiplier',      desc: 'Roll decides duration',              config: { label: 'Time Multiplier', outcomes: [
            { text: '1 minute endurance task',               followUpType: 'endurance', followUpDuration: 60  },
            { text: '2 minutes endurance task',              followUpType: 'endurance', followUpDuration: 120 },
            { text: '3 minutes endurance task',              followUpType: 'endurance', followUpDuration: 180 },
            { text: '4 minutes endurance task',              followUpType: 'endurance', followUpDuration: 240 },
            { text: '5 minutes endurance task',              followUpType: 'endurance', followUpDuration: 300 },
            { text: '10 minutes. You rolled your fate.',     followUpType: 'endurance', followUpDuration: 600 },
        ]}},
    ],
    russian_roulette: [
        // CLASSIC
        { name: 'Classic',               desc: '6 chambers, 1 loaded',           config: { label: 'Russian Roulette' }},
        // PUNISHMENT
        { name: 'Cold Shower Shot',      desc: 'Loaded = cold shower 2 min',      config: { label: 'Punishment Roulette',  punishment: 'Cold shower 2 minutes on camera. No stopping.' }},
        { name: 'Extreme Cold',          desc: 'Loaded = cold shower 5 min',      config: { label: 'Extreme Roulette',     punishment: 'Cold shower 5 full minutes. Film the whole thing.' }},
        { name: 'Physical Shot',         desc: 'Loaded = brutal exercise',        config: { label: 'Physical Roulette',    punishment: '100 squats then 2 minute plank. Video proof required.' }},
        { name: 'Corner Time Shot',      desc: 'Loaded = corner time 20 min',     config: { label: 'Corner Roulette',      punishment: 'Corner time 20 minutes. Nose to wall. Hands behind back. No phone.' }},
        // CHASTITY
        { name: 'Lock Extension',        desc: 'Loaded = +3 days',               config: { label: 'Lock Roulette',        punishment: '+3 days added to your sentence. No negotiation.' }},
        { name: 'Week Sentence',         desc: 'Loaded = +7 days',               config: { label: 'Week Roulette',        punishment: '+7 days locked. You pulled the trigger. Now suffer.' }},
        { name: 'Denial Shot',           desc: 'Loaded = 5 edges, no release',   config: { label: 'Denial Roulette',      punishment: 'Edge 5 times on camera. No release. Report when done.' }},
        // HUMILIATION
        { name: 'Body Mark Shot',        desc: 'Loaded = body writing photo',    config: { label: 'Marking Roulette',     punishment: 'Write PROPERTY on your body in bold. Clear photo required immediately.' }},
        { name: 'Confession Shot',       desc: 'Loaded = confession essay',      config: { label: 'Confession Roulette',  punishment: 'Write a 300-word confession of every failure and weakness this week. No excuses.' }},
        { name: 'Shame Roulette',        desc: 'Loaded = body writing + corner', config: { label: 'Shame Roulette',       punishment: 'Write SLAVE on your chest, corner time 15 minutes, then photograph both together.' }},
    ],
    quiz: [
        // OBEDIENCE
        { name: 'Obedience Rules',   desc: 'Test knowledge of the rules',      config: { label: 'Obedience Quiz',  questions: [
            { question: 'What is the first rule of service?',                                    answers: ['Always obey immediately', 'Ask questions first', 'Negotiate terms', 'Wait for permission'], correctIdx: 0, timeLimit: 30 },
            { question: 'When given an order, you should respond with?',                          answers: ['Yes, my Queen', 'Why?', 'Let me think about it', 'Maybe'], correctIdx: 0, timeLimit: 20 },
            { question: 'What is the correct way to address your Queen?',                         answers: ['My Queen or Queen', 'Hey', 'Whatever you want', 'Mistress only'], correctIdx: 0, timeLimit: 25 },
        ]}},
        { name: 'Devotion Test',     desc: 'How devoted are you really?',      config: { label: 'Devotion Quiz',   questions: [
            { question: 'What is the most important quality in a devoted servant?',               answers: ['Consistency', 'Obedience', 'Patience', 'All of the above'], correctIdx: 3, timeLimit: 45 },
            { question: 'Devotion means?',                                                        answers: ['Serving only when convenient', 'Total and unconditional service', 'Partial compliance', 'Serving when rewarded'], correctIdx: 1, timeLimit: 30 },
            { question: 'When you fail at a task, the correct response is to?',                  answers: ['Confess and ask for punishment', 'Hide it', 'Make excuses', 'Blame circumstances'], correctIdx: 0, timeLimit: 30 },
        ]}},
        { name: 'Protocol Check',    desc: 'Do you know proper protocol?',     config: { label: 'Protocol Quiz',   questions: [
            { question: 'When addressed by your Queen, the correct first response is?',          answers: ['Yes, my Queen', 'What do you need?', 'Hello', 'One moment'], correctIdx: 0, timeLimit: 20 },
            { question: 'A good servant checks in with their Queen how often?',                  answers: ['When they feel like it', 'Daily, without being told', 'Only when ordered', 'Never unless summoned'], correctIdx: 1, timeLimit: 30 },
            { question: 'When you disagree with an order, you should?',                          answers: ['Refuse immediately', 'Comply first, then respectfully raise concerns later', 'Argue', 'Ignore it'], correctIdx: 1, timeLimit: 35 },
        ]}},
        // CHASTITY
        { name: 'Chastity Knowledge', desc: 'Rules of chastity and denial',    config: { label: 'Chastity Quiz',   questions: [
            { question: 'You are only allowed release when?',                                    answers: ['Your Queen decides', 'You feel desperate enough', 'You have waited 7 days', 'You ask nicely'], correctIdx: 0, timeLimit: 25 },
            { question: 'Finding a way around your chastity device is?',                         answers: ['Acceptable if no one knows', 'Strictly forbidden and punishable', 'Fine once in a while', 'A grey area'], correctIdx: 1, timeLimit: 30 },
            { question: 'The device must be checked and photographed how often?',                answers: ['Only when Queen asks', 'Daily as part of the routine', 'Weekly', 'Never'], correctIdx: 1, timeLimit: 25 },
        ]}},
        // SELF-AWARENESS
        { name: 'Self-Awareness Test', desc: 'Know yourself as a servant',     config: { label: 'Self-Awareness',  questions: [
            { question: 'Your needs as a servant come?',                                         answers: ['First', 'After your Queen\'s needs', 'Equal to your Queen', 'Before everything'], correctIdx: 1, timeLimit: 20 },
            { question: 'When you feel the urge to disobey, you should?',                        answers: ['Act on it', 'Suppress it and report the feeling to your Queen', 'Pretend it never happened', 'Ask for a day off'], correctIdx: 1, timeLimit: 35 },
            { question: 'Honest reporting of failures is?',                                      answers: ['Optional', 'Required and non-negotiable', 'Only needed for big failures', 'Embarrassing and avoidable'], correctIdx: 1, timeLimit: 30 },
        ]}},
        // SERVICE OR EGO
        { name: 'Service or Ego', desc: 'What does real service actually mean',      config: { label: 'Service Test',     questions: [
            { question: 'Real service means being in a constant state of?',                          answers: ['Active readiness', 'Ongoing physical effort', 'Emotional support', 'Constant communication'], correctIdx: 0, timeLimit: 30 },
            { question: 'Helping without being asked is best described as?',                         answers: ['Extra dedication', 'Going above and beyond', 'An ego exercise', 'True submission'], correctIdx: 2, timeLimit: 30 },
            { question: 'Saying I will do anything has real value when?',                            answers: ['Said sincerely', 'Said in writing', 'It never has value without consistent proof', 'The mood is right'], correctIdx: 2, timeLimit: 35 },
            { question: 'Your value as a servant is?',                                               answers: ['How your Queen feels about you', 'An objective constant demonstrated through results', 'How much effort you show', 'How often you check in'], correctIdx: 1, timeLimit: 35 },
            { question: 'Real service continues even when?',                                         answers: ['You are acknowledged', 'You feel inspired', 'There is no acknowledgment or praise', 'Your Queen is watching'], correctIdx: 2, timeLimit: 30 },
        ]}},
        // KNOW BEFORE YOU KNEEL
        { name: 'Know Before You Kneel', desc: 'Vetting a Domme before submitting',  config: { label: 'Vetting Protocol', questions: [
            { question: 'The first real act of submission when considering a Domme is?',             answers: ['Sending the first message', 'Researching her thoroughly', 'Sending a tribute', 'Writing an introduction letter'], correctIdx: 1, timeLimit: 30 },
            { question: 'In a real power exchange, power moves?',                                    answers: ['Only from sub to Domme', 'In both directions', 'Only from Domme to sub', 'Nowhere until trust is built'], correctIdx: 1, timeLimit: 30 },
            { question: 'Which of these is a red flag when approaching a Domme?',                    answers: ['Clear limits stated early', 'Asking for references', 'Love bombing and pushing for explicit content fast', 'A slow onboarding process'], correctIdx: 2, timeLimit: 40 },
            { question: 'You should protect your personal privacy until?',                           answers: ['You send a tribute', 'After the first session', 'Trust is genuinely earned', 'She asks for it'], correctIdx: 2, timeLimit: 30 },
            { question: 'Before serving you must negotiate?',                                        answers: ['Only your hard limits', 'Availability, task scope, check-in rhythm and financial expectations', 'Nothing. A real sub just obeys', 'Only the safeword'], correctIdx: 1, timeLimit: 40 },
        ]}},
        // POT OR POSER
        { name: 'Pot or Poser', desc: 'Real submissive or decorative pretender',     config: { label: 'Sub Test',         questions: [
            { question: 'A real submissive is best compared to?',                                    answers: ['Decorative china', 'A cast iron pot built for utility', 'A curated art piece', 'A display item'], correctIdx: 1, timeLimit: 30 },
            { question: 'A poser cracks under pressure because?',                                    answers: ['They are new to the lifestyle', 'They were not properly trained', 'They were made to be admired, not used', 'They have too many limits'], correctIdx: 2, timeLimit: 35 },
            { question: 'A real sub stays?',                                                         answers: ['Full of opinions on what tasks to do', 'Empty until the Domme decides what goes in', 'Proactive about choosing how to serve', 'Ready to negotiate every task'], correctIdx: 1, timeLimit: 30 },
            { question: 'Seeking praise from your Domme is actually?',                               answers: ['A sign of good devotion', 'Negotiating for attention', 'Normal healthy behaviour', 'Required for emotional wellbeing'], correctIdx: 1, timeLimit: 35 },
            { question: 'A real object does not have feelings about?',                               answers: ['Its purpose', 'How it is used', 'Who uses it', 'All of the above'], correctIdx: 3, timeLimit: 30 },
        ]}},
        // CUSTOMER OR SERVANT
        { name: 'Customer or Servant', desc: 'Who is actually running your dynamic', config: { label: 'Hierarchy Check', questions: [
            { question: 'FemDom culture has been damaged most by?',                                  answers: ['Too many rules', 'Fast-food consumer culture', 'Social media exposure', 'Mainstream acceptance'], correctIdx: 1, timeLimit: 30 },
            { question: 'When money dictates the dynamic, the hierarchy is?',                        answers: ['Stronger', 'Equal', 'Dead', 'Negotiable'], correctIdx: 2, timeLimit: 25 },
            { question: 'A sub who selects his own tasks is acting as?',                             answers: ['A dedicated servant', 'CEO of his own submission', 'A proactive helper', 'Showing healthy initiative'], correctIdx: 1, timeLimit: 35 },
            { question: 'You do not choose what you get. You?',                                      answers: ['Ask what is available', 'Review the options', 'Offer what you have', 'Request what fits your limits'], correctIdx: 2, timeLimit: 30 },
            { question: 'In a real dynamic there is no menu because?',                               answers: ['Menus create confusion', 'The Queen decides. Not the customer', 'It saves time for everyone', 'Limits are always respected anyway'], correctIdx: 1, timeLimit: 30 },
        ]}},
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
        { name: 'Clean Space',    desc: 'Prove area is clean',     config: { label: 'Clean Space Photo',  instruction: 'Photograph your cleaned living space. bed made, floor clear' }},
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
        // CONFESSION / PHYSICAL
        { name: 'Confession or Challenge', desc: 'Write confession or physical task', config: { label: 'Truth or Dare',       truthText: 'Write a 150-word confession about your deepest chastity fantasy',    truthFollowUp: 'writing',   dareText: '2 minute cold shower on camera. No stopping.',                       dareFollowUp: 'endurance' }},
        { name: 'Reveal or Endure',        desc: 'Share a secret or suffer',          config: { label: 'Reveal or Endure',    truthText: 'Reveal something embarrassing about yourself that you have never admitted. Write it out fully.',  truthFollowUp: 'writing',   dareText: '3 min plank hold on camera. No dropping.',                           dareFollowUp: 'endurance' }},
        { name: 'Words or Proof',          desc: 'Essay or photo proof',              config: { label: 'Words or Proof',      truthText: 'Why do you need to be controlled? 200 words minimum. Be honest.',   truthFollowUp: 'writing',   dareText: 'Write PROPERTY on your chest in bold. Clear photo proof.',           dareFollowUp: 'photo' }},
        // CHASTITY
        { name: 'Chastity Confessions',    desc: 'Device truths or edging dare',      config: { label: 'Chastity T or D',    truthText: 'Confess honestly: how desperate are you right now and for how long? Write every detail.',        truthFollowUp: 'writing',   dareText: 'Edge 3 times on camera. No release. Video each one.',                dareFollowUp: 'video' }},
        { name: 'Lock or Suffer',          desc: 'Truth adds days or dare suffers',   config: { label: 'Lock or Suffer',     truthText: 'Confess the last time you broke a rule. Full details. No omissions. This adds 1 day to your sentence.', truthFollowUp: 'writing', dareText: 'Cold shower 3 minutes. Film the whole thing.',                         dareFollowUp: 'endurance' }},
        // DEVOTION
        { name: 'Devotion Test',           desc: 'Worship truth or body dare',        config: { label: 'Devotion T or D',    truthText: 'Write about what your Queen means to you. What would life be without her control? 150 words.',     truthFollowUp: 'writing',   dareText: 'Devotion kneeling selfie. Head bowed, hands on knees. Send it now.', dareFollowUp: 'photo' }},
        { name: 'Service or Shame',        desc: 'Service truth or humiliation dare', config: { label: 'Service or Shame',   truthText: 'Write a full status report: physical state, mental state, obedience level, current struggles.',    truthFollowUp: 'writing',   dareText: 'Write SERVANT on your body and photograph it clearly.',              dareFollowUp: 'photo' }},
        // PUNISHMENT
        { name: 'Punishment or Purge',     desc: 'Confess or suffer physically',      config: { label: 'Purge or Punish',    truthText: 'Write every negative thought, selfish urge and disobedient moment from this week. All of it.',    truthFollowUp: 'writing',   dareText: '100 squats on camera. No breaks. Film the whole set.',               dareFollowUp: 'video' }},
        { name: 'Humiliation Challenge',   desc: 'Shame truth or corner time dare',   config: { label: 'Shame Challenge',    truthText: 'Write about something you are deeply ashamed of. Be brutally honest. No softening.',              truthFollowUp: 'writing',   dareText: 'Corner time 20 minutes. Nose to wall. Photograph at the end.',       dareFollowUp: 'photo' }},
    ],
    simon_says: [
        // OBEDIENCE
        { name: 'Instant Obedience',      desc: '3 rapid commands, no thinking',   config: { label: 'Instant Obedience',   intervalMinutes: 45, chainTasks: [
            { text: 'Get on your knees right now. Stay there. Photo proof.',               timeLimit: 120, proofType: 'photo' },
            { text: 'Write "I obey without question" on paper and hold it to camera.',     timeLimit: 120, proofType: 'photo' },
            { text: 'Drop and do 20 pushups. Film every single one.',                      timeLimit: 120, proofType: 'video' },
        ]}},
        { name: 'The Reflex Test',        desc: '4 commands at random intervals',  config: { label: 'The Reflex Test',     intervalMinutes: 30, chainTasks: [
            { text: 'Stop everything. Kneel. Head down. 60 seconds. Photo after.',         timeLimit: 120, proofType: 'photo' },
            { text: 'Text back a single word: OBEDIENT. Photo of the message sent.',       timeLimit: 120, proofType: 'photo' },
            { text: '30 squats. No stopping. Film the set.',                               timeLimit: 120, proofType: 'video' },
            { text: 'Write your submission affirmation 5 times. Photo of the page.',       timeLimit: 120, proofType: 'photo' },
        ]}},
        // PHYSICAL
        { name: 'The Gauntlet',           desc: '5 escalating physical commands',  config: { label: 'The Gauntlet',        intervalMinutes: 90, chainTasks: [
            { text: '25 pushups. Perfect form. Camera on.',                                timeLimit: 120, proofType: 'video' },
            { text: 'Plank. Hold it. 90 seconds. No dropping.',                            timeLimit: 120, proofType: 'video' },
            { text: '50 squats. Fast. Film the whole thing.',                              timeLimit: 120, proofType: 'video' },
            { text: 'Wall sit. Thighs parallel. 2 minutes. Do not move.',                  timeLimit: 120, proofType: 'video' },
            { text: '20 burpees. Full range. No excuses. Film it.',                        timeLimit: 120, proofType: 'video' },
        ]}},
        { name: 'Body Breakdown',         desc: '4 brutal back-to-back exercises', config: { label: 'Body Breakdown',      intervalMinutes: 60, chainTasks: [
            { text: '50 pushups. All in one go. Video.',                                   timeLimit: 120, proofType: 'video' },
            { text: '100 squats. Counting out loud. Film it.',                             timeLimit: 120, proofType: 'video' },
            { text: '3 minute plank. No dropping. No stopping.',                           timeLimit: 120, proofType: 'video' },
            { text: '30 burpees to finish. Film from the first to the last.',              timeLimit: 120, proofType: 'video' },
        ]}},
        // COLD SHOCK
        { name: 'Ice Protocol',           desc: 'Cold shocks at surprise intervals',config: { label: 'Ice Protocol',       intervalMinutes: 60, chainTasks: [
            { text: 'Cold shower. 60 seconds. Water must be cold. Film it.',               timeLimit: 120, proofType: 'video' },
            { text: 'Cold shower again. 90 seconds. No hesitation.',                       timeLimit: 120, proofType: 'video' },
            { text: 'Final cold shower. 2 full minutes. Film start to finish.',            timeLimit: 120, proofType: 'video' },
        ]}},
        { name: 'Freeze and Break',       desc: '3 cold shocks in rapid succession',config: { label: 'Freeze and Break',   intervalMinutes: 40, chainTasks: [
            { text: 'Cold shower. 90 seconds. Film the moment you step in.',               timeLimit: 120, proofType: 'video' },
            { text: 'Out of the shower. Write "I submit to discomfort" 10 times. Photo.', timeLimit: 50,  proofType: 'photo' },
            { text: 'Back in. Cold shower. 2 more minutes. Do not stop.',                  timeLimit: 120, proofType: 'video' },
        ]}},
        // CHASTITY
        { name: 'Chastity Inspection',    desc: '4 commands verifying your cage',  config: { label: 'Chastity Inspection', intervalMinutes: 45, chainTasks: [
            { text: 'Device check. Photo of it locked and secure. Right now.',             timeLimit: 120, proofType: 'photo' },
            { text: 'Write down how many days you have been locked. Photo of the note.',   timeLimit: 120, proofType: 'photo' },
            { text: 'Photograph the device from a different angle. Prove it is real.',     timeLimit: 120, proofType: 'photo' },
            { text: 'Final check. Full body photo. Device visible. Kneeling.',            timeLimit: 120, proofType: 'photo' },
        ]}},
        { name: 'Denial Sequence',        desc: '3 edging commands with no release',config: { label: 'Denial Sequence',    intervalMinutes: 90, chainTasks: [
            { text: 'Edge once. Right now. Stay on camera. Report when done.',             timeLimit: 120, proofType: 'video' },
            { text: 'Edge again. Twice this time. No release. Film it.',                   timeLimit: 120, proofType: 'video' },
            { text: 'Final edge. Hold the very edge. Then stop. Device goes back on.',     timeLimit: 120, proofType: 'video' },
        ]}},
        // HUMILIATION
        { name: 'The Marking',            desc: '4 body writing and photo commands',config: { label: 'The Marking',        intervalMinutes: 50, chainTasks: [
            { text: 'Write OWNED on your chest right now. Clear photo. No delays.',        timeLimit: 120, proofType: 'photo' },
            { text: 'Write DENIED across your stomach. Photo from above.',                 timeLimit: 120, proofType: 'photo' },
            { text: 'Kneel with both words visible. Full photo. Head bowed.',              timeLimit: 120, proofType: 'photo' },
            { text: 'Write PROPERTY on your inner thigh. Final photo. Send it.',           timeLimit: 120, proofType: 'photo' },
        ]}},
        { name: 'Corner and Mark',        desc: 'Corner time and humiliation chain',config: { label: 'Corner and Mark',    intervalMinutes: 30, chainTasks: [
            { text: 'Corner time. Nose to wall. 10 minutes. Photo when done.',             timeLimit: 120, proofType: 'photo' },
            { text: 'Write PUNISHED on your body right now. Photo proof.',                 timeLimit: 120, proofType: 'photo' },
            { text: 'Corner time again. 10 more minutes. Do not leave the corner.',        timeLimit: 120, proofType: 'photo' },
        ]}},
        // DEVOTION
        { name: 'Devotion Drill',         desc: 'Rapid worship commands',           config: { label: 'Devotion Drill',     intervalMinutes: 90, chainTasks: [
            { text: 'Say "I serve my Queen" out loud 5 times. Video proof.',               timeLimit: 120, proofType: 'video' },
            { text: 'Bow your head and hold it down for 60 seconds. Film it.',             timeLimit: 120, proofType: 'video' },
            { text: 'Write 3 things you are grateful for on paper. Photo of the page.',    timeLimit: 120, proofType: 'photo' },
            { text: 'Full devotion pose. Knees on floor, forehead nearly touching. Photo.',timeLimit: 120, proofType: 'photo' },
        ]}},
        { name: 'Worship Sequence',       desc: '5 escalating devotion tasks',      config: { label: 'Worship Sequence',   intervalMinutes: 60, chainTasks: [
            { text: 'Get on your knees. Stay there. Photo now.',                           timeLimit: 120, proofType: 'photo' },
            { text: 'Write 3 reasons you worship your Queen. Photo of it.',                timeLimit: 120, proofType: 'photo' },
            { text: 'Say your devotion affirmation 3 times out loud. Video.',              timeLimit: 120, proofType: 'video' },
            { text: 'Kneeling bow. Hold 30 seconds. Film it.',                             timeLimit: 120, proofType: 'video' },
            { text: 'Write "I live to serve" and send the photo. Final proof.',            timeLimit: 120, proofType: 'photo' },
        ]}},
        // MORNING PROTOCOL
        { name: 'Morning Protocol',       desc: '4 wake-up commands within 5 min',  config: { label: 'Morning Protocol',   intervalMinutes: 5, chainTasks: [
            { text: 'Wake up. Photo of yourself right now. No preparation. Send it.',      timeLimit: 120, proofType: 'photo' },
            { text: 'On your knees beside the bed. Photo immediately.',                    timeLimit: 120, proofType: 'photo' },
            { text: 'Device check. Photo of the lock. Show it is secure.',                 timeLimit: 120, proofType: 'photo' },
            { text: 'Write "Good morning, my Queen. I am ready to serve." Photo of it.',  timeLimit: 120, proofType: 'photo' },
        ]}},
        // CONFESSION
        { name: 'Confession Spiral',      desc: '4 escalating honesty commands',    config: { label: 'Confession Spiral',  intervalMinutes: 60, chainTasks: [
            { text: 'Write one thing you failed at today. Just one sentence. Photo.',      timeLimit: 120, proofType: 'photo' },
            { text: 'Write the real reason you failed. No excuses. Photo.',                timeLimit: 120, proofType: 'photo' },
            { text: 'Write what you deserve as a consequence. Be specific. Photo.',        timeLimit: 120, proofType: 'photo' },
            { text: 'Write "I will do better because my Queen expects it." Photo.',        timeLimit: 120, proofType: 'photo' },
        ]}},
        // PUNISHMENT
        { name: 'The Punishment Chain',   desc: '5 punishments delivered in order', config: { label: 'The Punishment Chain', intervalMinutes: 60, chainTasks: [
            { text: 'Write PUNISHED on your body. Photo proof. No delays.',                timeLimit: 45,  proofType: 'photo' },
            { text: 'Corner time. 10 minutes. Nose to wall. Photo when done.',             timeLimit: 120, proofType: 'photo' },
            { text: 'Cold shower. 2 minutes. Film yourself stepping in.',                  timeLimit: 120, proofType: 'video' },
            { text: '75 pushups. No stopping. Film the full set.',                         timeLimit: 120, proofType: 'video' },
            { text: 'Write 50 lines: I was punished because I deserved it. Photo.',        timeLimit: 120, proofType: 'photo' },
        ]}},
        // INSPECTION
        { name: "Queen's Full Inspection", desc: '5 tasks proving everything is in order', config: { label: "Queen's Inspection", intervalMinutes: 20, chainTasks: [
            { text: 'Clean space photo. Show your room is clean and in order.',            timeLimit: 120, proofType: 'photo' },
            { text: 'Device check. Locked. Secure. Clear photo from close up.',            timeLimit: 30,  proofType: 'photo' },
            { text: 'Personal appearance check. Show yourself presentable and ready.',     timeLimit: 30,  proofType: 'photo' },
            { text: 'Kneeling devotion photo. Proper position. Head bowed.',               timeLimit: 30,  proofType: 'photo' },
            { text: 'Write your status report: device, obedience, and state of mind.',     timeLimit: 90,  proofType: 'photo' },
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
