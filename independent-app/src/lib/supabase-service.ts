// src/lib/supabase-service.ts
import { supabaseAdmin as supabase } from './supabase';

export const DbService = {
    // --- PROFILES ---
    async getProfile(memberId: string) {
        // Try by member_id (email) first — use .eq() not .or() to avoid
        // parser issues with email special chars (@ and .)
        const { data: byEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('member_id', memberId)
            .maybeSingle();

        if (byEmail) return byEmail;

        // Try by UUID id (for admin lookups)
        const { data: byId } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', memberId)
            .maybeSingle();

        if (byId) return byId;

        // Fallback: Check 'tasks' table for legacy data — return REAL values
        const { data: taskData } = await supabase
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
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getAllProfiles() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('last_active', { ascending: false });
        if (error) throw error;
        return data;
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
        else updates.score = (profile.score || 0) + amount;

        return this.updateProfile(profile.id, updates);
    },

    // --- TRANSACTIONS ---
    async processTransaction(memberId: string, amount: number, category: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

        const newWallet = (profile.wallet || 0) + amount;
        if (newWallet < 0) throw new Error("Insufficient Capital");

        // Safely execute the update
        const updates: any = { wallet: newWallet };

        // Increment total_coins_spent in JSONB parameters
        if (amount < 0) {
            const params = { ...(profile.parameters || {}) };
            params.total_coins_spent = (params.total_coins_spent || 0) + Math.abs(amount);
            updates.parameters = params;

            // Also update legacy column if it exists in the row
            if (profile.hasOwnProperty('total_coins_spent')) {
                updates.total_coins_spent = (profile.total_coins_spent || 0) + Math.abs(amount);
            }
        }

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
    async sendMessage(memberId: string, text: string, sender: string = 'slave', mediaUrl: string | null = null) {
        const profile = await this.getProfile(memberId);
        const mid = profile?.member_id || memberId;

        const { data, error } = await supabase
            .from('messages')
            .insert({
                member_id: mid,
                sender,
                message: text,
                media_url: mediaUrl
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getMessages(memberId: string, limit = 50) {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('member_id', memberId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []).reverse();
    },

    // --- TASKS ---
    async getReviewQueue() {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, profiles(name, avatar_url)')
            .eq('status', 'pending');
        if (error) throw error;
        // Map member_id to id for dashboard compatibility
        return (data || []).map((t: any) => ({ ...t, id: t.member_id }));
    },

    async approveTask(taskId: string, profileId: string, bonus: number, sticker: string | null, comment: string | null) {
        // 1. Update tasks table
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ status: 'approve', reviewer_comment: comment, sticker_url: sticker })
            .eq('member_id', profileId);
        if (taskError) throw taskError;

        const profile = await this.getProfile(profileId);
        if (!profile || !profile.id) return;

        // 2. Sync profile JSONB columns (task_queue and routine_history)
        let queue = profile.task_queue || [];
        queue = queue.filter((t: any) => t.id !== taskId);

        let history = profile.routine_history || [];
        const histIdx = history.findIndex((t: any) => t.id === taskId);
        if (histIdx > -1) {
            history[histIdx].status = 'approve';
            history[histIdx].completed = true;
        }

        const updates: any = {
            wallet: (profile.wallet || 0) + bonus,
            score: (profile.score || 0) + bonus,
            task_queue: queue,
            routine_history: history,
            parameters: {
                ...(profile.parameters || {}),
                taskdom_completed_tasks: (profile.parameters?.taskdom_completed_tasks || 0) + 1
            }
        };
        await this.updateProfile(profile.id, updates);
    },

    async rejectTask(taskId: string, profileId: string) {
        // 1. Update tasks table
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ status: 'reject' })
            .eq('member_id', profileId);
        if (taskError) throw taskError;

        const profile = await this.getProfile(profileId);
        if (!profile || !profile.id) return;

        // 2. Sync profile JSONB
        let queue = profile.task_queue || [];
        queue = queue.filter((t: any) => t.id !== taskId);

        let history = profile.routine_history || [];
        const histIdx = history.findIndex((t: any) => t.id === taskId);
        if (histIdx > -1) {
            history[histIdx].status = 'reject';
            history[histIdx].completed = false;
        }

        await this.updateProfile(profile.id, {
            task_queue: queue,
            routine_history: history
        });
    },

    async submitTask(memberId: string, proofUrl: string, proofType: string, taskText: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

        const taskId = crypto.randomUUID();
        const now = new Date().toISOString();

        // 1. Update entry in tasks table for Dashboard visibility (Cabinet style)
        const { error: taskError } = await supabase
            .from('tasks')
            .upsert({
                member_id: memberId,
                Name: profile.name,
                text: taskText,
                proofUrl: proofUrl,
                proofType: proofType,
                status: 'pending',
                timestamp: now
            }, { onConflict: 'member_id' });
        if (taskError) throw taskError;

        // 2. Update profiles task_queue for dashboard sync and routine_history for user display
        const queue = profile.task_queue || [];
        const taskEntry = {
            id: taskId,
            text: taskText,
            proofUrl: proofUrl,
            proofType: proofType,
            timestamp: now,
            status: 'pending'
        };
        queue.push(taskEntry);

        const history = profile.routine_history || [];
        history.unshift(taskEntry);

        const params = { ...(profile.parameters || {}) };
        delete params.active_task; // Clear the active task assignment

        return this.updateProfile(profile.id, {
            task_queue: queue,
            routine_history: history,
            parameters: params
        });
    },

    async assignTask(memberId: string, task: any) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) throw new Error("Profile not linked");

        const updates = {
            parameters: {
                ...(profile.parameters || {}),
                active_task: {
                    ...task,
                    assigned_at: new Date().toISOString()
                }
            }
        };
        return this.updateProfile(profile.id, updates);
    },

    async clearTask(memberId: string) {
        const profile = await this.getProfile(memberId);
        if (!profile || !profile.id) {
            console.warn("Attempted to clear task for missing profile:", memberId);
            return { success: false, error: "Profile not found" };
        }

        const params = { ...(profile.parameters || {}) };
        delete params.active_task;

        return this.updateProfile(profile.id, { parameters: params });
    },

    // --- TRIBUTES ---
    async getRecentTributes(limit = 10) {
        const { data, error } = await supabase
            .from('tributes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    }
};
