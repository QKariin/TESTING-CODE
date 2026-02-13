export const SNAPSHOT_USERS = [
    {
        _id: "u1_alex",
        memberId: "u1_alex",
        name: "Alex (Pet)",
        hierarchy: "Silverman",
        coins: 5250,
        points: 15150,
        status: "Working",
        profilePicture: "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png",
        kneelHistory: { totalMinutes: 720, sessions: [] },
        kneelCount: 48,
        joined: "2023-01-01T12:00:00.000Z",
        submissionCount: 42,
        lastSeen: new Date().toISOString(),
        lastMessageTime: Date.now(),
        limits: "No blood, no breathplay, no permanent marks.",
        kinks: "Impact, humiliation, latex, service, chastity.",
        taskQueue: [
            { id: "t1", text: "Clean the boots", status: "pending" },
            { id: "t2", text: "Organize the armory", status: "pending" }
        ],
        activeTask: { text: "Polishing the Throne", startTime: Date.now() - 100000, endTime: Date.now() + 300000 },
        endTime: Date.now() + 300000,
        purchasedItems: JSON.stringify([
            { name: "Collar", cost: 500, date: Date.now() },
            { name: "Cuffs", cost: 250, date: Date.now() }
        ]),
        routine: "Morning Protocol",
        routineDoneToday: false,
        history: [
            { text: "Paid Tribute", status: "approve", date: new Date().toISOString(), proofUrl: "https://via.placeholder.com/150" },
            { text: "Completed KNEEL", status: "approve", date: new Date().toISOString() }
        ]
    },
    {
        _id: "u2_sam",
        memberId: "u2_sam",
        name: "Sam (Newbie)",
        hierarchy: "Slave",
        coins: 100,
        points: 50,
        status: "Training",
        profilePicture: "", // No avatar test
        lastSeen: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        joined: "2024-02-01T10:00:00.000Z"
    },
    {
        _id: "u3_money",
        memberId: "u3_money",
        name: "The Wallet",
        hierarchy: "Goldman",
        coins: 50000,
        points: 2500,
        status: "ATM Mode",
        profilePicture: "https://via.placeholder.com/150",
        lastSeen: new Date().toISOString(),
        activeTask: { text: "Counting Money", startTime: Date.now() - 500000, endTime: Date.now() + 1000000 },
        endTime: Date.now() + 1000000,
        purchasedItems: JSON.stringify([{ name: "Golden Cage", cost: 25000 }]),
        history: [{ text: "Big Tribute", status: "approve", date: new Date().toISOString() }]
    },
    {
        _id: "u4_bad",
        memberId: "u4_bad",
        name: "Bad Apple",
        hierarchy: "Slave",
        coins: -500,
        points: -200,
        status: "Punished",
        profilePicture: "",
        lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        drillCount: 5,
        limits: "Hard limits active.",
        kinks: "Denied.",
        taskQueue: [
            { id: "p1", text: "Write Lines (500)", status: "pending" },
            { id: "p2", text: "Corner Time", status: "pending" }
        ]
    },
    {
        _id: "u5_simp",
        memberId: "u5_simp",
        name: "Simp (Puppy)",
        hierarchy: "Puppy",
        coins: 10,
        points: 5,
        status: "Begging",
        profilePicture: "https://via.placeholder.com/150",
        joined: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        routine: "Begging Protocol",
        history: [{ text: "Asked for attention", status: "deny", date: new Date().toISOString() }]
    }
];

export const SNAPSHOT_QUEUE = [
    { text: "Verify Tribute from Alex", status: "pending", user: "Alex (Pet)", id: "m1", proofUrl: "https://via.placeholder.com/150" }
];
