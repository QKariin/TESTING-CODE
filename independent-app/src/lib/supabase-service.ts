// src/lib/supabase-service.ts
import { supabase } from './supabase';

export const DbService = {
    // --- PROFILES ---
    async getProfile(memberId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('member_id', memberId)
            .single();
        if (error) throw error;
        return data;
    },

    async updateProfile(memberId: string, updates: any) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('member_id', memberId);
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

    async approveTask(taskId: string, memberId: string, bonus: number, sticker: string | null, comment: string | null) {
        // 1. Update task status
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ status: 'approve', reviewer_comment: comment, sticker_url: sticker })
            .eq('id', taskId);
        if (taskError) throw taskError;

        // 2. Award coins & points to profile
        // In a real app, this should be a transaction or RPC
        const profile = await this.getProfile(memberId);
        const updates = {
            coins: (profile.coins || 0) + bonus,
            points: (profile.points || 0) + bonus, // Example logic
            completed_tasks: (profile.completed_tasks || 0) + 1
        };
        await this.updateProfile(memberId, updates);
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
        return data.reverse();
    },

    async sendMessage(memberId: string, text: string, sender: 'queen' | 'slave' | 'system', mediaUrl?: string) {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                member_id: memberId,
                text,
                sender,
                media_url: mediaUrl
            });
        if (error) throw error;
        return data;
    },

    // --- COINS & TRANSACTIONS ---
    async processTransaction(memberId: string, amount: number, category: string) {
        const profile = await this.getProfile(memberId);
        const newCoins = (profile.coins || 0) + amount;
        const newSpent = amount < 0 ? (profile.total_spent || 0) + Math.abs(amount) : (profile.total_spent || 0);

        const { error } = await supabase
            .from('profiles')
            .update({
                coins: newCoins,
                total_spent: newSpent
            })
            .eq('member_id', memberId);

        if (error) throw error;
        return { success: true, coins: newCoins };
    },

    // --- FRAGMENTS ---
    async revealFragment(memberId: string) {
        const profile = await this.getProfile(memberId);
        const revealMap = JSON.parse(profile.reveal_map || '[]');
        const progress = profile.library_progress || 1;

        const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n: number) => !revealMap.includes(n));
        if (available.length === 0) return { complete: true };

        const pick = available[Math.floor(Math.random() * available.length)];
        revealMap.push(pick);

        const updates: any = { reveal_map: JSON.stringify(revealMap) };

        if (revealMap.length === 9) {
            const vault = JSON.parse(profile.reward_vault || '[]');
            vault.push({ day: progress, unlocked_at: new Date().toISOString() });
            updates.reward_vault = JSON.stringify(vault);
            updates.library_progress = progress + 1;
            updates.reveal_map = '[]';
        }

        await this.updateProfile(memberId, updates);
        return { pick, progress, revealMapCount: revealMap.length };
    },

    // --- KNEEL ---
    async claimKneel(memberId: string, amount: number, type: 'coins' | 'points') {
        const profile = await this.getProfile(memberId);
        const updates: any = {
            last_kneel: new Date().toISOString(),
            kneel_count: (profile.kneel_count || 0) + 1
        };

        if (type === 'coins') updates.coins = (profile.coins || 0) + amount;
        else updates.points = (profile.points || 0) + amount;

        await this.updateProfile(memberId, updates);
        return { success: true };
    }
};
