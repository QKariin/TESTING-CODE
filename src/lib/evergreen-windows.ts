/**
 * Evergreen Challenge — Personal Window Generation
 *
 * Generates per-participant windows based on their join time, timezone, and chosen slots.
 * Day 1 Task 1 opens IMMEDIATELY on join. Remaining tasks follow the slot schedule.
 */

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

/** Slot boundaries in hours (local time) */
const SLOT_BOUNDS: Record<TimeSlot, { startHour: number; endHour: number }> = {
    morning:   { startHour: 6,  endHour: 12 },
    afternoon: { startHour: 12, endHour: 18 },
    evening:   { startHour: 18, endHour: 24 },
};

export function getSlotBounds(slot: TimeSlot) {
    return SLOT_BOUNDS[slot];
}

/** Sort slots in chronological order */
function sortSlots(slots: TimeSlot[]): TimeSlot[] {
    const order: Record<TimeSlot, number> = { morning: 0, afternoon: 1, evening: 2 };
    return [...slots].sort((a, b) => order[a] - order[b]);
}

interface WindowRow {
    challenge_id: string;
    member_id: string;
    day_number: number;
    window_number: number;
    opens_at: string; // ISO
    closes_at: string; // ISO
    verification_code: number;
}

/**
 * Generate all personal windows for a participant joining an evergreen challenge.
 *
 * @param challengeId - challenge UUID
 * @param memberId - participant email
 * @param joinedAt - Date when they joined (NOW)
 * @param timezone - IANA timezone e.g. 'America/New_York'
 * @param chosenSlots - e.g. ['morning', 'evening']
 * @param durationDays - total challenge days
 * @param slotDurationMinutes - strict window within slot (30-360, 360 = full slot)
 * @param verificationCodes - optional pre-set codes per task number (for consistency across participants)
 */
export function generateEvergreenWindows(
    challengeId: string,
    memberId: string,
    joinedAt: Date,
    timezone: string,
    chosenSlots: TimeSlot[],
    durationDays: number,
    slotDurationMinutes: number,
    verificationCodes?: number[],
): WindowRow[] {
    const windows: WindowRow[] = [];
    const sorted = sortSlots(chosenSlots);
    let taskIndex = 0; // flat index across all days for verification codes

    for (let day = 1; day <= durationDays; day++) {
        for (let slotIdx = 0; slotIdx < sorted.length; slotIdx++) {
            const slot = sorted[slotIdx];
            const bounds = SLOT_BOUNDS[slot];
            const windowNumber = slotIdx + 1;

            let opensAt: Date;
            let closesAt: Date;

            if (day === 1 && slotIdx === 0) {
                // Day 1 Task 1: opens IMMEDIATELY
                opensAt = new Date(joinedAt);
                closesAt = new Date(opensAt.getTime() + slotDurationMinutes * 60 * 1000);
            } else {
                // Calculate the local date for this day
                // Day 1 = join day, Day 2 = next day, etc.
                opensAt = getLocalSlotTime(joinedAt, timezone, day - 1, bounds.startHour);

                // If this is Day 1 but a later slot, and the slot start is before join time,
                // push to the slot start (don't open in the past)
                if (day === 1 && opensAt.getTime() < joinedAt.getTime()) {
                    // This slot already passed today — push to tomorrow
                    opensAt = getLocalSlotTime(joinedAt, timezone, day, bounds.startHour);
                }

                if (slotDurationMinutes >= 360) {
                    // Full slot mode — window is the entire 6hr block
                    closesAt = new Date(opensAt.getTime() + (bounds.endHour - bounds.startHour) * 60 * 60 * 1000);
                } else {
                    closesAt = new Date(opensAt.getTime() + slotDurationMinutes * 60 * 1000);
                }
            }

            const code = verificationCodes?.[taskIndex]
                ?? Math.floor(10000 + Math.random() * 90000);

            windows.push({
                challenge_id: challengeId,
                member_id: memberId,
                day_number: day,
                window_number: windowNumber,
                opens_at: opensAt.toISOString(),
                closes_at: closesAt.toISOString(),
                verification_code: code,
            });

            taskIndex++;
        }
    }

    return windows;
}

/**
 * Calculate an absolute Date for "dayOffset days after joinDate, at localHour:00 in the given timezone"
 */
function getLocalSlotTime(joinDate: Date, timezone: string, dayOffset: number, localHour: number): Date {
    // Get the local date components on the join day in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });

    // Format the join date in the user's timezone to extract the local date
    const parts = formatter.formatToParts(joinDate);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const localYear = parseInt(get('year'));
    const localMonth = parseInt(get('month')) - 1;
    const localDay = parseInt(get('day'));

    // Build a local-time string for the target day + hour
    const targetDate = new Date(localYear, localMonth, localDay + dayOffset);
    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    const hourStr = localHour === 24 ? '00' : String(localHour).padStart(2, '0');

    // Parse as if in the user's timezone
    // Use a trick: create a date string and use the timezone offset to convert to UTC
    const naiveLocal = new Date(`${dateStr}T${hourStr}:00:00`);

    // Find the UTC offset for this timezone at this time
    const utcDate = new Date(naiveLocal.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(naiveLocal.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = utcDate.getTime() - tzDate.getTime();

    return new Date(naiveLocal.getTime() + offsetMs);
}

/**
 * Get the join cost based on duration
 */
export function getJoinCost(durationDays: number): number {
    if (durationDays <= 7) return 2000;
    if (durationDays <= 14) return 5000;
    return 10000;
}

/**
 * Compute which personal day a participant is on
 */
export function computePersonalDay(personalStart: Date, timezone: string): number {
    const now = new Date();
    const diffMs = now.getTime() - personalStart.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Find the current or next upcoming window from a list of personal windows
 */
export function getCurrentWindow(windows: WindowRow[]): WindowRow | null {
    const now = new Date();
    // First: find one that's currently open
    const open = windows.find(w => new Date(w.opens_at) <= now && new Date(w.closes_at) > now);
    if (open) return open;
    // Next: find the soonest upcoming
    const upcoming = windows
        .filter(w => new Date(w.opens_at) > now)
        .sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime());
    return upcoming[0] || null;
}
