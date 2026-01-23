// Configuration and constants
export const CONFIG = {
    CLOUD_NAME: 'dfqvezjlj',
    ACCOUNT_ID: 'kW2K8hR',
    API_KEY: 'public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ',
    UPLOAD_PRESET: 'task_uploads',
    TWITCH_CHANNEL: "qkarin",
    SESSION_VERSION: "v1"
};

export const URLS = {
    QUEEN_AVATAR: "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png",
    DEFAULT_AVATAR: "https://cdn-icons-png.flaticon.com/512/3233/3233508.png"
};

// SYNCED: HallBoy (No space) and Champioin (Database typo)
export const LEVELS = [
    {name: "HallBoy", min: 0}, 
    {name: "Footman", min: 2000}, 
    {name: "Silverman", min: 5000}, 
    {name: "Butler", min: 10000}, 
    {name: "Chamberlain", min: 20000}, 
    {name: "Secretary", min: 50000}, 
    {name: "Queen's Champioin", min: 100000} 
];

export const FUNNY_SAYINGS = [
    "Money talks. Yours just screamed 'QUEEN KARIN'.",
    "Your wallet belongs to Queen Karin anyway.",
    "A lovely tribute for Queen Karin. Good pet."
];

export const CMS_HIERARCHY = [
    { Title: "HallBoy", Icon: "🧹", Order: 1, Points: "0+", Description: "Entry level of service.", StatusText: "First line of service.", ProtocolText: "Perform basic tasks.", DutiesText: "Prove you live to serve.", ContactText: "15MIN DAILY SLOT", CssClass: "" },
    { Title: "Footman", Icon: "🚶‍♂️", Order: 2, Points: "2000+", Description: "Learn to serve.", StatusText: "Time to earn your place.", ProtocolText: "Serve quickly and reliably.", DutiesText: "Perfect Timing.", ContactText: "30MIN DAILY SLOT", CssClass: "" },
    { Title: "Silverman", Icon: "🍴", Order: 3, Points: "5000+", Description: "Dedicated submissive.", StatusText: "Skilled and polished sub.", ProtocolText: "Focus on improvement.", DutiesText: "Face all challenges.", ContactText: "30MIN DAILY SLOT", CssClass: "" },
    { Title: "Butler", Icon: "🍷", Order: 4, Points: "10000+", Description: "Trusted submissive.", StatusText: "Mastered consistency.", ProtocolText: "Notice needs without being told.", DutiesText: "Devotion is foundation.", ContactText: "DAILY 2x30min SLOTS", CssClass: "" },
    { Title: "Chamberlain", Icon: "🏰", Order: 5, Points: "20000+", Description: "Senior submissive.", StatusText: "Act with excellence.", ProtocolText: "Carry yourself with dignity.", DutiesText: "Uphold standards.", ContactText: "UNLIMITED", CssClass: "Secretary" },
    { Title: "Secretary", Icon: "📜", Order: 6, Points: "50000+", Description: "Worthy of trust.", StatusText: "Inner Circle.", ProtocolText: "Respect and safeguard.", DutiesText: "Authority on smaller matters.", ContactText: "UNLIMITED", CssClass: "elite-butler" },
    { Title: "Queen's Champion", Icon: "⚔️", Order: 7, Points: "100000", Description: "Ultimate submissive!", StatusText: "You have made it!", ProtocolText: "2 bodies, 1 soul!", DutiesText: "Enjoy the love you earned.", ContactText: "LEGENDARY", CssClass: "legendary" }
];

/*export const BYTESCALE_CONFIG = {
  admin: {
    ACCOUNT_ID: "kW2K8hR",
    PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
    // ❌ DO NOT put secret key here
    SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN" // just the ENV NAME, not the key
  },
  member: { //Same for now
    ACCOUNT_ID: "kW2K8hR",
    PUBLIC_KEY: "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ",
    // ❌ DO NOT put secret key here
    SECRET_KEY_ENV: "BYTESCALE_SECRET_KEY_ADMIN" // just the ENV NAME, not the key
  }
};*/

export const STREAM_PASSWORDS = ["QUEEN", "OBEY", "SESSION"];