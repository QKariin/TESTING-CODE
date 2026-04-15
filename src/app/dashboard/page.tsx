'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '../../css/dashboard.css';
import '../../css/dashboard-modals.css';
import '../../css/dashboard-mobile.css';
import MobileDashboard from './MobileDashboard';
import { ChallengesContent } from './challenges/page';
import { GlobalContent } from './GlobalContent';

// Scripts
import { initDashboard, showHome, renderMainDashboard } from '@/scripts/dashboard-main';
import { closeModal, reviewTask, cancelReward, confirmReward, toggleRewardRecord, handleRewardFileUpload, selectSticker, openTaskGallery, closeTaskGallery, filterTaskGallery, openModById } from '@/scripts/dashboard-modals';
import { deleteQueueItem, updateTaskQueue, updateDetail } from '@/scripts/dashboard-users';
import { toggleProtocol, toggleNewbieImmunity, closeExclusionModal, sendBroadcast, saveBroadcastPreset, togglePresets, closeBroadcastModal, handleBroadcastFile, openBroadcastModal, openExclusionModal } from '@/scripts/dashboard-protocol';
import { showProfile, switchProfileTab, openProfileUpload } from '@/scripts/dashboard-navigation';
import { switchAdminTab, adjustWallet, manageAltar, adminTaskAction, toggleTaskQueue, expandAdminCategory, updateDashboardAltar, showPosts, submitQueenPost, deleteQueenPost, loadQueenPostsDashboard } from '@/scripts/dashboard-main';
import { closeChatPreview } from '@/scripts/chat';

// State & Actions
import { setUsers, setAvailableDailyTasks, setGlobalQueue, setGlobalTributes, setAdminEmail, users, currId } from '@/scripts/dashboard-state';
import { getAdminDashboardData, getUnreadMessageStatus } from '@/actions/velo-actions';
import { getOptimizedUrl } from '@/scripts/media';
import { renderSidebar, markPendingRead } from '@/scripts/dashboard-sidebar';
import { cleanupPresenceTracking } from '@/scripts/dashboard-presence';

const PAYWALL_PRESETS = [
    "Monthly tribute not received. Pay now.",
    "Punishment - pay for your attitude.",
    "Outstanding debt. You know what you did.",
    "You've been a disappointment. Pay your dues.",
    "Access suspended. Tribute required immediately.",
];

const SILENCE_PRESETS = [
    "You are silenced until further notice.",
    "Disrespect has consequences. Speak when spoken to.",
    "Your access has been revoked.",
    "You crossed a line. Enjoy the silence.",
    "Punishment in effect. No exceptions.",
];

function ReasonPicker({ presets, reason, setReason, useCustom, setUseCustom, customReason, setCustomReason, color }: {
    presets: string[]; reason: string; setReason: (v: string) => void;
    useCustom: boolean; setUseCustom: (v: boolean) => void;
    customReason: string; setCustomReason: (v: string) => void;
    color: string;
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: '0.38rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>REASON</div>
            {presets.map((p, i) => {
                const active = !useCustom && reason === p;
                return (
                    <button key={i} onClick={() => { setUseCustom(false); setReason(p); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: active ? `${color}18` : 'transparent', border: `1px solid ${active ? color + '66' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, padding: '8px 12px', color: active ? color : '#777', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', cursor: 'pointer', marginBottom: 4 }}>
                        {p}
                    </button>
                );
            })}
            <button onClick={() => setUseCustom(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: useCustom ? `${color}18` : 'transparent', border: `1px solid ${useCustom ? color + '66' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, padding: '8px 12px', color: useCustom ? color : '#777', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', cursor: 'pointer', marginBottom: useCustom ? 8 : 0 }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Custom reason...
            </button>
            {useCustom && (
                <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Write your own reason..." style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}40`, borderRadius: 6, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', padding: '8px 12px', resize: 'vertical', minHeight: 70, outline: 'none', boxSizing: 'border-box' }} />
            )}
        </div>
    );
}

function buildGlMsgHtml(msg: any): string {
    const content = msg.message || '';
    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isQueen = msg.is_queen === true || msg.sender_name === 'QUEEN KARIN';
    const name = msg.sender_name || 'SUBJECT';
    const av = msg.sender_avatar;
    const SVG_CROWN = `<svg width="13" height="10" viewBox="0 0 26 20" fill="#c5a059" style="flex-shrink:0;"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
    const _imgErr = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);}"`;
    const _vidErr = `onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src='/api/media?url='+encodeURIComponent(this.src);this.load();}"`;
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:5px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;"><div style="font-family:'Orbitron';font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:2px;">${(msg.reply_to.sender_name||'').replace(/</g,'&lt;')}</div><div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content||'').slice(0,60).replace(/</g,'&lt;')}</div></div>` : '';

    // PROMOTION CARD
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo?'display:none;':''}position:absolute;inset:0;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:56px;height:56px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.3rem;color:#c5a059;">${ini}</div></div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:130px;background:#0a0703;overflow:hidden;">${photoBlock}${photoFallback}<div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div><div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">RANK PROMOTION</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${d.name||''}</div><div style="display:flex;align-items:center;justify-content:center;gap:10px;"><span style="font-family:'Orbitron',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span><span style="color:rgba(197,160,89,0.7);">→</span><span style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE JOIN CARD
    if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#060e08 0%,#040d06 60%,#030a04 100%);border:1px solid rgba(74,222,128,0.45);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:120px;background:#030a04;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,0.6);position:relative;">${photoBlock}<div style="${d.photo?'display:none;':''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.1);font-family:'Cinzel';font-size:1.1rem;color:#4ade80;">${ini}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#060e08 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(3,10,4,0.9);border:1px solid rgba(74,222,128,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:3px;">⚔ JOINED CHALLENGE</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.88rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(74,222,128,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE ELIM CARD
    if (content.startsWith('CHALLENGE_ELIM_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_ELIM_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0606 0%,#0d0404 60%,#0a0303 100%);border:1px solid rgba(224,48,48,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:120px;background:#0a0303;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(224,48,48,0.5);position:relative;">${photoBlock}<div style="${d.photo?'display:none;':''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(224,48,48,0.1);font-family:'Cinzel';font-size:1.1rem;color:#e03030;">${ini}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0606 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,3,3,0.9);border:1px solid rgba(224,48,48,0.45);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:#e03030;letter-spacing:3px;">✕ ELIMINATED</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Cinzel',serif;font-size:0.88rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(224,48,48,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">STILL IN: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE TASK CARD
    if (content.startsWith('CHALLENGE_TASK_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_TASK_CARD::',''));
            const passed = d.passed !== false;
            const ac = passed ? '#4ade80' : '#e03030';
            const acBg = passed ? 'rgba(74,222,128,0.05)' : 'rgba(224,48,48,0.05)';
            const acBorder = passed ? 'rgba(74,222,128,0.25)' : 'rgba(224,48,48,0.25)';
            const label = passed ? '✓ TASK PASSED' : '✕ TASK FAILED';
            const sub = `Day ${d.dayNumber||'?'} · Task ${d.windowNumber||'?'}${passed&&d.points?` · +${d.points}pts`:''}`;
            const ini = (d.senderName||'S')[0].toUpperCase();
            const avImg = d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.65rem;color:${ac};">${ini}</div>`;
            return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;"><div style="width:88%;min-width:220px;max-width:440px;"><div style="background:${acBg};border:1px solid ${acBorder};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;border:1.5px solid ${acBorder};overflow:hidden;position:relative;flex-shrink:0;">${avImg}</div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.42rem;color:${ac};letter-spacing:1px;margin-bottom:2px;">${label}</div><div style="font-family:'Cinzel';font-size:0.85rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.45);margin-top:2px;">${sub}</div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE MERIT CARD
    if (content.startsWith('UPDATE_MERIT_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::',''));
            const ini = (d.senderName||'S')[0].toUpperCase();
            const avImg = d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.65rem;color:#a78bfa;">${ini}</div>`;
            return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;"><div style="width:88%;min-width:220px;max-width:440px;"><div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">${avImg}</div><div style="flex:1;min-width:0;"><div style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">⚡ MERIT EARNED</div><div style="font-family:'Cinzel';font-size:0.85rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Orbitron';font-size:0.8rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points||0} MERIT</div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::',''));
            const ini = (d.senderName||'S')[0].toUpperCase();
            const coverSrc = d.image || d.senderAvatar || '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.35);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);"><div style="width:100%;height:110px;overflow:hidden;position:relative;background:#0d0d1a;display:flex;align-items:center;justify-content:center;">${coverSrc?`<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`:`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:2rem;color:rgba(197,160,89,0.4);">${ini}</div>`}<div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(10,10,20,0.88) 100%);"></div><div style="position:absolute;bottom:8px;left:12px;font-family:'Orbitron';font-size:0.38rem;color:rgba(197,160,89,0.75);letter-spacing:2px;">✦ GIFT SENT</div></div><div style="padding:10px 14px 12px;"><div style="font-family:'Cinzel';font-size:0.82rem;color:#fff;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${d.title||''}</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;"><span style="font-family:'Orbitron';font-size:0.4rem;color:rgba(255,255,255,0.55);">${d.senderName||''}</span><span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);">${time}</span></div></div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE PHOTO CARD
    if (content.startsWith('UPDATE_PHOTO_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_PHOTO_CARD::',''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.2);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);"><img src="${d.mediaUrl}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'"><div style="padding:10px 14px 12px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-family:'Cinzel';font-size:0.75rem;color:#fff;font-weight:700;">${d.senderName||''}</span><span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.35);">${time}</span></div>${d.caption?`<div style="font-family:'Rajdhani';font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:3px;">${d.caption}</div>`:''}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // GIF
    if ((msg.media_type === 'gif' || (msg.message === '[GIF]' && msg.media_url)) && msg.media_url) {
        return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:65%;min-width:180px;max-width:320px;"><div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 30px rgba(0,0,0,0.8);"><div style="width:100%;overflow:hidden;background:#0a0703;"><img src="${msg.media_url}" ${_imgErr} style="width:100%;display:block;max-height:200px;object-fit:contain;" /></div><div style="padding:8px 14px 12px;text-align:center;border-top:1px solid rgba(197,160,89,0.1);"><div style="font-family:'Cinzel',serif;font-size:0.78rem;color:#fff;font-weight:700;letter-spacing:2px;">${name}</div></div></div><div style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:3px;letter-spacing:1px;">${time}</div></div></div>`;
    }

    // Skip SYSTEM messages
    if (msg.sender_name === 'SYSTEM') return '';

    // Media inline
    const mediaHtml = msg.media_url && msg.media_type !== 'gif' ? (
        msg.media_type === 'video'
            ? `<video src="${msg.media_url}" controls playsinline preload="metadata" ${_vidErr} style="width:100%;border-radius:8px;margin-top:8px;max-height:260px;object-fit:cover;display:block;"></video>`
            : `<img src="${msg.media_url}" ${_imgErr} style="width:100%;border-radius:8px;margin-top:8px;max-height:260px;object-fit:cover;display:block;" />`
    ) : '';

    // Queen bubble
    if (isQueen) {
        const qAv = av ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;" onerror="this.style.display='none'">` : `<img src="/queen-karin.png" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;">`;
        return `<div style="margin-bottom:8px;"><div style="padding:9px 13px 11px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.1);"><div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">${qAv}<div style="display:flex;align-items:center;gap:4px;">${SVG_CROWN}<span style="font-family:'Cinzel',serif;font-size:0.65rem;color:#c5a059;letter-spacing:1px;font-weight:700;">QUEEN KARIN</span></div><span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(197,160,89,0.55);"> · ${time}</span></div>${quoteHtml}<div style="font-family:'Cinzel',serif;font-size:0.88rem;color:rgba(255,255,255,0.6);line-height:1.5;">${content}</div>${mediaHtml}</div></div>`;
    }

    // Regular user bubble
    const initial = (name[0]||'S').toUpperCase();
    const userAv = av ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.35);flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:22px;height:22px;border-radius:50%;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:'Cinzel';font-size:0.42rem;color:#c5a059;flex-shrink:0;">${initial}</div>`;
    return `<div style="margin-bottom:8px;"><div style="padding:9px 13px 11px;background:rgba(255,255,255,0.02);border:1px solid rgba(180,180,200,0.18);border-radius:10px;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">${userAv}<span style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.6);letter-spacing:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span><span style="font-family:'Orbitron';font-size:0.35rem;color:rgba(255,255,255,0.3);white-space:nowrap;flex-shrink:0;"> · ${time}</span></div>${quoteHtml}<div style="font-family:'Rajdhani',sans-serif;font-size:0.92rem;color:rgba(255,255,255,0.7);line-height:1.45;">${content}</div>${mediaHtml}</div></div>`;
}

function LeadsPanel() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leads').then(r => r.json()).then(d => {
            if (d.success) setLeads(d.leads);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const providerIcon = (p: string) => {
        if (p === 'google') return '🔵';
        if (p === 'twitter') return '🐦';
        return '✉';
    };

    return (
        <div className="glass-card span-2" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,80,80,0.12)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 14, background: 'rgba(255,80,80,0.7)', borderRadius: 2 }} />
                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: 'rgba(255,100,100,0.85)', letterSpacing: '3px' }}>KNOCKING AT THE GATE</div>
                </div>
                <div style={{ fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>{leads.length} LEADS</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>}
                {!loading && leads.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px' }}>NO LEADS YET</div>}
                {leads.map((l: any) => {
                    const first = new Date(l.first_seen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const last = new Date(l.last_seen).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                    return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{providerIcon(l.provider)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Rajdhani', fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.32rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', marginTop: 2 }}>first: {first} · last attempt: {last}</div>
                            </div>
                            {l.attempts > 1 && (
                                <span style={{ flexShrink: 0, fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(255,100,100,0.6)', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.15)', borderRadius: 10, padding: '2px 7px', letterSpacing: '0.5px' }}>{l.attempts}×</span>
                            )}
                            <button
                                onClick={() => navigator.clipboard?.writeText(l.email)}
                                title="Copy email"
                                style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', padding: '3px 7px', cursor: 'pointer' }}
                            >⎘</button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function GlobalChatPanel({ userEmail }: { userEmail: string | null }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);
    const renderedIdsRef = useRef(new Set<string>());
    const initialDoneRef = useRef(false);

    function appendToFeed(msgs: any[], scrollToBottom: boolean) {
        const feed = feedRef.current;
        if (!feed) return;
        const wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
        for (const msg of msgs) {
            const html = buildGlMsgHtml(msg);
            if (!html) continue;
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            const child = wrap.firstElementChild;
            if (child) feed.appendChild(child);
            renderedIdsRef.current.add(String(msg.id ?? msg.created_at));
        }
        if (scrollToBottom || wasNear) {
            setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 30);
        }
    }

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/global/messages', { cache: 'no-store' });
            const data = await res.json();
            if (!data.messages) return;
            const msgs = (data.messages as any[]).slice(-80);
            if (!initialDoneRef.current) {
                initialDoneRef.current = true;
                appendToFeed(msgs, true);
            } else {
                const newMsgs = msgs.filter((m: any) => !renderedIdsRef.current.has(String(m.id ?? m.created_at)));
                if (newMsgs.length > 0) appendToFeed(newMsgs, false);
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
        // Realtime: push new global messages instantly instead of polling every 5s
        const supabaseRt = createClient();
        const channel = supabaseRt
            .channel('global-messages-live')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'global_messages',
            }, (payload: any) => {
                const msg = payload.new;
                if (!msg) return;
                appendToFeed([msg], false);
            })
            .subscribe();
        return () => { supabaseRt.removeChannel(channel); };
    }, [load]);

    async function send() {
        if (!text.trim() || !userEmail || sending) return;
        setSending(true);
        try {
            await fetch('/api/global/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderEmail: userEmail, message: text.trim() }),
            });
            setText('');
            await load();
        } catch {}
        setSending(false);
    }

    return (
        <div className="v-kneel-card glass-card span-2" style={{ display: 'flex', flexDirection: 'column', height: 720, padding: 0 }}>
            <div className="vk-header" style={{ padding: '14px 20px 10px', flexShrink: 0 }}>
                <div className="vk-title">Global Chat</div>
                <div className="vk-sub">Community Feed</div>
            </div>
            <div
                ref={feedRef}
                style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 4px', minHeight: 0 }}
            />
            <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Send to global..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', padding: '8px 12px', outline: 'none' }}
                />
                <button onClick={send} disabled={sending || !text.trim()} style={{ background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 6, color: '#000', fontFamily: 'Orbitron', fontSize: '0.42rem', fontWeight: 700, padding: '8px 16px', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !text.trim() ? 0.5 : 1, letterSpacing: '1px' }}>
                    SEND
                </button>
            </div>
        </div>
    );
}

function LockModal({ memberId, onClose, onLocked }: { memberId: string; onClose: () => void; onLocked: (type: 'paywall' | 'silence') => void }) {
    const [tab, setTab] = useState<'paywall' | 'silence'>('paywall');
    const [reason, setReason] = useState(PAYWALL_PRESETS[0]);
    const [customReason, setCustomReason] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const switchTab = (t: 'paywall' | 'silence') => {
        setTab(t);
        setReason(t === 'paywall' ? PAYWALL_PRESETS[0] : SILENCE_PRESETS[0]);
        setUseCustom(false); setCustomReason(''); setError('');
    };

    const activate = async () => {
        const finalReason = useCustom ? customReason.trim() : reason;
        if (!finalReason) { setError('Select or write a reason.'); return; }
        if (tab === 'paywall' && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
            setError('Enter a valid amount.'); return;
        }
        setLoading(true); setError('');
        try {
            const url = tab === 'paywall' ? '/api/paywall/lock' : '/api/silence/lock';
            const body = tab === 'paywall'
                ? { memberId, reason: finalReason, amount: Number(amount) }
                : { memberId, reason: finalReason };
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) { onLocked(tab); onClose(); }
            else setError(data.error || 'Failed');
        } catch { setError('Network error'); }
        setLoading(false);
    };

    const isPaywall = tab === 'paywall';
    const accentColor = isPaywall ? '#c5a059' : '#e03030';
    const borderColor = isPaywall ? 'rgba(197,160,89,0.3)' : 'rgba(200,40,40,0.35)';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0a0a0a', border: `1px solid ${borderColor}`, borderRadius: 14, padding: '24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.52rem', color: accentColor, letterSpacing: '3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                        LOCK USER
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>&times;</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                    <button onClick={() => switchTab('paywall')} style={{ flex: 1, padding: '10px', background: isPaywall ? 'rgba(197,160,89,0.12)' : 'transparent', border: `1px solid ${isPaywall ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: isPaywall ? '#c5a059' : '#555', fontFamily: 'Orbitron', fontSize: '0.42rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        PAYWALL
                    </button>
                    <button onClick={() => switchTab('silence')} style={{ flex: 1, padding: '10px', background: !isPaywall ? 'rgba(200,40,40,0.1)' : 'transparent', border: `1px solid ${!isPaywall ? 'rgba(200,40,40,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: !isPaywall ? '#e03030' : '#555', fontFamily: 'Orbitron', fontSize: '0.42rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        SILENCE
                    </button>
                </div>

                <ReasonPicker
                    presets={isPaywall ? PAYWALL_PRESETS : SILENCE_PRESETS}
                    reason={reason} setReason={setReason}
                    useCustom={useCustom} setUseCustom={setUseCustom}
                    customReason={customReason} setCustomReason={setCustomReason}
                    color={accentColor}
                />

                {isPaywall && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.38rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>AMOUNT (€)</div>
                        <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 50" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#fff', fontFamily: 'Orbitron,sans-serif', fontSize: '1rem', padding: '10px 14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                )}

                {error && <div style={{ color: '#ff5555', fontFamily: 'Orbitron', fontSize: '0.38rem', marginBottom: 12 }}>{error}</div>}

                <button onClick={activate} disabled={loading} style={{ width: '100%', padding: '13px', background: isPaywall ? 'linear-gradient(135deg,#c5a059,#8b6914)' : 'linear-gradient(135deg,#b02020,#7a1010)', border: 'none', borderRadius: 8, color: isPaywall ? '#000' : '#fff', fontFamily: 'Orbitron', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'LOCKING...' : (isPaywall ? 'ACTIVATE PAYWALL' : 'SILENCE USER')}
                </button>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [lockTarget, setLockTarget] = useState<string | null>(null);
    const [activeLocks, setActiveLocks] = useState<{ paywall: boolean; silenced: boolean }>({ paywall: false, silenced: false });
    const [showLocksModal, setShowLocksModal] = useState(false);
    const [lockedUsers, setLockedUsers] = useState<any[]>([]);
    const [challengeWidget, setChallengeWidget] = useState<{ name: string; theme: string; activeCount: number; totalCount: number; leader: string | null; isUpcoming?: boolean; startDate?: string; image_url?: string | null; description?: string; duration_days?: number; tasks_per_day?: number; window_minutes?: number; start_date_raw?: string } | null>(null);
    const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
    const [showChallenges, setShowChallenges] = useState(false);
    const [showGlobal, setShowGlobal] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        if (isMobile) return; // mobile dashboard handles its own data
        const fetchChallenge = async () => {
            try {
                const res = await fetch('/api/challenges');
                const json = await res.json();
                const nowMs = Date.now();
                const active = (json.challenges || []).find((c: any) => c.status === 'active');
                const upcoming = !active && (json.challenges || []).find((c: any) =>
                    c.status === 'draft' && c.start_date && new Date(c.start_date).getTime() > nowMs
                );
                const found = active || upcoming;
                if (!found) { setChallengeWidget(null); return; }
                if (upcoming) {
                    const diff = Math.max(0, Math.floor((new Date(upcoming.start_date).getTime() - nowMs) / 1000));
                    const h = Math.floor(diff / 3600);
                    const m = Math.floor((diff % 3600) / 60);
                    setChallengeWidget({
                        name: upcoming.name, theme: upcoming.theme,
                        activeCount: upcoming.participant_active || 0,
                        totalCount: upcoming.participant_total || 0,
                        leader: null, isUpcoming: true,
                        startDate: `${h}h ${m}m`,
                        image_url: upcoming.image_url || null,
                        description: upcoming.description || '',
                        duration_days: upcoming.duration_days,
                        tasks_per_day: upcoming.tasks_per_day,
                        window_minutes: upcoming.window_minutes,
                        start_date_raw: upcoming.start_date,
                    });
                    return;
                }
                const det = await fetch(`/api/challenges/${active.id}`);
                const d = await det.json();
                const leader = d.leaderboard?.find((p: any) => p.status === 'active' || p.status === 'champion');
                setChallengeWidget({
                    name: active.name, theme: active.theme,
                    activeCount: active.participant_active || 0,
                    totalCount: active.participant_total || 0,
                    leader: leader?.name || null,
                    image_url: active.image_url || null,
                    description: active.description || '',
                    duration_days: active.duration_days,
                    tasks_per_day: active.tasks_per_day,
                    window_minutes: active.window_minutes,
                });
                setPendingVerificationCount((d.pending_verifications || []).length);
            } catch { /* silent */ }
        };
        fetchChallenge();
    }, [isMobile]);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/'); // Redirect to home/login
    };
    useEffect(() => {
        // Fetch current user email
        const getCurrUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
                setAdminEmail(user.email);
            }
        };
        getCurrUser();

        // Expose lock state setter so vanilla updateDetail can push state into React
        (window as any)._setActiveLocks = setActiveLocks;

        // Inject scripts into window for legacy compatibility (DOM onclick handlers)
        if (typeof window !== 'undefined') {
            // Wrapped with mobile nav sync
            (window as any).showHome = () => {
                setShowChallenges(false);
                markPendingRead(); // leaving a chat - mark it as read now
                showHome();
                document.querySelector('.sidebar')?.classList.remove('mob-open');
                document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
                document.getElementById('mobNavHome')?.classList.add('active');
            };
            (window as any).showProfile = (id?: string) => {
                setShowChallenges(false);
                if (!id) markPendingRead(); // navigating to Queen view - leaving chat
                (showProfile as any)(id);
                if (id) {
                    // Opening a user's detail - close subjects drawer
                    document.querySelector('.sidebar')?.classList.remove('mob-open');
                }
            };
            (window as any).closeModal = closeModal;
            (window as any).reviewTask = reviewTask;
            (window as any).cancelReward = cancelReward;
            (window as any).confirmReward = confirmReward;
            (window as any).toggleRewardRecord = toggleRewardRecord;
            (window as any).handleRewardFileUpload = handleRewardFileUpload;
            (window as any).selectSticker = selectSticker;
            (window as any).toggleProtocol = toggleProtocol;
            (window as any).toggleNewbieImmunity = toggleNewbieImmunity;
            (window as any).closeExclusionModal = closeExclusionModal;
            (window as any).sendBroadcast = sendBroadcast;
            (window as any).saveBroadcastPreset = saveBroadcastPreset;
            (window as any).togglePresets = togglePresets;
            (window as any).closeBroadcastModal = closeBroadcastModal;
            (window as any).handleBroadcastFile = handleBroadcastFile;
            (window as any).openBroadcastModal = openBroadcastModal;
            (window as any).openExclusionModal = openExclusionModal;
            (window as any).switchAdminTab = switchAdminTab;
            (window as any).adjustWallet = adjustWallet;
            (window as any).manageAltar = manageAltar;
            (window as any).adminTaskAction = adminTaskAction;
            (window as any).toggleTaskQueue = toggleTaskQueue;
            (window as any).expandAdminCategory = expandAdminCategory;
            (window as any).updateDashboardAltar = updateDashboardAltar;
            (window as any).openTaskGallery = openTaskGallery;
            (window as any).closeTaskGallery = closeTaskGallery;
            (window as any).filterTaskGallery = filterTaskGallery;
            (window as any).deleteQueueItem = deleteQueueItem;
            (window as any).updateTaskQueue = updateTaskQueue;
            (window as any).openModById = openModById;
            (window as any).switchProfileTab = switchProfileTab;
            (window as any).openProfileUpload = openProfileUpload;
            (window as any).showPosts = () => {
                setShowChallenges(false);
                markPendingRead(); // leaving a chat - mark it as read now
                showPosts();
                document.querySelector('.sidebar')?.classList.remove('mob-open');
                document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
                document.getElementById('mobNavPosts')?.classList.add('active');
            };
            (window as any).submitQueenPost = submitQueenPost;
            (window as any).deleteQueenPost = deleteQueenPost;
            (window as any).loadQueenPostsDashboard = loadQueenPostsDashboard;
            (window as any).closeChatPreview = closeChatPreview;
            (window as any).toggleDashSystemLog = () => import('@/scripts/dashboard-chat').then(m => m.toggleDashSystemLog());

            // Mobile nav controller
            (window as any).mobNav = (tab: string) => {
                const sidebar = document.querySelector('.sidebar');
                document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
                const btnMap: Record<string, string> = { home: 'mobNavHome', subs: 'mobNavSubs', posts: 'mobNavPosts', queen: 'mobNavQueen' };
                document.getElementById(btnMap[tab])?.classList.add('active');
                if (tab === 'subs') {
                    sidebar?.classList.add('mob-open');
                    ['viewHome', 'viewPosts', 'viewProfile', 'viewUser'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = 'none';
                    });
                } else {
                    sidebar?.classList.remove('mob-open');
                    if (tab === 'home') showHome();
                    else if (tab === 'posts') showPosts();
                    else if (tab === 'queen') showProfile();
                }
            };

            // Additional Bindings from scripts
            (window as any).initDashboard = initDashboard;
            (window as any).handleLogout = handleLogout;
        }

        // 1. Initialize System (UI Listeners)
        initDashboard();

        // 2. Fetch Real Data & Hydrate State
        const loadLiveAction = async () => {
            const [data, unreadMap] = await Promise.all([
                getAdminDashboardData(),
                getUnreadMessageStatus(),
            ]);

            if (data.success && data.users) {
                const mappedUsers = data.users.map((u: any) => {
                    const msgFromMessages = unreadMap[u.memberId || u.member_id];
                    const msgFromParams = u.parameters?.lastMessageTime;
                    const rawMsgTime = msgFromMessages || msgFromParams || null;
                    const lastMessageTime = rawMsgTime ? new Date(rawMsgTime).getTime() : 0;
                    const lastSeen = u.lastSeen || u.last_active || u.lastWorship || null;
                    return {
                        ...u,
                        avatar: getOptimizedUrl(u.avatar || u.avatar_url || u.profile_picture_url || '/collar-placeholder.png', 100),
                        lastMessageTime,
                        lastSeen,
                    };
                });

                setUsers(mappedUsers);

                try {
                    const readRes = await fetch('/api/chat/mark-read?type=admin');
                    const readData = await readRes.json();
                    const serverReadMap = readData.chatRead || {};
                    Object.entries(serverReadMap).forEach(([email, ts]) => {
                        const key = 'read_' + email;
                        const localTs = parseInt(localStorage.getItem(key) || '0');
                        const serverTs = new Date(ts as string).getTime();
                        if (serverTs > localTs) localStorage.setItem(key, serverTs.toString());
                    });
                } catch {}

                setAvailableDailyTasks(data.dailyTasks || []);

                const allQueues = data.globalQueue || [];
                setGlobalQueue(allQueues);
                mappedUsers.forEach((u: any) => {
                    u.reviewQueue = allQueues.filter((t: any) => t.member_id === u.memberId || t.ownerId === u.memberId);
                });

                const allTributes = mappedUsers.flatMap((u: any) => {
                    let history: any[] = [];
                    try {
                        const raw = u.parameters?.tributeHistory;
                        if (raw) history = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch {}
                    return history.map((t: any) => ({ ...t, memberId: u.memberId, memberName: u.name, memberAvatar: u.avatar }));
                }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setGlobalTributes(allTributes);

                renderMainDashboard();

                if (currId) {
                    const openUser = mappedUsers.find((u: any) => u.memberId === currId || u.member_id === currId);
                    if (openUser) updateDetail(openUser);
                }

                setTimeout(() => {
                    const src = document.getElementById('adminDailyCode');
                    const mob = document.getElementById('adminDailyCodeMob');
                    if (src && mob) mob.textContent = src.textContent;
                }, 400);
            }
        };

        // Expose so the lock modal can force an immediate refresh after lock/unlock
        (window as any)._refreshDashboard = loadLiveAction;

        if (isMobile) return; // mobile dashboard handles its own data - no duplicate load
        loadLiveAction();
        // Poll every 60s - Realtime handles chat; this is just a periodic sync fallback
        const pollInterval = setInterval(loadLiveAction, 10000);

        // ── Supabase Realtime: instant push on new chat messages ──────────────
        // Requires Realtime to be enabled for the 'chats' table in Supabase dashboard
        const supabaseRt = createClient();
        const realtimeChannel = supabaseRt
            .channel('chats-admin-live')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
            }, (payload: any) => {
                const msg = payload.new;
                if (!msg) return;

                // Ignore messages sent by admin/Queen
                const isQueenMsg = msg.metadata?.isQueen === true;
                if (isQueenMsg) return;

                const memberId = (msg.member_id || '').toLowerCase();
                if (!memberId) return;

                const msgTime = new Date(msg.created_at).getTime();

                // Patch the user's lastMessageTime in state so sidebar lights up
                const updatedUsers = users.map((u: any) => {
                    const uid = (u.memberId || u.member_id || '').toLowerCase();
                    if (uid === memberId) {
                        return { ...u, lastMessageTime: Math.max(u.lastMessageTime || 0, msgTime) };
                    }
                    return u;
                });
                setUsers(updatedUsers);

                // Re-render sidebar - sound + pink SVG glow handled inside renderSidebar
                renderSidebar();
            })
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            supabaseRt.removeChannel(realtimeChannel);
            cleanupPresenceTracking();
        };
    }, []);

    // ── MOBILE: render completely separate mobile dashboard ──────────────────
    if (isMobile) {
        return <MobileDashboard userEmail={userEmail || ''} />;
    }

    return (
        <div className="layout">
            {/* MOBILE TOP BAR */}
            <div className="mob-top-bar">
                <div className="mob-top-brand">Command Center</div>
                <div id="adminDailyCodeMob" className="mob-top-code">----</div>
            </div>

            {/* SIDEBAR */}
            <div className="sidebar">
                <div className="sb-dash-btn" onClick={() => (window as any).showHome()}>DASHBOARD</div>
                <div
                    className="sb-dash-btn"
                    onClick={() => (window as any).showPosts()}
                    style={{ backgroundImage: 'linear-gradient(135deg, rgba(197,160,89,0.08), transparent)', borderBottom: '1px solid rgba(197,160,89,0.2)', color: '#c5a059' }}
                >✦ POSTS</div>
                <div
                    className="sb-dash-btn"
                    onClick={() => setShowChallenges(true)}
                    style={{ backgroundImage: 'linear-gradient(135deg, rgba(74,222,128,0.06), transparent)', borderBottom: '1px solid rgba(74,222,128,0.15)', color: showChallenges ? '#4ade80' : '#4ade8099', position: 'relative', cursor: 'pointer', boxShadow: showChallenges ? 'inset 3px 0 0 #4ade80' : 'none' }}
                >⚔ CHALLENGES{pendingVerificationCount > 0 && <span style={{ position: 'absolute', top: 8, right: 12, background: '#e03030', color: '#fff', borderRadius: 10, padding: '2px 7px', fontFamily: 'Orbitron', fontSize: '0.38rem', fontWeight: 700, letterSpacing: '0.5px' }}>{pendingVerificationCount}</span>}</div>
                <div
                    className="sb-dash-btn"
                    onClick={() => { setShowChallenges(false); setShowGlobal(true); }}
                    style={{ backgroundImage: 'linear-gradient(135deg, rgba(197,160,89,0.06), transparent)', borderBottom: '1px solid rgba(197,160,89,0.15)', color: showGlobal ? 'var(--gold)' : 'rgba(255,255,255,0.45)', position: 'relative', cursor: 'pointer', boxShadow: showGlobal ? 'inset 3px 0 0 var(--gold)' : 'none' }}
                >⊕ GLOBAL</div>
                <div style={{ textAlign: 'center', padding: '5px', borderBottom: '1px solid #333' }}>
                    <div style={{ fontSize: '0.5rem', color: '#666' }}>TODAY'S ID</div>
                    <div id="adminDailyCode" style={{ color: 'var(--gold)', fontWeight: 900, fontFamily: 'Orbitron', fontSize: '1.1rem', letterSpacing: '2px' }}>----</div>
                </div>
                <div className="sb-head">SUB LIST</div>
                <div id="userList" className="user-list"></div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="content" style={{ position: 'relative' }}>

                {/* CHALLENGES INLINE PANEL - overlays content area when open */}
                {showChallenges && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#04040e' }}>
                        <ChallengesContent onClose={() => setShowChallenges(false)} />
                    </div>
                )}

                {/* GLOBAL INLINE PANEL - overlays content area when open */}
                {showGlobal && (
                    <GlobalContent onClose={() => setShowGlobal(false)} userEmail={userEmail} />
                )}

                {/* 1. HOME VIEW */}
                <div id="viewHome">
                    <div className="v-header">
                        <div className="v-header-left">
                            <div className="v-breadcrumb">Pages / Dashboard</div>
                            <div className="v-title">Dashboard</div>
                        </div>
                    </div>

                    <div className="v-grid-stats">
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Today's Tributes</div>
                                <div className="vs-val" id="statTributes">0 <span className="vs-perc">+55%</span></div>
                            </div>
                            <div className="vs-icon gold-bg">💰</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Active Slaves</div>
                                <div className="vs-val" id="statActive">0 <span className="vs-perc">+5%</span></div>
                            </div>
                            <div className="vs-icon gold-bg">👤</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Pending Reviews</div>
                                <div className="vs-val" id="statPending">0 <span className="vs-perc neg">-14%</span></div>
                            </div>
                            <div className="vs-icon gold-bg">📝</div>
                        </div>
                        <div className="v-stat-card glass-card">
                            <div className="vs-info">
                                <div className="vs-label">Total Failures</div>
                                <div className="vs-val" id="statSkipped">0 <span className="vs-perc">+8%</span></div>
                            </div>
                            <div className="vs-icon gold-bg">⚠️</div>
                        </div>
                    </div>

                    <div className="v-grid-main">
                        {/* HERO CARD */}
                        <div className="v-hero-card glass-card span-2"
                            style={{ backgroundImage: `linear-gradient(rgba(15, 12, 5, 0.2), rgba(5, 5, 10, 0.9)), url('/hero-bg.png')`, border: '1px solid rgba(197, 160, 89, 0.2)' }}>
                            <div className="vh-content">
                                <div className="vh-title">Welcome back,<br />Queen Karin</div>
                                <div className="vh-sub" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div>System dominance is at 98%. <br />Manage your subjects below.</div>
                                    <div style={{ color: '#aaa', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                        <span>Logged in as: <b>{userEmail || '...'}</b></span>
                                        <button
                                            onClick={handleLogout}
                                            style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Orbitron' }}
                                        >LOGOUT</button>
                                    </div>
                                </div>
                            </div>
                            <div className="vh-footer">Tap to record →</div>
                        </div>

                        {/* CHALLENGES WIDGET */}
                        <div className="v-gauge-card glass-card span-1"
                            onClick={() => setShowChallenges(true)}
                            style={{ border: `1px solid ${challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.4)' : 'rgba(74,222,128,0.3)') : 'rgba(197,160,89,0.15)'}`, cursor: 'pointer', transition: 'border-color 0.2s', padding: 0, overflow: 'hidden' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.7)' : 'rgba(74,222,128,0.6)') : 'rgba(197,160,89,0.4)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.4)' : 'rgba(74,222,128,0.3)') : 'rgba(197,160,89,0.15)')}>
                            <div className="vg-header" style={{ padding: '12px 16px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="vg-title" style={{ color: challengeWidget ? (challengeWidget.isUpcoming ? '#c5a059' : '#4ade80') : '#c5a059' }}>CHALLENGES</div>
                                    {pendingVerificationCount > 0 && (
                                        <span style={{ background: '#e03030', color: '#fff', borderRadius: 10, padding: '2px 7px', fontFamily: 'Orbitron', fontSize: '0.36rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                                            {pendingVerificationCount} TO VALIDATE
                                        </span>
                                    )}
                                </div>
                                <div className="vg-sub" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setShowChallenges(true); }}>MANAGE ↗</div>
                            </div>
                            {challengeWidget ? (
                                <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${challengeWidget.isUpcoming ? 'rgba(197,160,89,0.15)' : 'rgba(74,222,128,0.1)'}` }}>
                                    {/* Image */}
                                    <div style={{ width: 120, flexShrink: 0, position: 'relative', background: 'rgba(197,160,89,0.04)', minHeight: 200 }}>
                                        {challengeWidget.image_url
                                            ? <img src={challengeWidget.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} alt={challengeWidget.name} />
                                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', opacity: 0.15 }}>★</div>
                                        }
                                        <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: 6, padding: '3px 8px', fontFamily: 'Orbitron', fontSize: '0.32rem', fontWeight: 700, letterSpacing: '1px', background: challengeWidget.isUpcoming ? 'rgba(251,191,36,0.9)' : 'rgba(74,222,128,0.9)', color: '#000' }}>
                                            {challengeWidget.isUpcoming ? 'SOON' : 'LIVE'}
                                        </div>
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-between', minWidth: 0 }}>
                                        <div>
                                            <div style={{ fontFamily: 'Cinzel', fontSize: '0.95rem', color: '#fff', fontWeight: 700, letterSpacing: '1px', marginBottom: 4 }}>{challengeWidget.name}</div>
                                            {challengeWidget.description && <div style={{ fontFamily: 'Cinzel', fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, letterSpacing: '0.5px' }}>{challengeWidget.description}</div>}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {[
                                                { label: 'Days', val: String(challengeWidget.duration_days ?? '-') },
                                                { label: 'Tasks a day', val: String(challengeWidget.tasks_per_day ?? '-') },
                                                { label: 'Window', val: challengeWidget.window_minutes ? `${challengeWidget.window_minutes} min` : '-' },
                                                { label: 'Still working', val: String(challengeWidget.activeCount) },
                                                ...(challengeWidget.isUpcoming && challengeWidget.start_date_raw ? [{ label: 'Starts', val: new Date(challengeWidget.start_date_raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }] : []),
                                                ...(!challengeWidget.isUpcoming ? [{ label: 'Eliminated', val: String(challengeWidget.totalCount - challengeWidget.activeCount) }] : []),
                                            ].map(({ label, val }) => (
                                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.38)' }}>{label}</span>
                                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'rgba(197,160,89,0.9)', fontWeight: 700 }}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: '7px 0', borderRadius: 8, background: 'linear-gradient(135deg,#c5a059 0%,#8b6914 100%)', color: '#000', fontFamily: 'Orbitron', fontSize: '0.45rem', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', boxShadow: '0 4px 15px rgba(197,160,89,0.3)' }}>
                                            {challengeWidget.isUpcoming ? 'VIEW CHALLENGE' : 'MANAGE CHALLENGE'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 16px' }}>
                                    <div style={{ fontSize: '2rem', opacity: 0.3 }}>★</div>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.38rem', color: '#333', letterSpacing: '2px', textAlign: 'center' }}>NO ACTIVE CHALLENGE</div>
                                    <div style={{ padding: '8px 18px', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 4, fontFamily: 'Orbitron', fontSize: '0.38rem', color: '#c5a059', letterSpacing: '2px' }}>CREATE ONE ↗</div>
                                </div>
                            )}
                        </div>

                        {/* ENTER GLOBAL */}
                        <div className="v-best-sub glass-card span-1" onClick={() => window.location.href = '/global'} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(197,160,89,0.06), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.22)', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.5)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.22)')}>
                            <div className="vb-header">
                                <div className="vb-title" style={{ fontFamily: 'Cinzel', color: '#c5a059', letterSpacing: '2px' }}>GLOBAL</div>
                                <div className="vb-sub">Community Hub</div>
                            </div>
                            <div className="vb-content">
                                <div style={{ width: 64, height: 64, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, background: 'rgba(197,160,89,0.06)', boxShadow: '0 0 24px rgba(197,160,89,0.12)' }}>
                                    <span style={{ fontSize: '1.6rem', color: '#c5a059', opacity: 0.85 }}>◎</span>
                                </div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.45rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '2px' }}>LEADERBOARD · TALK · QUEEN</div>
                                <div style={{ marginTop: 10, padding: '5px 18px', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 4, fontFamily: 'Orbitron', fontSize: '0.42rem', color: '#c5a059', letterSpacing: '2px', background: 'rgba(197,160,89,0.08)' }}>ENTER ↗</div>
                            </div>
                        </div>

                        {/* GLOBAL CHAT */}
                        <GlobalChatPanel userEmail={userEmail} />

                        {/* OPERATIONS MONITOR */}
                        <div className="v-monitor-card glass-card span-2">
                            <div className="vm-header">Operations Monitor</div>
                            <div id="opsList" className="vm-body"></div>
                        </div>

                        {/* REVENUE & INTEL STREAM */}
                        <div className="v-feed-card glass-card span-2">
                            <div className="vf-header">Revenue & Intel Stream</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px 14px' }}>
                                <div onClick={() => (window as any).expandFeedSection('wishlist')} style={{ aspectRatio: '1', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: '#c5a059', letterSpacing: '2px' }}>WISHLIST</div>
                                </div>
                                <div onClick={() => { setLockedUsers(users.filter((u: any) => u.silence === true || !!(u.parameters?.paywall?.active) || u.paywall === true)); setShowLocksModal(true); }} style={{ aspectRatio: '1', background: 'rgba(220,60,60,0.06)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: 'rgba(220,60,60,0.7)', letterSpacing: '2px' }}>LOCKS</div>
                                </div>
                                <div style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>COMING SOON</div>
                                </div>
                            </div>
                        </div>

                        {/* EXCHEQUER - COIN TRANSACTION LOG */}
                        <div className="glass-card span-2" style={{ display: 'flex', flexDirection: 'column', minHeight: '180px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0 }}>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px' }}>EXCHEQUER LOG</div>
                                <div style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '1px' }}>COIN PURCHASES</div>
                            </div>
                            <div id="exchequerLog" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                                <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Orbitron', fontSize: '0.5rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>
                            </div>
                        </div>

                        {/* LEADS - people who tried to log in but haven't paid */}
                        <LeadsPanel />
                    </div>
                </div>

                {/* POSTS VIEW */}
                <div id="viewPosts" style={{ display: 'none', flexDirection: 'column', gap: '25px', padding: '30px', overflowY: 'auto', height: '100%' }}>
                    <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px' }}>
                        <div style={{ fontFamily: 'Cinzel', fontSize: '1.5rem', color: '#c5a059', letterSpacing: '4px', marginBottom: '5px' }}>QUEEN'S DISPATCH</div>
                        <div style={{ fontFamily: 'Rajdhani', fontSize: '0.75rem', color: '#555', letterSpacing: '2px' }}>PUBLISH POSTS · VISIBLE TO ALL SUBJECTS</div>
                    </div>

                    {/* COMPOSE */}
                    <div id="postComposeForm" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '8px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px', marginBottom: '5px' }}>NEW POST</div>
                        <input
                            id="postTitleInput"
                            type="text"
                            placeholder="TITLE (optional)"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Cinzel', fontSize: '0.85rem', padding: '12px 16px', outline: 'none', letterSpacing: '2px', borderRadius: '4px' }}
                        />
                        <textarea
                            id="postBodyInput"
                            placeholder="Write your decree..."
                            rows={5}
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '12px 16px', outline: 'none', resize: 'vertical', borderRadius: '4px', lineHeight: 1.6 }}
                        />
                        {/* Image upload */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label htmlFor="postImageInput" style={{ background: '#111', border: '1px solid #333', color: '#888', fontFamily: 'Orbitron', fontSize: '0.6rem', padding: '8px 16px', cursor: 'pointer', letterSpacing: '2px', borderRadius: '4px' }}>+ IMAGE</label>
                            <input type="file" id="postImageInput" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => {
                                const file = e.target.files?.[0];
                                const preview = document.getElementById('postImagePreview') as HTMLImageElement;
                                if (file && preview) {
                                    preview.src = URL.createObjectURL(file);
                                    preview.style.display = 'block';
                                }
                            }} />
                            <span style={{ fontFamily: 'Rajdhani', fontSize: '0.75rem', color: '#555' }}>Optional - image or video attachment</span>
                        </div>
                        <img id="postImagePreview" src="" alt="preview" style={{ display: 'none', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #333' }} />

                        {/* Min rank + price */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>MIN RANK</label>
                                <select id="postMinRankInput" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '4px', outline: 'none' }}>
                                    <option value="Hall Boy">Hall Boy</option>
                                    <option value="Footman">Footman</option>
                                    <option value="Silverman">Silverman</option>
                                    <option value="Butler">Butler</option>
                                    <option value="Chamberlain">Chamberlain</option>
                                    <option value="Secretary">Secretary</option>
                                    <option value="Queen&apos;s Champion">Queen&apos;s Champion</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <label style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>PRICE (COINS)</label>
                                <input id="postPriceInput" type="number" min="0" defaultValue={0} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '4px', outline: 'none', width: '120px' }} />
                            </div>
                        </div>

                        {/* Media type */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>MEDIA TYPE</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['text', 'photo', 'video'].map(t => (
                                    <button key={t} id={`postMediaType_${t}`} onClick={() => {
                                        ['text','photo','video'].forEach(x => {
                                            const b = document.getElementById(`postMediaType_${x}`) as HTMLButtonElement;
                                            if (b) { b.style.background = x === t ? 'rgba(197,160,89,0.2)' : '#111'; b.style.color = x === t ? '#c5a059' : '#666'; b.style.borderColor = x === t ? 'rgba(197,160,89,0.4)' : '#333'; }
                                        });
                                        const inp = document.getElementById('postMediaTypeValue') as HTMLInputElement;
                                        if (inp) inp.value = t;
                                    }} style={{ background: t === 'text' ? 'rgba(197,160,89,0.2)' : '#111', border: `1px solid ${t === 'text' ? 'rgba(197,160,89,0.4)' : '#333'}`, color: t === 'text' ? '#c5a059' : '#666', fontFamily: 'Orbitron', fontSize: '0.5rem', padding: '6px 14px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', textTransform: 'uppercase' }}>{t}</button>
                                ))}
                            </div>
                            <input type="hidden" id="postMediaTypeValue" defaultValue="text" />
                        </div>

                        {/* Published toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" id="postIsPublished" defaultChecked style={{ accentColor: '#c5a059', width: '16px', height: '16px', cursor: 'pointer' }} />
                            <label htmlFor="postIsPublished" style={{ fontFamily: 'Orbitron', fontSize: '0.5rem', color: '#888', letterSpacing: '2px', cursor: 'pointer' }}>PUBLISH IMMEDIATELY</label>
                        </div>

                        <button
                            id="postSubmitBtn"
                            onClick={() => (window as any).submitQueenPost()}
                            style={{ background: '#c5a059', color: '#000', border: 'none', fontFamily: 'Cinzel', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '4px', padding: '14px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.3s' }}
                        >PUBLISH</button>
                    </div>

                    {/* POSTS LIST */}
                    <div id="postsListContainer" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ color: '#444', fontFamily: 'Cinzel', fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>Click POSTS to load...</div>
                    </div>
                </div>

                {/* 2. PROFILE VIEW */}
                <div id="viewProfile" style={{ display: 'none' }}>
                    <div className="qp-header">
                        <div className="qp-cover"></div>
                        <div className="qp-av-con">
                            <img src="/queen-karin.png" className="qp-av" alt="Profile" onError={(e) => { e.currentTarget.src = '/queen-karin.png' }} />
                        </div>
                        <div className="qp-name">QUEEN KARIN</div>
                        <div className="qp-status">SYSTEM ADMINISTRATOR</div>
                        <div className="qp-stats-row">
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntPosts">0</div>
                                <div className="qp-s-lbl">POSTS</div>
                            </div>
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntSubs">0</div>
                                <div className="qp-s-lbl">SUBJECTS</div>
                            </div>
                            <div className="qp-stat">
                                <div className="qp-s-val" id="cntStories">0</div>
                                <div className="qp-s-lbl">STORIES</div>
                            </div>
                        </div>
                    </div>
                    <div className="story-rail" id="storyRail">
                        <div className="story-ring story-add" onClick={() => (window as any).openProfileUpload(true)}>+</div>
                    </div>
                    <div className="qp-tabs">
                        <div className="qp-tab active" onClick={() => (window as any).switchProfileTab('media')}>GRID</div>
                        <div className="qp-tab" onClick={() => (window as any).switchProfileTab('text')}>WRITINGS</div>
                    </div>
                    <div id="profileMediaGrid" className="media-grid"></div>
                    <div id="profileTextGrid" className="text-grid d-none"></div>
                    <button className="upload-fab" onClick={() => (window as any).openProfileUpload(false)}>+</button>
                </div>

                <div id="viewUser" style={{ display: 'none' }}>
                    <div className="mob-swipe-hint">← CHAT &nbsp;·&nbsp; DOSSIER →</div>
                    <div className="split">
                        {/* LEFT: COMMAND & FEED */}
                        <div className="chat-panel">
                            <div className="cp-head">ENCRYPTED FEED</div>

                            {/* FULL OVERLAY COMMAND QUEUE - MOVED HERE TO COVER ENTIRE PANEL */}
                            <div id="taskQueueContainer" className="task-queue-overlay hidden">
                                <div className="q-head">
                                    <span id="armoryTitle">COMMAND QUEUE</span>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            id="taskSearchInput"
                                            placeholder="FILTER DIRECTIVES..."
                                            onInput={() => (window as any).filterTaskGallery()}
                                            style={{
                                                background: 'rgba(0,0,0,0.5)',
                                                border: '1px solid rgba(197,160,89,0.2)',
                                                color: '#c5a059',
                                                fontFamily: 'Orbitron',
                                                fontSize: '0.6rem',
                                                padding: '5px 10px',
                                                borderRadius: '4px',
                                                width: '150px'
                                            }}
                                        />
                                        <button className="q-close" onClick={() => (window as any).closeTaskGallery()}>&times;</button>
                                    </div>
                                </div>

                                <div className="task-gallery-split" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: 'calc(100% - 60px)', overflow: 'hidden', position: 'relative' }}>
                                    {/* LEFT: COMMAND QUEUE (10 TASKS) */}
                                    <div className="command-queue-section" style={{ borderRight: '1px solid rgba(197,160,89,0.1)', padding: '20px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                                        <div style={{ fontFamily: 'Orbitron', color: '#c5a059', fontSize: '0.6rem', letterSpacing: '2px', marginBottom: '15px', textTransform: 'uppercase', opacity: 0.7 }}>Command Queue</div>
                                        <div id="armoryLiveQueue" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {/* Scheduled tasks go here */}
                                        </div>
                                    </div>

                                    {/* RIGHT: DIRECTIVE GRID */}
                                    <div className="directives-section" style={{ padding: '20px', overflowY: 'auto' }}>
                                        <div id="glassTaskGrid">
                                            {/* Directive cards go here */}
                                        </div>
                                    </div>

                                    {/* TASK DETAIL MODAL (GLASS CARD) */}
                                    <div id="taskDetailModal" className="task-detail-overlay hidden">
                                        <div className="task-detail-glass">
                                            <button className="detail-close" onClick={() => (window as any).closeTaskDetail()}>&times;</button>
                                            <div id="taskDetailContent"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-dash-top" style={{ display: 'flex', flexDirection: 'column', height: 'auto', background: 'transparent' }}>
                                <div className="ap-nav">
                                    <button className="ap-tab active" id="tabBtnOps" onClick={() => (window as any).switchAdminTab('ops')}>OPS</button>
                                    <button className="ap-tab" id="tabBtnIntel" onClick={() => (window as any).switchAdminTab('intel')}>INTEL</button>
                                    <button className="ap-tab" id="tabBtnRecord" onClick={() => (window as any).switchAdminTab('record')}>RECORD</button>
                                </div>

                                <div className="ap-content" style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
                                    <div id="tabOps" className="ap-view active">
                                        <div className="active-task-card gold-theme" onClick={() => (window as any).toggleTaskDrawer()}>
                                            <div className="at-label-row">
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span id="statusDot" className="status-dot unproductive"></span>
                                                    <div className="at-label">CURRENT STATUS</div>
                                                </div>
                                                <div id="dActiveStatus" className="at-status-text">UNPRODUCTIVE</div>
                                            </div>

                                            <div id="taskDrawer" className="task-drawer">
                                                <div id="activeTaskContent">
                                                    <div className="at-sub-label">ACTIVE DIRECTIVE</div>
                                                    <div id="dActiveText" className="at-text">None</div>
                                                    <div id="dActiveTimer" className="at-timer-large">--:--</div>
                                                    <div className="at-actions" onClick={(e) => e.stopPropagation()}>
                                                        <button className="at-btn at-fail" onClick={() => (window as any).adminTaskAction((window as any).currId, 'skip')}>CANCEL TASK</button>
                                                    </div>
                                                </div>
                                                <div id="idleActions" style={{ display: 'none', paddingTop: '10px' }} onClick={(e) => e.stopPropagation()}>
                                                    <button className="at-btn at-send" style={{ background: 'var(--gold)', color: '#000' }} onClick={() => (window as any).openTaskGallery()}>ISSUE NEW COMMAND</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="tabIntel" className="ap-view hidden">
                                        <div id="userQueueSec" style={{ display: 'none' }}></div>
                                    </div>

                                    <div id="tabRecord" className="ap-view hidden">
                                        <div id="adminOrbitalCanvas" className="admin-orbital-canvas">
                                            <div className="altar-label">THE SUPREME ALTAR</div>
                                        </div>
                                        {/* Bento Nodes... */}
                                    </div>

                                </div>
                            </div>

                            {/* SYSTEM TICKER - click to open service log */}
                            <div id="dashSystemTicker" className="dash-system-ticker"
                                onClick={() => (window as any).toggleDashSystemLog()}>
                                SYSTEM ONLINE
                            </div>

                            {/* SYSTEM LOG OVERLAY - covers chat area */}
                            <div id="dashSystemLogContainer" className="dash-syslog-container hidden" style={{ display: 'none' }}>
                                <div className="dash-syslog-header">
                                    <span>SYSTEM LOGS</span>
                                    <button className="dash-syslog-close" onClick={() => (window as any).toggleDashSystemLog()}>&times;</button>
                                </div>
                                <div id="dashSystemLogContent" className="dash-syslog-body"></div>
                            </div>

                            <div className="c-body" id="adminChatBox" style={{ flex: 1, borderTop: '1px solid rgba(197,160,89,0.2)' }}></div>

                            <div className="c-foot">
                                <button className="btn-plus" onClick={() => (window as any).triggerAdminMediaPick()}>+</button>
                                <input type="text" id="adminInp" className="inp" placeholder="Issue Command..." onKeyPress={(e) => { if (e.key === 'Enter') (window as any).sendMsg(); }} />
                                <button onClick={() => (window as any).sendMsg()} className="btn-send">{'>'}</button>
                            </div>
                        </div>

                        {/* RIGHT: THE DOSSIER */}
                        <div className="action-panel">
                            <div id="apMirrorHeader" className="ap-mirror-header">
                                <div id="dMirrorHierarchy" className="hierarchy-top">CHEVALIER</div>
                                <div className="avatar-container">
                                    <img id="dProfilePic" src="" alt="Profile" onError={(e) => { e.currentTarget.src = '/collar-placeholder.png' }} />
                                </div>
                                <div id="dMirrorName" className="identity-name" style={{ fontFamily: 'Cinzel', fontSize: '1.5rem', color: '#fff', marginBottom: '10px' }}>NAME</div>

                                <div className="stats-stack-row" style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '16px' }}>
                                    <div className="stat-item">
                                        <span className="stat-lbl">MERIT</span>
                                        <span id="dMirrorPoints" className="stat-val">0</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-lbl">CAPITAL</span>
                                        <span id="dMirrorWallet" className="stat-val">0</span>
                                    </div>
                                </div>
                                <div id="admin_KneelSection" style={{ width: '100%', padding: '0 20px 20px' }}></div>
                            </div>

                            <div className="ap-vitals-mirror" style={{ padding: '30px', flex: 1, overflowY: 'auto' }}>
                                <div id="telemetry_section" style={{ marginBottom: '30px', background: 'rgba(197,160,89,0.03)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div onClick={() => { const c = document.getElementById('admin_TelemetryContainer'); const a = document.getElementById('telemetry_arrow'); if (c) { const open = c.style.display !== 'none'; c.style.display = open ? 'none' : 'grid'; if (a) a.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)'; } }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', cursor: 'pointer', userSelect: 'none' as any }}>
                                        <span style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: '#888', letterSpacing: '2px' }}>ACTIVE TELEMETRY</span>
                                        <span id="telemetry_arrow" style={{ color: '#555', fontSize: '1rem', transition: 'transform 0.2s', display: 'inline-block', transform: 'rotate(-90deg)' }}>▾</span>
                                    </div>
                                    <div id="admin_TelemetryContainer" style={{ display: 'none', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 15px 15px' }}>
                                        <div style={{ color: '#444', fontSize: '0.6rem', textAlign: 'center', gridColumn: 'span 2' }}>NO DATA RECEIVED</div>
                                    </div>
                                </div>

                                <div id="progress_section" style={{ marginBottom: '30px' }}>
                                    <div style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textAlign: 'center' }}>PROMOTION PROGRESS</div>
                                    <div id="admin_NextRank" style={{ fontFamily: 'Cinzel', fontSize: '1.2rem', color: '#c5a059', textAlign: 'center', margin: '10px 0' }}>LOADING...</div>
                                    <div id="admin_ProgressContainer"></div>
                                </div>

                                <div id="admin_KinksLimits" style={{ marginBottom: '30px' }}></div>

                                <div className="queue-section" style={{ marginBottom: '30px' }}>
                                    <div style={{ fontFamily: 'Cinzel', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textAlign: 'center', marginBottom: '15px' }}>DIRECTIVE QUEUE</div>
                                    <div id="qListContainer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Task queue items will be rendered here */}
                                    </div>
                                </div>

                                <div className="footer-stats" style={{ borderTop: '1px solid rgba(197,160,89,0.2)', paddingTop: '20px', marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <span style={{ color: '#666', fontSize: '0.7rem' }}>REGISTERED SINCE:</span>
                                        <strong id="dMirrorSlaveSince" style={{ color: '#fff', fontSize: '0.7rem' }}>--/--/--</strong>
                                    </div>

                                    {(activeLocks.paywall || activeLocks.silenced) ? (
                                        <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'rgba(80,80,80,0.12)', border: '1px solid rgba(150,150,150,0.25)', borderRadius: 8, color: '#888', fontFamily: 'Orbitron', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer' }} onClick={async () => {
                                            const id = (window as any).currId;
                                            if (!id) return;
                                            if (activeLocks.paywall) await fetch('/api/paywall/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id }) });
                                            if (activeLocks.silenced) await fetch('/api/silence/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id }) });
                                            setActiveLocks({ paywall: false, silenced: false });
                                        }}>
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/></svg>
                                            UNLOCK
                                        </button>
                                    ) : (
                                        <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 8, color: '#c5a059', fontFamily: 'Orbitron', fontSize: '0.45rem', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => { const id = (window as any).currId; if (id) setLockTarget(id); }}>
                                            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                                            LOCK
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </div>

            {/* MOBILE BOTTOM NAV */}
            <nav className="mob-bottom-nav">
                <button className="mob-nav-btn active" id="mobNavHome" onClick={() => (window as any).mobNav?.('home')}>
                    <span className="mob-nav-icon">⌂</span>
                    <span className="mob-nav-label">HOME</span>
                </button>
                <button className="mob-nav-btn" id="mobNavSubs" onClick={() => (window as any).mobNav?.('subs')}>
                    <span className="mob-nav-icon">◉</span>
                    <span className="mob-nav-label">SUBJECTS</span>
                </button>
                <button className="mob-nav-btn" id="mobNavPosts" onClick={() => (window as any).mobNav?.('posts')}>
                    <span className="mob-nav-icon">✦</span>
                    <span className="mob-nav-label">POSTS</span>
                </button>
                <button className="mob-nav-btn" id="mobNavQueen" onClick={() => (window as any).mobNav?.('queen')}>
                    <span className="mob-nav-icon">♛</span>
                    <span className="mob-nav-label">QUEEN</span>
                </button>
            </nav>

            {/* SHARED MODALS */}
            <div id="reviewModal" className="modal">
                <div className="m-content" style={{ position: 'relative' }}>
                    <span onClick={() => (window as any).closeModal()} style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '2rem', color: 'rgba(197,160,89,0.45)', cursor: 'pointer', zIndex: 1100, lineHeight: 1 }}>&times;</span>
                    <div id="mMediaBox" className="m-media-box"></div>
                    <div className="m-info">
                        <div id="mModalHeader" style={{ flexShrink: 0, padding: '24px 28px 14px', borderBottom: '1px solid rgba(197,160,89,0.1)' }}></div>
                        <div id="reviewNormalContent" style={{ padding: '14px 28px 24px' }}>
                            <div id="mText" className="m-text-scroll"></div>
                            <div id="modalActions"></div>
                        </div>
                        <div id="reviewRewardOverlay" style={{ display: 'none' }}>
                            <div className="reward-protocol-header">Sovereign Directive Review</div>
                            <div className="reward-protocol-title">REWARD PROTOCOL</div>

                            <div id="reviewRewardTaskText" className="m-text-scroll" style={{
                                borderBottom: '1px solid rgba(197,160,89,0.15)',
                                paddingBottom: '12px',
                                marginBottom: '14px',
                                fontSize: '0.82rem',
                                opacity: 0.65,
                                maxHeight: '80px',
                                overflowY: 'auto',
                                flexShrink: 0,
                                flex: 'none',
                                width: '100%'
                            }}></div>

                            <div className="rw-tier-row" style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '14px', flexShrink: 0 }}>
                                <div id="tier_50" className="reward-tier-btn" onClick={() => (window as any).setRewardTier(50, 'tier_50')}>
                                    <div className="rt-pts">50</div>
                                    <div className="rt-lbl">NORMAL</div>
                                </div>
                                <div id="tier_70" className="reward-tier-btn" onClick={() => (window as any).setRewardTier(70, 'tier_70')}>
                                    <div className="rt-pts">70</div>
                                    <div className="rt-lbl">IMPRESSIVE</div>
                                </div>
                                <div id="tier_100" className="reward-tier-btn" onClick={() => (window as any).setRewardTier(100, 'tier_100')}>
                                    <div className="rt-pts">100</div>
                                    <div className="rt-lbl">EXCELLENT</div>
                                </div>
                            </div>

                            <div id="stickerGrid" className="sticker-grid" style={{ marginBottom: '12px' }}></div>

                            <div className="reward-inputs">
                                <div className="rw-group">
                                    <div className="rw-label">TOTAL MERIT POINTS</div>
                                    <input type="number" id="rewardBonus" className="rw-inp" defaultValue="50" />
                                </div>
                                <div className="rw-group">
                                    <div className="rw-label">COMMENT - sent to member chat</div>
                                    <textarea id="rewardComment" className="rw-inp" placeholder="Your verdict... (sent as chat message)" />
                                </div>
                            </div>

                            <div className="rw-media-row">
                                <label htmlFor="rewardFileUpload" className="rw-icon-btn" title="Attach file">📁</label>
                                <div id="btnRecordReward" className="rw-icon-btn" onClick={() => (window as any).toggleRewardRecord()} title="Voice note">🎤</div>
                                <div id="rewardMediaPreview" className="rw-preview-box d-none"></div>
                            </div>
                            <input type="file" id="rewardFileUpload" accept="image/*,video/*,audio/*" onChange={(e) => (window as any).handleRewardFileUpload(e.target)} style={{ display: 'none' }} />

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', width: '100%', flexShrink: 0 }}>
                                <button onClick={() => (window as any).cancelReward()} className="rw-confirm-btn cancel">CANCEL</button>
                                <button onClick={() => (window as any).confirmReward()} className="rw-confirm-btn primary">CONFIRM REWARD</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AGGREGATED LIST MODAL */}
            <div id="listModal" className="modal">
                <div className="m-content list-m-content">
                    <span onClick={() => (window as any).closeListModal()} className="modal-close-large">&times;</span>
                    <div id="mListHeader" className="m-list-header"></div>
                    <div id="mListGrid" className="ops-monitor-grid" style={{ flexWrap: 'wrap', justifyContent: 'center', padding: '40px 20px' }}></div>
                </div>
            </div>

            <div id="exclusionModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ width: '400px', height: 'auto', maxHeight: '70vh', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <h3 style={{ color: 'var(--red)', marginBottom: '15px', textAlign: 'center' }}>PROTOCOL EXCLUSIONS</h3>
                    <div id="exclusionList" className="ex-list"></div>
                    <button onClick={() => (window as any).closeExclusionModal()} style={{ marginTop: '15px', padding: '10px', background: '#666', color: 'white', border: 'none', borderRadius: '4px' }}>CLOSE</button>
                </div>
            </div>

            <div id="broadcastModal" className="modal" style={{ display: 'none' }}>
                <div className="m-content" style={{ display: 'flex', flexDirection: 'column', width: '600px', height: 'auto', maxHeight: '80vh', padding: '20px', border: '1px solid var(--pink)', boxShadow: '0 0 20px rgba(255,0,222,0.1)' }}>
                    <div className="br-head">BROADCAST MESSAGE</div>
                    <textarea id="brText" className="br-inp" placeholder="Enter your message..."></textarea>
                    <div className="br-preset-row">
                        <button className="br-mini-btn" onClick={() => (window as any).saveBroadcastPreset()}>SAVE PRESET</button>
                        <button className="br-mini-btn" onClick={() => (window as any).togglePresets()}>LOAD PRESET</button>
                    </div>
                    <div id="presetList"></div>
                    <label htmlFor="brFile" className="br-file-label">ATTACH MEDIA</label>
                    <input type="file" id="brFile" accept="image/*,video/*" onChange={(e) => (window as any).handleBroadcastFile(e.target)} style={{ display: 'none' }} />
                    <img id="brPreviewImg" className="br-prev" alt="Preview" />
                    <video id="brPreviewVid" className="br-prev" muted autoPlay loop></video>
                    <h4 style={{ color: 'var(--pink)', margin: '15px 0 10px 0', fontSize: '0.9rem' }}>EXCLUDE USERS:</h4>
                    <div id="brUserList" className="ex-list" style={{ maxHeight: '150px', overflowY: 'auto' }}></div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button onClick={() => (window as any).closeBroadcastModal()} style={{ flex: 1, padding: '15px', background: '#666', color: 'white', border: 'none', borderRadius: '4px' }}>CANCEL</button>
                        <button onClick={() => (window as any).sendBroadcast()} className="br-btn">SEND BROADCAST</button>
                    </div>
                </div>
            </div>

            {/* SECTION EXPANDED OVERLAY */}
            <div id="feedSectionOverlay" style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(6,6,16,0.97)', zIndex: 1000, flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid rgba(197,160,89,0.2)', flexShrink: 0 }}>
                    <div id="feedSectionOverlayTitle" style={{ fontFamily: 'Orbitron', fontSize: '0.75rem', color: '#c5a059', letterSpacing: '4px' }}>WISHLIST</div>
                    <button onClick={() => (window as any).collapseFeedSection()} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Orbitron', fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
                </div>
                <div id="wishlistPanel" style={{ flex: 1, overflowY: 'auto' }}></div>
            </div>

            {/* SOUND ASSETS */}
            <audio id="msgSound" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>
            <audio id="sfx-notify" src="https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3" preload="auto"></audio>

            {/* PURCHASE TOAST CONTAINER */}
            <div id="purchaseToastContainer"></div>

            {/* LOCK MODAL */}
            {lockTarget && <LockModal memberId={lockTarget} onClose={() => setLockTarget(null)} onLocked={(type: 'paywall' | 'silence') => {
                setActiveLocks(prev => ({ ...prev, paywall: type === 'paywall' ? true : prev.paywall, silenced: type === 'silence' ? true : prev.silenced }));
                (window as any)._refreshDashboard?.();
            }} />}

            {/* LOCKS LIST MODAL */}
            {showLocksModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid rgba(220,60,60,0.2)', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Orbitron', fontSize: '0.75rem', color: 'rgba(220,60,60,0.8)', letterSpacing: '4px' }}>LOCKED USERS</div>
                        <button onClick={() => setShowLocksModal(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Orbitron', fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                        {lockedUsers.length === 0 ? (
                            <div style={{ fontFamily: 'Cinzel', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 60, fontSize: '0.9rem' }}>No locked users</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, margin: '0 auto' }}>
                                {lockedUsers.map((u: any) => {
                                    const isSilenced = u.silence === true;
                                    const isPaywalled = !!(u.parameters?.paywall?.active) || u.paywall === true;
                                    const accent = isSilenced ? 'rgba(220,60,60,0.8)' : 'rgba(197,160,89,0.8)';
                                    const border = isSilenced ? 'rgba(220,60,60,0.2)' : 'rgba(197,160,89,0.2)';
                                    return (
                                        <div key={u.memberId} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <img src={u.avatar || '/collar-placeholder.png'} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e: any) => { e.target.src = '/collar-placeholder.png'; }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.95rem', color: '#fff' }}>{u.name || u.memberId}</span>
                                                    {isSilenced && <span style={{ fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(220,60,60,0.8)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '1px' }}>SILENCED</span>}
                                                    {isPaywalled && !isSilenced && <span style={{ fontFamily: 'Orbitron', fontSize: '0.35rem', color: 'rgba(197,160,89,0.8)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '1px' }}>PAYWALLED</span>}
                                                </div>
                                                <div style={{ fontFamily: 'Cinzel', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                                                    {isSilenced ? (u.parameters?.silence_reason || '-') : (u.parameters?.paywall?.reason || '-')}
                                                </div>
                                                {isPaywalled && !isSilenced && u.parameters?.paywall?.amount > 0 && (
                                                    <div style={{ fontFamily: 'Orbitron', fontSize: '0.7rem', color: 'rgba(197,160,89,0.7)', marginTop: 4 }}>€{Number(u.parameters.paywall.amount).toFixed(2)}</div>
                                                )}
                                            </div>
                                            <button onClick={() => { (window as any).selUser?.(u.memberId); setShowLocksModal(false); }} style={{ background: 'none', border: `1px solid ${border}`, color: accent, fontFamily: 'Orbitron', fontSize: '0.38rem', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', letterSpacing: '1px', flexShrink: 0 }}>VIEW</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

