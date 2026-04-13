// src/lib/supabase-service.ts
import { supabase, supabaseAdmin } from './supabase';

export const DbService = {
    // --- PROFILES ---
    async getProfile(memberId: string) {
        const { data: byEmail } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('member_id', memberId)
            .maybeSingle();

        if (byEmail) return byEmail;

        // Try by UUID id (for admin lookups)
        const { data: byId } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', memberId)
            .maybeSingle();

        if (byId) return byId;

        // Fallback: Check 'tasks' table for legacy data — return REAL values
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
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getAllProfiles() {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('last_active', { ascending: false });
        if (error) throw error;
        return data;
    },

    // --- CENTRALIZED POINTS AWARD (updates all score fields in tasks + profiles) ---
    async awardPoints(memberEmail: string, points: number): Promise<void> {
        if (!points) return;
        const email = memberEmail.toLowerCase();

        // Update all period score fields in tasks table
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('"Score", "Daily Score", "Weekly Score", "Monthly Score", "Yearly Score"')
            .ilike('member_id', email)
            .maybeSingle();

        if (taskRow) {
            await supabaseAdmin.from('tasks').update({
                'Score':         (Number(taskRow['Score'])         || 0) + points,
                'Daily Score':   (Number(taskRow['Daily Score'])   || 0) + points,
                'Weekly Score':  (Number(taskRow['Weekly Score'])  || 0) + points,
                'Monthly Score': (Number(taskRow['Monthly Score']) || 0) + points,
                'Yearly Score':  (Number(taskRow['Yearly Score'])  || 0) + points,
            }).ilike('member_id', email);
        }

        // Keep profiles.score in sync
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('score')
            .ilike('member_id', email)
            .maybeSingle();

        if (profile) {
            await supabaseAdmin.from('profiles')
                .update({ score: Math.max(0, (Number(profile.score) || 0) + points) })
                .ilike('member_id', email);
        }
    },

    // --- REWARDS & KNEELING ---
    async claimKneel(memberId: string, amount: number, type: 'coins' | 'points') {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

        const updates: any = {
            parameters: {
                ...(profile.parameters || {}),
                last_kneel: new Date().toISOString(),
                kneel_count: (profile.parameters?.kneel_count || 0) + 1
            }
        };

        if (type === 'coins') updates.wallet = (profile.wallet || 0) + amount;

        const result = await this.updateProfile(profile.id, updates);
        if (type === 'points') await this.awardPoints(memberId, amount);
        return result;
    },

    // --- TRANSACTIONS ---
    async processTransaction(memberId: string, amount: number, category: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

        const newWallet = (profile.wallet || 0) + amount;
        if (newWallet < 0) throw new Error("Insufficient Capital");

        // Safely execute the update
        const updates: any = { wallet: newWallet };

        return this.updateProfile(profile.id, updates);
    },

    // --- FRAGMENTS ---
    async revealFragment(memberId: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

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

        await this.updateProfile(profile.id, updates);
        return { pick, progress, revealMapCount: revealMap.length };
    },

    // --- MESSAGING ---
    async sendMessage(memberEmail: string, text: string, sender: string = 'system', mediaUrl: string | null = null) {
        // Prevent UUID leakage; chat histories use the email string
        const { data, error } = await supabaseAdmin
            .from('chats')
            .insert({
                member_id: memberEmail,
                sender_email: sender,
                content: text,
                type: 'system',
                metadata: { isQueen: sender === 'system' ? false : true, mediaUrl }
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getMessages(memberId: string, limit = 50) {
        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('member_id', memberId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []).reverse();
    },

    // --- TASKS ---
    // Helper: get the raw tasks row for a member
    async _getTaskRow(memberId: string) {
        const { data } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('member_id', memberId)
            .maybeSingle();
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

        // Fetch avatar_url from profiles for all members
        const memberIds = [...new Set((data || []).map((r: any) => r.member_id).filter(Boolean))];
        const { data: profileData } = await supabaseAdmin
            .from('profiles')
            .select('member_id, avatar_url')
            .in('member_id', memberIds);
        const avatarMap = new Map((profileData || []).map((p: any) => [p.member_id?.toLowerCase(), p.avatar_url]));

        const pending: any[] = [];
        for (const row of (data || [])) {
            const history: any[] = this._parseHistory(row);
            const pendingEntries = history.filter((t: any) => t.status === 'pending');
            for (const entry of pendingEntries) {
                let finalUrl = entry.proofUrl;
                if (finalUrl && (finalUrl.includes('proofs/') || finalUrl.includes('/public/proofs/'))) {
                    try {
                        let path = "";
                        // Case A: Full absolute public URL from Supabase
                        if (finalUrl.includes('/object/public/proofs/')) {
                            path = finalUrl.split('/object/public/proofs/')[1].split('?')[0];
                        }
                        // Case B: Relative path with my previous prefix
                        else if (finalUrl.includes('/public/proofs/')) {
                            path = finalUrl.split('/public/proofs/')[1].split('?')[0];
                        }
                        // Case C: Raw relative path starting with bucket or subpath
                        else if (finalUrl.includes('proofs/tasks/')) {
                            path = 'tasks/' + finalUrl.split('proofs/tasks/')[1].split('?')[0];
                        }

                        if (path) {
                            const { data: signData, error: signErr } = await supabaseAdmin.storage.from('proofs').createSignedUrl(path, 604_800); // 1 week
                            if (!signErr && signData?.signedUrl) {
                                finalUrl = signData.signedUrl;
                            }
                        }
                    } catch (e) {
                        console.error("[DbService] Error signing proofUrl:", finalUrl, e);
                    }
                }

                pending.push({
                    ...entry,
                    id: entry.id,
                    proofUrl: finalUrl,
                    member_id: row.member_id,
                    memberName: row['Name'] || 'Slave',
                    avatarUrl: avatarMap.get(row.member_id?.toLowerCase()) || null,
                });
            }
        }
        return pending;
    },

    async approveTask(taskId: string, profileId: string, bonus: number, sticker: string | null, comment: string | null) {
        // 1. Update Taskdom_History and legacy columns in tasks table
        const row = await this._getTaskRow(profileId);
        const history: any[] = this._parseHistory(row);
        const idx = history.findIndex((t: any) => t.id === taskId);

        if (idx > -1) {
            history[idx].status = 'approve';
            history[idx].completed = true;
            history[idx].meritAwarded = bonus;
            if (comment) history[idx].adminComment = comment;
        }

        // Increment completed task count by 1 — only for real tasks, not routines
        const isRoutineEntry = idx > -1 ? !!history[idx].isRoutine : false;
        const currentCount = parseInt(row?.['Taskdom_CompletedTasks'] || '0', 10) || 0;
        const newCount = isRoutineEntry ? currentCount : currentCount + 1;

        await supabaseAdmin
            .from('tasks')
            .update({
                'Taskdom_History': JSON.stringify(history),
                'Status': 'approve',
                'Taskdom_CompletedTasks': String(newCount)
            })
            .eq('member_id', profileId);

        // 2. Award points only — no wallet/coins for tasks
        await this.awardPoints(profileId, bonus);

        // 3. Send system chat message
        try {
            await this.sendMessage(profileId, `TASK APPROVED — ${bonus} POINTS AWARDED`, 'system');
        } catch (_) { }
    },

    async rejectTask(taskId: string, profileId: string) {
        // 1. Update Taskdom_History and legacy Status/Wallet in tasks table
        const row = await this._getTaskRow(profileId);
        const history: any[] = this._parseHistory(row);
        const idx = history.findIndex((t: any) => t.id === taskId);

        const isRoutine = idx > -1 ? !!history[idx].isRoutine : false;

        if (idx > -1) {
            history[idx].status = 'reject';
            history[idx].completed = false;
        }

        // Routines get no penalty — only tasks lose 300 coins
        const taskUpdates: any = {
            'Taskdom_History': JSON.stringify(history),
            'Status': 'reject',
        };
        if (!isRoutine) {
            taskUpdates['Wallet'] = Math.max(0, (row?.Wallet || 0) - 300);
        }

        await supabaseAdmin
            .from('tasks')
            .update(taskUpdates)
            .eq('member_id', profileId);

        // 2. Sync wallet with profiles table (only for tasks)
        if (!isRoutine) {
            try {
                const profile = await this.getProfile(profileId);
                if (profile && profile.id) {
                    const pWallet = Math.max(0, (profile.wallet || 0) - 300);
                    await this.updateProfile(profile.id, { wallet: pWallet });
                }
            } catch (_) { }
        }

        // 3. Send system chat message
        try {
            const msg = isRoutine
                ? `ROUTINE REJECTED — NO POINTS AWARDED`
                : `TASK REJECTED — 300 COINS PENALTY APPLIED`;
            await this.sendMessage(profileId, msg, 'system');
        } catch (_) { }
    },

    async submitTask(memberId: string, proofUrl: string, proofType: string, taskText: string, isRoutine: boolean = false) {
        const now = new Date().toISOString();
        const taskId = Date.now().toString();

        // 1. Get current Taskdom_History from tasks table
        const row = await this._getTaskRow(memberId);
        const history: any[] = this._parseHistory(row);

        // 2. Build new entry
        const newEntry: any = {
            id: taskId,
            text: isRoutine ? "Daily Routine" : taskText,
            proofUrl: proofUrl,
            proofType: (proofType || '').startsWith('video') ? 'video' : 'image',
            timestamp: now,
            status: 'pending',
            completed: false,
            isRoutine: isRoutine,
            category: isRoutine ? 'Routine' : undefined
        };

        // Prevent duplicates: remove any existing pending routine for today before adding
        if (isRoutine) {
            const todayStr = new Date().toISOString().split('T')[0];
            const dupIdx = history.findIndex((t: any) =>
                t.isRoutine === true && t.status === 'pending' &&
                typeof t.timestamp === 'string' && t.timestamp.startsWith(todayStr)
            );
            if (dupIdx > -1) history.splice(dupIdx, 1);
        }

        history.unshift(newEntry);

        const profile = await this.getProfile(memberId);
        const newHistory = JSON.stringify(history);

        // 3. Safe write: update if row exists, insert if not
        // Routine uploads must NOT touch taskdom_active_task or taskdom_pending_state
        if (row) {
            const taskUpdates: any = { Status: 'pending', 'Taskdom_History': newHistory };
            if (!isRoutine) {
                taskUpdates.taskdom_active_task = null;
                taskUpdates.taskdom_pending_state = null;
            }
            const { error } = await supabaseAdmin
                .from('tasks')
                .update(taskUpdates)
                .eq('member_id', memberId);
            if (error) throw error;
        } else {
            const insertData: any = {
                member_id: memberId,
                Name: profile?.name || 'Slave',
                Status: 'pending',
                'Taskdom_History': newHistory,
            };
            if (!isRoutine) {
                insertData.taskdom_active_task = null;
                insertData.taskdom_pending_state = null;
            }
            const { error } = await supabaseAdmin.from('tasks').insert(insertData);
            if (error) throw error;
        }

        // 4. If routine, also append timestamp to profiles.routine_history
        if (isRoutine) {
            try {
                const { data: prof } = await supabaseAdmin
                    .from('profiles')
                    .select('routine_history')
                    .ilike('member_id', memberId)
                    .maybeSingle();

                const prevHistory: string[] = Array.isArray(prof?.routine_history) ? prof.routine_history : [];
                const updatedHistory = [...prevHistory, now];

                await supabaseAdmin
                    .from('profiles')
                    .update({ routine_history: updatedHistory })
                    .ilike('member_id', memberId);
            } catch (histErr) {
                console.warn('[submitTask] Could not update routine_history:', histErr);
            }
        }

        // 5. Send system chat message
        try {
            await this.sendMessage(memberId, isRoutine ? `ROUTINE UPLOADED — AWAITING APPROVAL` : `TASK SUBMITTED — AWAITING REVIEW`, 'system');
        } catch (_) { }

        return { success: true, taskId };
    },

    async assignTask(memberId: string, task: any) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error('Profile not linked');

        const endTime = Date.now() + (24 * 3600 * 1000); // 24 hours default
        const activeTaskData = JSON.stringify({ ...task, assigned_at: new Date().toISOString(), endTime });
        const { error } = await supabaseAdmin
            .from('tasks')
            .update({ taskdom_active_task: activeTaskData })
            .eq('member_id', profile.member_id || memberId);

        if (error) throw error;
        return { success: true };
    },

    async clearTask(memberId: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) {
            console.warn('Attempted to clear task for missing profile:', memberId);
            return { success: false, error: 'Profile not found' };
        }

        const { error } = await supabaseAdmin
            .from('tasks')
            .update({ taskdom_active_task: null, taskdom_pending_state: null })
            .eq('member_id', profile.member_id || memberId);

        if (error) throw error;
        return { success: true };
    },

    // --- TRIBUTES ---
    async getRecentTributes(limit = 10) {
        const { data, error } = await supabaseAdmin
            .from('tributes')
            .select('*')
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
                .select('*')
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
