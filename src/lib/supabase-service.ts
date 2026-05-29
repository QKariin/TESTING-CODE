// src/lib/supabase-service.ts
import { supabase, supabaseAdmin } from './supabase';
import { cacheGet, cacheSet } from '@/lib/api-cache';

export const DbService = {
    // --- PROFILES ---
    async getProfile(memberId: string) {
        const { data: byEmail } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('member_id', memberId)
            .maybeSingle();

        if (byEmail) return byEmail;

        // Try by UUID id (for admin lookups)
        const { data: byId } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('ID', memberId)
            .maybeSingle();

        if (byId) return byId;

        // Fallback: Check 'tasks' table for legacy data - return REAL values
        const { data: taskData } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .ilike('member_id', memberId)
            .maybeSingle();

        if (taskData) {
            return {
                id: null,
                member_id: taskData.member_id,
                name: taskData.Name || 'Slave',
                wallet: taskData.Wallet || 0,
                score: taskData.Score || 0,
                hierarchy: taskData.Hierarchy || 'Hall Boy',
                avatar_url: null,
                parameters: {
                    kneel_count: taskData.kneelCount || 0,
                    taskdom_completed_tasks: taskData.Taskdom_CompletedTasks || 0,
                },
                _isLegacy: true
            };
        }

        return null;
    },

    async updateProfile(id: string, updates: any) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('ID', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getAllProfiles() {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // --- CENTRALIZED POINTS AWARD (updates all score fields in tasks + profiles) ---
    async awardPoints(memberEmail: string, points: number): Promise<void> {
        if (!points) return;

        // Get profile to find UUID (tasks.member_id = profiles.id, not email)
        const profile = await this.getProfile(memberEmail);
        if (!profile) return;

        // Look up task row by UUID (ID column) first, fall back to email
        let { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('"ID", "Score", "Daily Score", "Weekly Score", "Monthly Score", "Yearly Score", member_id')
            .eq('ID', profile.ID)
            .maybeSingle();

        if (!taskRow) {
            const { data: legacyRow } = await supabaseAdmin
                .from('tasks')
                .select('"ID", "Score", "Daily Score", "Weekly Score", "Monthly Score", "Yearly Score", member_id')
                .ilike('member_id', memberEmail)
                .maybeSingle();
            taskRow = legacyRow;
        }

        if (taskRow) {
            await supabaseAdmin.from('tasks').update({
                'Score':         (Number(taskRow['Score'])         || 0) + points,
                'Daily Score':   (Number(taskRow['Daily Score'])   || 0) + points,
                'Weekly Score':  (Number(taskRow['Weekly Score'])  || 0) + points,
                'Monthly Score': (Number(taskRow['Monthly Score']) || 0) + points,
                'Yearly Score':  (Number(taskRow['Yearly Score'])  || 0) + points,
            }).eq('ID', taskRow.ID);
        }

        // Keep profiles.score in sync
        await supabaseAdmin.from('profiles')
            .update({ score: Math.max(0, (Number(profile.score) || 0) + points) })
            .eq('ID', profile.ID);
    },

    // --- REWARDS & KNEELING ---
    async claimKneel(memberId: string, amount: number, type: 'coins' | 'points') {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.ID) throw new Error("Profile not linked");

        const updates: any = {
            parameters: {
                ...(profile.parameters || {}),
                last_kneel: new Date().toISOString(),
                kneel_count: (profile.parameters?.kneel_count || 0) + 1
            }
        };

        if (type === 'coins') updates.wallet = (profile.wallet || 0) + amount;

        const result = await this.updateProfile(profile.ID, updates);
        if (type === 'points') await this.awardPoints(memberId, amount);
        return result;
    },

    // --- TRANSACTIONS ---
    async processTransaction(memberId: string, amount: number, category: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.ID) throw new Error("Profile not linked");

        const newWallet = (profile.wallet || 0) + amount;
        if (newWallet < 0) throw new Error("Insufficient Capital");

        // Safely execute the update
        const updates: any = { wallet: newWallet };

        return this.updateProfile(profile.ID, updates);
    },

    // --- FRAGMENTS ---
    async revealFragment(memberId: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.ID) throw new Error("Profile not linked");

        const params = profile.parameters || {};
        const revealMap = params.reveal_map || [];
        const progress = params.library_progress || 1;

        const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n: number) => !revealMap.includes(n));
        if (available.length === 0) return { complete: true };

        const pick = available[Math.floor(Math.random() * available.length)];
        revealMap.push(pick);

        const updates: any = {
            parameters: {
                ...params,
                reveal_map: revealMap
            }
        };

        if (revealMap.length === 9) {
            const vault = params.reward_vault || [];
            vault.push({ day: progress, unlocked_at: new Date().toISOString() });
            updates.parameters.reward_vault = vault;
            updates.parameters.library_progress = progress + 1;
            updates.parameters.reveal_map = [];
        }

        await this.updateProfile(profile.ID, updates);
        return { pick, progress, revealMapCount: revealMap.length };
    },

    // --- MESSAGING ---
    async sendMessage(memberIdOrEmail: string, text: string, sender: string = 'system', mediaUrl: string | null = null) {
        // chats.member_id must be EMAIL (FK → profiles.member_id)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberIdOrEmail);
        let chatMemberId = memberIdOrEmail;
        if (isUuid) {
            const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', memberIdOrEmail).maybeSingle();
            if (p?.member_id) chatMemberId = p.member_id.toLowerCase();
        }

        const { error } = await supabaseAdmin
            .from('chats')
            .insert({
                member_id: chatMemberId,
                sender_email: sender,
                content: text,
                type: 'system',
                metadata: { isQueen: sender === 'system' ? false : true, mediaUrl }
            });

        if (error) throw error;
        return { member_id: chatMemberId, content: text, sender_email: sender, created_at: new Date().toISOString() };
    },

    async getMessages(memberId: string, limit = 50) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const query = supabaseAdmin.from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
        const { data, error } = isUuid
            ? await query.eq('member_id', memberId)
            : await query.ilike('member_id', memberId);
        if (error) throw error;
        return (data || []).reverse();
    },

    // --- TASKS ---
    // Helper: get the raw tasks row - tries by ID (UUID) first, falls back to email in member_id
    async _getTaskRow(memberId: string) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        if (isUuid) {
            // Try by ID (UUID primary key)
            const { data } = await supabaseAdmin.from('tasks').select('*').eq('ID', memberId).maybeSingle();
            if (data) return data;

            // Fall back: find email via profile, then look up task by email
            const profile = await this.getProfile(memberId);
            if (profile?.member_id) {
                const { data: emailRow } = await supabaseAdmin.from('tasks').select('*').ilike('member_id', profile.member_id).maybeSingle();
                if (emailRow) return emailRow;
            }
            return null;
        }
        // Email-based lookup (member_id column holds email)
        const { data } = await supabaseAdmin.from('tasks').select('*').ilike('member_id', memberId).maybeSingle();
        return data;
    },

    // Helper: parse Taskdom_History JSON text → array
    _parseHistory(row: any): any[] {
        if (!row) return [];
        try { return JSON.parse(row['Taskdom_History'] || '[]'); } catch { return []; }
    },

    async getReviewQueue() {
        // Pull all tasks rows that have at least one 'pending' entry in Taskdom_History
        const { data, error } = await supabaseAdmin
            .from('tasks')
            .select('member_id, "Name", "Status", "Taskdom_History"');
        if (error) throw error;

        // Fetch avatar_url + UUID from profiles — tasks.member_id may be email (legacy) or UUID
        const memberIds = [...new Set((data || []).map((r: any) => r.member_id as string).filter(Boolean))] as string[];
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const memberEmails = memberIds.filter(m => !uuidRe.test(m));
        const memberUuids = memberIds.filter(m => uuidRe.test(m));
        const profileQueries = [];
        if (memberEmails.length) profileQueries.push(supabaseAdmin.from('profiles').select('ID, member_id, avatar_url').in('member_id', memberEmails));
        if (memberUuids.length) profileQueries.push(supabaseAdmin.from('profiles').select('ID, member_id, avatar_url').in('ID', memberUuids));
        const profileResults = await Promise.all(profileQueries);
        const allProfiles = profileResults.flatMap(r => r.data || []);
        const avatarMap = new Map<string, string>();
        const emailToUuid = new Map<string, string>();
        for (const p of allProfiles) {
            if (p.member_id && p.ID) emailToUuid.set(p.member_id.toLowerCase(), p.ID);
            if (p.avatar_url) {
                if (p.ID) avatarMap.set(p.ID, p.avatar_url);
                if (p.member_id) avatarMap.set(p.member_id?.toLowerCase(), p.avatar_url);
            }
        }

        // Collect all pending entries first, then sign URLs in parallel
        const pendingRaw: Array<{ entry: any; row: any; path: string }> = [];
        for (const row of (data || [])) {
            const history: any[] = this._parseHistory(row);
            const pendingEntries = history.filter((t: any) => t.status === 'pending');
            for (const entry of pendingEntries) {
                const proofUrl: string = entry.proofUrl || '';
                let path = '';
                if (proofUrl && (proofUrl.includes('proofs/') || proofUrl.includes('/public/proofs/'))) {
                    // Case A: Full absolute public URL from Supabase
                    if (proofUrl.includes('/object/public/proofs/')) {
                        path = proofUrl.split('/object/public/proofs/')[1].split('?')[0];
                    }
                    // Case B: Relative path with my previous prefix
                    else if (proofUrl.includes('/public/proofs/')) {
                        path = proofUrl.split('/public/proofs/')[1].split('?')[0];
                    }
                    // Case C: Raw relative path starting with bucket or subpath
                    else if (proofUrl.includes('proofs/tasks/')) {
                        path = 'tasks/' + proofUrl.split('proofs/tasks/')[1].split('?')[0];
                    }
                }
                pendingRaw.push({ entry, row, path });
            }
        }

        // Sign all URLs in parallel, with a 1-hour in-memory cache per path
        const signed = await Promise.all(
            pendingRaw.map(async ({ entry, row, path }) => {
                let finalUrl = entry.proofUrl;
                if (path) {
                    const cacheKey = `signed-url:proofs:${path}`;
                    const cached = cacheGet<string>(cacheKey);
                    if (cached) {
                        finalUrl = cached;
                    } else {
                        try {
                            const { data: signData, error: signErr } = await supabaseAdmin.storage.from('proofs').createSignedUrl(path, 604_800); // 1 week validity
                            if (!signErr && signData?.signedUrl) {
                                finalUrl = signData.signedUrl;
                                cacheSet(cacheKey, finalUrl, 604_800_000); // cache 1 week - proof URLs are immutable (new file = new path)
                            }
                        } catch (e) {
                            console.error("[DbService] Error signing proofUrl:", entry.proofUrl, e);
                        }
                    }
                }
                const rawMid = row.member_id || '';
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMid);
                const resolvedMid = isUuid ? rawMid : (emailToUuid.get(rawMid.toLowerCase()) || rawMid);
                return {
                    ...entry,
                    id: entry.id,
                    proofUrl: finalUrl,
                    member_id: resolvedMid,
                    memberName: row['Name'] || 'Slave',
                    avatarUrl: avatarMap.get(resolvedMid) || avatarMap.get(rawMid?.toLowerCase()) || null,
                };
            })
        );

        return signed;
    },

    async approveTask(taskId: string, profileId: string, bonus: number, sticker: string | null, comment: string | null) {
        // Check user_routines table for pending routine with this ID
        const { data: userRoutine } = await supabaseAdmin
            .from('user_routines')
            .select('*')
            .eq('pending_id', taskId)
            .maybeSingle();

        if (userRoutine) {
            // ── ROUTINE APPROVAL ──
            const now = new Date().toISOString();
            const todayStr = new Date().toISOString().split('T')[0];
            const history: any[] = userRoutine.history || [];

            // Update the pending entry in history to approved
            const pendingIdx = history.findIndex((e: any) => e.id === taskId);
            if (pendingIdx > -1) {
                history[pendingIdx].status = 'approve';
                history[pendingIdx].reviewed_at = now;
                history[pendingIdx].points_awarded = bonus;
            }

            // Calculate new streak
            const lastApproved = userRoutine.last_approved_date;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            let newStreak = 1;
            if (lastApproved === yesterdayStr || lastApproved === todayStr) {
                newStreak = (userRoutine.current_streak || 0) + 1;
            }
            const newBest = Math.max(newStreak, userRoutine.best_streak || 0);

            await supabaseAdmin
                .from('user_routines')
                .update({
                    history,
                    current_streak: newStreak,
                    best_streak: newBest,
                    last_approved_date: todayStr,
                    pending_id: null,
                    pending_proof_url: null,
                    pending_proof_type: null,
                    pending_thumbnail_url: null,
                    pending_submitted_at: null,
                    updated_at: now,
                })
                .eq('member_id', userRoutine.member_id);

            await this.awardPoints(profileId, bonus);
            const thumb = userRoutine.pending_thumbnail_url || userRoutine.pending_proof_url || null;
            const cardData = { status: 'approve', points: bonus, type: 'routine', taskText: userRoutine.routine_name || 'Daily Routine', thumbnail: thumb };
            try { await this.sendMessage(profileId, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }

            // Update profiles.parameters for backward compat
            try {
                const prof = await this.getProfile(profileId);
                if (prof) {
                    const params = prof.parameters || {};
                    params.consistency = newStreak;
                    params.routine_streak = newBest;
                    params.taskdom_current_streak = newStreak;
                    await supabaseAdmin.from('profiles').update({ parameters: params, bestRoutinestreak: newBest, routinestreak: newStreak }).ilike('member_id', userRoutine.member_id);
                }
            } catch (_) { }
            return;
        }

        // ── TASK: update in Taskdom_History ──
        const row = await this._getTaskRow(profileId);
        const history: any[] = this._parseHistory(row);
        const idx = history.findIndex((t: any) => t.id === taskId);
        const entry = idx > -1 ? history[idx] : null;

        if (idx > -1) {
            history[idx].status = 'approve';
            history[idx].completed = true;
            history[idx].meritAwarded = bonus;
            if (comment) history[idx].adminComment = comment;
        }

        const currentCount = parseInt(row?.['Taskdom_CompletedTasks'] || '0', 10) || 0;

        await supabaseAdmin
            .from('tasks')
            .update({
                'Taskdom_History': JSON.stringify(history),
                'Status': 'approve',
                'Taskdom_CompletedTasks': String(currentCount + 1)
            })
            .eq('ID', row.ID);

        await this.awardPoints(profileId, bonus);
        const cardData = { status: 'approve', points: bonus, type: 'task', comment: comment || null, taskText: entry?.text || null, thumbnail: entry?.thumbnail_url || entry?.proofUrl || null };
        try { await this.sendMessage(profileId, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }
    },

    async rejectTask(taskId: string, profileId: string) {
        // Check user_routines table for pending routine with this ID
        const { data: userRoutine } = await supabaseAdmin
            .from('user_routines')
            .select('*')
            .eq('pending_id', taskId)
            .maybeSingle();

        if (userRoutine) {
            // ── ROUTINE REJECTION ──
            const now = new Date().toISOString();
            const history: any[] = userRoutine.history || [];

            // Update the pending entry in history to rejected
            const pendingIdx = history.findIndex((e: any) => e.id === taskId);
            if (pendingIdx > -1) {
                history[pendingIdx].status = 'reject';
                history[pendingIdx].reviewed_at = now;
            }

            // Streak resets on rejection
            await supabaseAdmin
                .from('user_routines')
                .update({
                    history,
                    current_streak: 0,
                    pending_id: null,
                    pending_proof_url: null,
                    pending_proof_type: null,
                    pending_thumbnail_url: null,
                    pending_submitted_at: null,
                    updated_at: now,
                })
                .eq('member_id', userRoutine.member_id);

            const thumb = userRoutine.pending_thumbnail_url || userRoutine.pending_proof_url || null;
            const cardData = { status: 'reject', points: 0, type: 'routine', taskText: userRoutine.routine_name || 'Daily Routine', thumbnail: thumb };
            try { await this.sendMessage(profileId, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }
            return;
        }

        // ── TASK: update in Taskdom_History, apply 300 coin penalty ──
        const row = await this._getTaskRow(profileId);
        const history: any[] = this._parseHistory(row);
        const idx = history.findIndex((t: any) => t.id === taskId);
        const entry = idx > -1 ? history[idx] : null;

        if (idx > -1) {
            history[idx].status = 'reject';
            history[idx].completed = false;
        }

        await supabaseAdmin
            .from('tasks')
            .update({
                'Taskdom_History': JSON.stringify(history),
                'Status': 'reject',
                'Wallet': Math.max(0, (row?.Wallet || 0) - 300),
            })
            .eq('ID', row.ID);

        try {
            const profile = await this.getProfile(profileId);
            if (profile && profile.ID) {
                const pWallet = Math.max(0, (profile.wallet || 0) - 300);
                await this.updateProfile(profile.ID, { wallet: pWallet });
            }
        } catch (_) { }

        const cardData = { status: 'reject', points: 0, penalty: 300, type: 'task', taskText: entry?.text || null, thumbnail: entry?.thumbnail_url || entry?.proofUrl || null };
        try { await this.sendMessage(profileId, `TASK_REVIEW_CARD::${JSON.stringify(cardData)}`, 'system'); } catch (_) { }
    },

    async submitTask(memberId: string, proofUrl: string, proofType: string, taskText: string, isRoutine: boolean = false, thumbnailUrl: string | null = null, tz: string = 'UTC') {
        const now = new Date().toISOString();
        const taskId = Date.now().toString();
        const profile = await this.getProfile(memberId);
        const email = (profile?.member_id || memberId).toLowerCase();

        if (isRoutine) {
            // ── ROUTINE: write to user_routines table ──
            const pType = (proofType || '').startsWith('video') ? 'video' : 'image';
            const newEntry = {
                id: taskId,
                date: new Date().toISOString().split('T')[0],
                submitted_at: now,
                status: 'pending',
                proof_url: proofUrl,
                proof_type: pType,
                thumbnail_url: thumbnailUrl || null,
                points_awarded: 0,
            };

            const { data: existing } = await supabaseAdmin
                .from('user_routines')
                .select('*')
                .eq('member_id', email)
                .maybeSingle();

            if (existing) {
                // Remove any previous pending entry from history (re-submission)
                const history: any[] = (existing.history || []).filter((e: any) => e.status !== 'pending');
                history.push(newEntry);

                const { error: routineErr } = await supabaseAdmin
                    .from('user_routines')
                    .update({
                        history,
                        pending_id: taskId,
                        pending_proof_url: proofUrl,
                        pending_proof_type: pType,
                        pending_thumbnail_url: thumbnailUrl || null,
                        pending_submitted_at: now,
                        routine_name: profile?.routine || existing.routine_name || 'Daily Routine',
                        updated_at: now,
                    })
                    .eq('member_id', email);
                if (routineErr) throw routineErr;
            } else {
                // First routine ever — create the row
                const { error: routineErr } = await supabaseAdmin
                    .from('user_routines')
                    .insert({
                        member_id: email,
                        routine_name: profile?.routine || 'Daily Routine',
                        history: [newEntry],
                        pending_id: taskId,
                        pending_proof_url: proofUrl,
                        pending_proof_type: pType,
                        pending_thumbnail_url: thumbnailUrl || null,
                        pending_submitted_at: now,
                        current_streak: 0,
                        best_streak: 0,
                    });
                if (routineErr) throw routineErr;
            }
        } else {
            // ── TASK: write to Taskdom_History as before ──
            const row = await this._getTaskRow(memberId);
            const history: any[] = this._parseHistory(row);

            const newEntry: any = {
                id: taskId,
                text: taskText,
                proofUrl: proofUrl,
                proofType: (proofType || '').startsWith('video') ? 'video' : 'image',
                thumbnail_url: thumbnailUrl || undefined,
                timestamp: now,
                status: 'pending',
                completed: false,
            };

            history.unshift(newEntry);
            const newHistory = JSON.stringify(history);

            if (row) {
                const { error } = await supabaseAdmin
                    .from('tasks')
                    .update({
                        Status: 'pending',
                        'Taskdom_History': newHistory,
                        taskdom_active_task: null,
                        taskdom_pending_state: null,
                    })
                    .eq('ID', row.ID);
                if (error) throw error;
            } else {
                const { error } = await supabaseAdmin.from('tasks').insert({
                    ID: profile?.ID || memberId,
                    member_id: profile?.member_id || '',
                    Name: profile?.name || 'Slave',
                    Status: 'pending',
                    'Taskdom_History': newHistory,
                    taskdom_active_task: null,
                    taskdom_pending_state: null,
                });
                if (error) throw error;
            }
        }

        // Send system chat message
        try {
            await this.sendMessage(memberId, isRoutine ? `ROUTINE UPLOADED - AWAITING APPROVAL` : `TASK SUBMITTED - AWAITING REVIEW`, 'system');
        } catch (_) { }

        return { success: true, taskId };
    },

    async assignTask(memberId: string, task: any) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.ID) throw new Error('Profile not linked');

        const endTime = Date.now() + (24 * 3600 * 1000); // 24 hours default
        const activeTaskData = JSON.stringify({ ...task, assigned_at: new Date().toISOString(), endTime });
        const { error } = await supabaseAdmin
            .from('tasks')
            .update({ taskdom_active_task: activeTaskData })
            .eq('ID', profile.ID);

        if (error) throw error;
        return { success: true };
    },

    async clearTask(memberId: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.ID) {
            console.warn('Attempted to clear task for missing profile:', memberId);
            return { success: false, error: 'Profile not found' };
        }

        const { error } = await supabaseAdmin
            .from('tasks')
            .update({ taskdom_active_task: null, taskdom_pending_state: null })
            .eq('ID', profile.ID);

        if (error) throw error;
        return { success: true };
    },

    // --- TRIBUTES ---
    async getRecentTributes(limit = 10) {
        const { data, error } = await supabaseAdmin
            .from('tributes')
            .select('id, member_id, amount, message, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    // --- TASK DATABASE ---
    async getTasksFromDatabase() {
        console.log("DB_SERVICE: Fetching tasks directly from Supabase (tasks_database)...");
        try {
            const { data, error } = await supabaseAdmin
                .from('tasks_database')
                .select('id, Category, Task, Description, Points, Duration, difficulty')
                .order('Category', { ascending: true });

            if (error) {
                console.error("DB_SERVICE: tasks_database query failed:", error.message);
                return [];
            }

            console.log("DB_SERVICE: tasks_database returned", data?.length || 0, "tasks");
            return data || [];
        } catch (err: any) {
            console.error("DB_SERVICE_FETCH_FAILED:", err);
            return [];
        }
    }
};
