// src/scripts/config.ts
// Configuration and constants - Converted to TypeScript

export const CONFIG = {
    CLOUD_NAME: 'dfqvezjlj',
    UPLOAD_PRESET: 'task_uploads',
    TWITCH_CHANNEL: "qkarin",
    SESSION_VERSION: "v1",
    AUTH_CONFIG: {
        REQUIRE_AUTH: true,         // Set to true to enable login protection
        REQUIRE_INITIATION: true,   // Set to true to enable the secret phrase gate
        INITIATION_PHRASE: "ALPHA_INITIATE_99"
    }
};

export const URLS = {
    QUEEN_AVATAR: "/queen-karin.png",
    DEFAULT_AVATAR: "https://cdn-icons-png.flaticon.com/512/3233/3233508.png"
};

export interface Level {
    name: string;
    min: number;
}

export const LEVELS: Level[] = [
    { name: "HallBoy", min: 0 },
    { name: "Footman", min: 2000 },
    { name: "Silverman", min: 5000 },
    { name: "Butler", min: 10000 },
    { name: "Chamberlain", min: 20000 },
    { name: "Secretary", min: 50000 },
    { name: "Queen's Champion", min: 100000 }
];

export const FUNNY_SAYINGS: string[] = [
    "Money talks. Yours just screamed 'QUEEN KARIN'.",
    "Your wallet belongs to Queen Karin anyway.",
    "A lovely tribute for Queen Karin. Good pet."
];

export interface CMSHierarchyItem {
    Title: string;
    Icon: string;
    Order: number;
    Points: string;
    Description: string;
    StatusText: string;
    ProtocolText: string;
    DutiesText: string;
    ContactText: string;
    CssClass: string;
}

export const CMS_HIERARCHY: CMSHierarchyItem[] = [
    { Title: "HallBoy", Icon: "🧹", Order: 1, Points: "0+", Description: "Entry level of service.", StatusText: "First line of service.", ProtocolText: "Perform basic tasks.", DutiesText: "Prove you live to serve.", ContactText: "15MIN DAILY SLOT", CssClass: "" },
    { Title: "Footman", Icon: "🚶‍♂️", Order: 2, Points: "2000+", Description: "Learn to serve.", StatusText: "Time to earn your place.", ProtocolText: "Serve quickly and reliably.", DutiesText: "Perfect Timing.", ContactText: "30MIN DAILY SLOT", CssClass: "" },
    { Title: "Silverman", Icon: "🍴", Order: 3, Points: "5000+", Description: "Dedicated submissive.", StatusText: "Skilled and polished sub.", ProtocolText: "Focus on improvement.", DutiesText: "Face all challenges.", ContactText: "30MIN DAILY SLOT", CssClass: "" },
    { Title: "Butler", Icon: "🍷", Order: 4, Points: "10000+", Description: "Trusted submissive.", StatusText: "Mastered consistency.", ProtocolText: "Notice needs without being told.", DutiesText: "Devotion is foundation.", ContactText: "DAILY 2x30min SLOTS", CssClass: "" },
    { Title: "Chamberlain", Icon: "🏰", Order: 5, Points: "20000+", Description: "Senior submissive.", StatusText: "Act with excellence.", ProtocolText: "Carry yourself with dignity.", DutiesText: "Uphold standards.", ContactText: "UNLIMITED", CssClass: "Secretary" },
    { Title: "Secretary", Icon: "📜", Order: 6, Points: "50000+", Description: "Worthy of trust.", StatusText: "Inner Circle.", ProtocolText: "Respect and safeguard.", DutiesText: "Authority on smaller matters.", ContactText: "UNLIMITED", CssClass: "elite-butler" },
    { Title: "Queen's Champion", Icon: "⚔️", Order: 7, Points: "100000", Description: "Ultimate submissive!", StatusText: "You have made it!", ProtocolText: "2 bodies, 1 soul!", DutiesText: "Enjoy the love you earned.", ContactText: "LEGENDARY", CssClass: "legendary" }
];

export const STREAM_PASSWORDS: string[] = ["QUEEN", "OBEY", "SESSION"];
