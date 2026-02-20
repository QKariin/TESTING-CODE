// src/lib/supabase-service.ts
import { supabase } from './supabase';

export const DbService = {
    // --- PROFILES ---
    // --- PROFILES ---
    async getProfile(memberId: string) {
        // Search by member_id (Email) or id (UUID)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`member_id.eq.${memberId},id.eq.${memberId}`)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
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
            .order('last_seen', { ascending: false });
        if (error) throw error;
        return data;
    },

    // --- TASKS ---
    async getReviewQueue() {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, profiles(name, avatar)')
            .eq('status', 'pending');
        if (error) throw error;
        return data;
    },

    async approveTask(taskId: string, profileId: string, bonus: number, sticker: string | null, comment: string | null) {
        // 1. Update task status
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ status: 'approve', reviewer_comment: comment, sticker_url: sticker })
            .eq('id', taskId);
        if (taskError) throw taskError;

        // 2. Award coins & points to profile
        const profile = await this.getProfile(profileId);
        if (!profile) return;

        const updates = {
            wallet: (profile.wallet || 0) + bonus,
            score: (profile.score || 0) + bonus,
            parameters: {
                ...(profile.parameters || {}),
                taskdom_completed_tasks: (profile.parameters?.taskdom_completed_tasks || 0) + 1
            }
        };
        await this.updateProfile(profile.id, updates);
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
    },

    // --- MESSAGES ---
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

    async sendMessage(memberId: string, text: string, sender: 'queen' | 'slave' | 'system', mediaUrl?: string) {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                member_id: memberId,
                message: (mediaUrl ? null : text),
                sender,
                media_url: mediaUrl || null,
                created_at: new Date().toISOString()
            });
        if (error) throw error;
        return data;
    },

    // --- COINS & TRANSACTIONS ---
    async processTransaction(profileId: string, amount: number, category: string) {
        const profile = await this.getProfile(profileId);
        if (!profile) return { success: false };

        const newWallet = (profile.wallet || 0) + amount;
        const newSpent = amount < 0 ? (profile.total_coins_spent || 0) + Math.abs(amount) : (profile.total_coins_spent || 0);

        const { error } = await supabase
            .from('profiles')
            .update({
                wallet: newWallet,
                total_coins_spent: newSpent
            })
            .eq('id', profile.id);

        if (error) throw error;
        return { success: true, wallet: newWallet };
    },

    // --- FRAGMENTS ---
    async revealFragment(profileId: string) {
        const profile = await this.getProfile(profileId);
        if (!profile) return { error: 'Not found' };

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

    // --- KNEEL ---
    async claimKneel(profileId: string, amount: number, type: 'coins' | 'points') {
        const profile = await this.getProfile(profileId);
        if (!profile) return { success: false };

        const updates: any = {
            parameters: {
                ...(profile.parameters || {}),
                last_kneel: new Date().toISOString(),
                kneel_count: (profile.parameters?.kneel_count || 0) + 1
            }
        };

        if (type === 'coins') updates.wallet = (profile.wallet || 0) + amount;
        else updates.score = (profile.score || 0) + amount;

        await this.updateProfile(profile.id, updates);
        return { success: true };
    }
};
