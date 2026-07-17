'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '../../css/dashboard.css';
import '../../css/dashboard-modals.css';
import '../../css/dashboard-mobile.css';
import '../../css/profile-mobile.css';
import MobileDashboard from './MobileDashboard';
import { ChallengesContent } from './challenges/page';
import { VideoChallengesContent } from './video-challenges/page';
import { GlobalContent } from './GlobalContent';
import { KeyholderProgramContent } from './KeyholderProgram';

// Scripts
import { initDashboard, showHome, renderMainDashboard } from '@/scripts/dashboard-main';
import { closeModal, reviewTask, cancelReward, confirmReward, toggleRewardRecord, handleRewardFileUpload, selectSticker, openTaskGallery, closeTaskGallery, filterTaskGallery, openModById } from '@/scripts/dashboard-modals';
import { deleteQueueItem, updateTaskQueue, updateDetail } from '@/scripts/dashboard-users';
import { toggleProtocol, toggleNewbieImmunity, closeExclusionModal, sendBroadcast, saveBroadcastPreset, togglePresets, closeBroadcastModal, handleBroadcastFile, openBroadcastModal, openExclusionModal } from '@/scripts/dashboard-protocol';
import { showProfile, switchProfileTab, openProfileUpload } from '@/scripts/dashboard-navigation';
import { switchAdminTab, adjustWallet, manageAltar, adminTaskAction, toggleTaskQueue, expandAdminCategory, updateDashboardAltar, showPosts, submitQueenPost, deleteQueenPost, loadQueenPostsDashboard } from '@/scripts/dashboard-main';
import { closeChatPreview } from '@/scripts/chat';

// State & Actions
import { setUsers, setAvailableDailyTasks, setGlobalQueue, setGlobalTributes, setAdminEmail, setDashboardRole, setAdminReadMap, users, currId, dashboardRole, adminEmail } from '@/scripts/dashboard-state';
import { getAdminDashboardData, getUnreadMessageStatus } from '@/actions/velo-actions';
import { getOptimizedUrl } from '@/scripts/media';
import { renderSidebar, markPendingRead, updateSidebarItem } from '@/scripts/dashboard-sidebar';
import { cleanupPresenceTracking, reconnectPresence } from '@/scripts/dashboard-presence';
import { reconnectDashboardChat } from '@/scripts/dashboard-chat';
import { reconnectDashboardMain } from '@/scripts/dashboard-main';
import { bindDashMobGlobal } from '@/scripts/dash-mobile-global';
import { bindInlineRisky } from '@/scripts/inline-risky';
import { initDashStreamChat, destroyDashStreamChat, bindStreamPlayer } from '@/scripts/stream-player';

const PAYWALL_PRESETS = [
    "Monthly tribute not received. Pay now.",
    "Punishment - pay for your attitude.",
    "Outstanding debt. You know what you did.",
    "You've been a disappointment. Pay your dues.",
    "Access suspended. Tribute required immediately.",
    "Ghosting Fee: You ruined your shot to serve. Inclusion isn't free for you. You either serve, or you pay the price to remain here. And you already made your choice.",
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
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>REASON</div>
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
    const quoteHtml = msg.reply_to ? `<div style="border-left:2px solid rgba(197,160,89,0.5);padding:3px 8px;margin-bottom:5px;background:rgba(197,160,89,0.05);border-radius:0 4px 4px 0;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.3rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:2px;">${(msg.reply_to.sender_name||'').replace(/</g,'&lt;')}</div><div style="font-family:'Rajdhani';font-size:0.78rem;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(msg.reply_to.content||'').slice(0,60).replace(/</g,'&lt;')}</div></div>` : '';

    // PROMOTION CARD
    if (content.startsWith('PROMOTION_CARD::')) {
        try {
            const d = JSON.parse(content.replace('PROMOTION_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const photoFallback = `<div style="${d.photo?'display:none;':''}position:absolute;inset:0;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(197,160,89,0.08),rgba(197,160,89,0.02));"><div style="width:56px;height:56px;border-radius:50%;border:1px solid rgba(197,160,89,0.4);display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:1.3rem;color:#c5a059;">${ini}</div></div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:130px;background:#0a0703;overflow:hidden;">${photoBlock}${photoFallback}<div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div><div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(10,7,2,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:4px 14px;white-space:nowrap;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">RANK PROMOTION</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.9rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${d.name||''}</div><div style="display:flex;align-items:center;justify-content:center;gap:10px;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.48rem;color:rgba(197,160,89,0.4);letter-spacing:1px;text-decoration:line-through;">${(d.oldRank||'').toUpperCase()}</span><span style="color:rgba(197,160,89,0.7);">→</span><span style="font-family:'Rajdhani',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:2px;font-weight:700;">${(d.newRank||'').toUpperCase()}</span></div></div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE JOIN CARD
    if (content.startsWith('CHALLENGE_JOIN_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_JOIN_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#060e08 0%,#040d06 60%,#030a04 100%);border:1px solid rgba(74,222,128,0.45);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:120px;background:#030a04;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,222,128,0.6);position:relative;">${photoBlock}<div style="${d.photo?'display:none;':''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.1);font-family:'Rajdhani',sans-serif;font-size:1.1rem;color:#4ade80;">${ini}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#060e08 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(3,10,4,0.9);border:1px solid rgba(74,222,128,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#4ade80;letter-spacing:3px;">⚔ JOINED CHALLENGE</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.88rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:rgba(74,222,128,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Rajdhani',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE ELIM CARD
    if (content.startsWith('CHALLENGE_ELIM_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_ELIM_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const photoBlock = d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">` : '';
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0606 0%,#0d0404 60%,#0a0303 100%);border:1px solid rgba(224,48,48,0.4);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:120px;background:#0a0303;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid rgba(224,48,48,0.5);position:relative;">${photoBlock}<div style="${d.photo?'display:none;':''}position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(224,48,48,0.1);font-family:'Rajdhani',sans-serif;font-size:1.1rem;color:#e03030;">${ini}</div></div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0606 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,3,3,0.9);border:1px solid rgba(224,48,48,0.45);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#e03030;letter-spacing:3px;">✕ ELIMINATED</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.88rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${d.name||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:rgba(224,48,48,0.7);letter-spacing:1px;margin-bottom:8px;">${(d.challengeName||'').toUpperCase()}</div><div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Rajdhani',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">STILL IN: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // CHALLENGE INVITE CARD
    if (content.startsWith('CHALLENGE_INVITE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('CHALLENGE_INVITE_CARD::',''));
            const bgImg = d.challengeImage ? `background-image:url('${d.challengeImage}');background-size:cover;background-position:center;` : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0e0b06 0%,#0d0a04 60%,#0a0803 100%);border:1px solid rgba(197,160,89,0.5);box-shadow:0 12px 40px rgba(0,0,0,0.8);"><div style="position:relative;width:100%;height:120px;background:#0a0803;overflow:hidden;${bgImg}"><div style="position:absolute;inset:0;background:rgba(0,0,0,0.5);"></div><div style="position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Rajdhani',sans-serif;font-size:2rem;color:rgba(197,160,89,0.6);">⚔</div></div><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,#0e0b06 100%);"></div><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(10,8,3,0.9);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 12px;white-space:nowrap;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:3px;">⚔ CHALLENGE INVITATION</span></div></div><div style="padding:12px 16px 16px;text-align:center;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.88rem;color:#fff;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${(d.challengeName||'').toUpperCase()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:#777;margin-bottom:8px;">${d.durationDays||'?'}d · ${d.tasksPerDay||'?'}×/day · ${(d.joinCost||0).toLocaleString()} coins</div><div style="display:inline-flex;align-items:center;gap:6px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:3px 12px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;display:inline-block;"></span><span style="font-family:'Rajdhani',sans-serif;font-size:0.38rem;color:#4ade80;letter-spacing:2px;">ACTIVE: ${d.activeCount||0}</span></div></div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
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
            const avImg = d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:${ac};">${ini}</div>`;
            return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;"><div style="width:88%;min-width:220px;max-width:440px;"><div style="background:${acBg};border:1px solid ${acBorder};border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;border:1.5px solid ${acBorder};overflow:hidden;position:relative;flex-shrink:0;">${avImg}</div><div style="flex:1;min-width:0;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:${ac};letter-spacing:1px;margin-bottom:2px;">${label}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Rajdhani';font-size:0.72rem;color:rgba(255,255,255,0.45);margin-top:2px;">${sub}</div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.3);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE MERIT CARD
    if (content.startsWith('UPDATE_MERIT_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_MERIT_CARD::',''));
            const ini = (d.senderName||'S')[0].toUpperCase();
            const avImg = d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:#a78bfa;">${ini}</div>`;
            return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;"><div style="width:88%;min-width:220px;max-width:440px;"><div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:rgba(167,139,250,0.1);border:1.5px solid rgba(167,139,250,0.35);overflow:hidden;position:relative;flex-shrink:0;">${avImg}</div><div style="flex:1;min-width:0;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">⚡ MERIT EARNED</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:#a78bfa;font-weight:700;margin-top:2px;">+${d.points||0} MERIT</div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.3);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE COINS CARD
    if (content.startsWith('UPDATE_COINS_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_COINS_CARD::',''));
            const ini = (d.senderName||'S')[0].toUpperCase();
            const avImg = d.senderAvatar ? `<img src="${d.senderAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:0.65rem;color:#c5a059;">${ini}</div>`;
            return `<div style="display:flex;justify-content:center;padding:6px 0;margin-bottom:6px;"><div style="width:88%;min-width:220px;max-width:440px;"><div style="background:rgba(197,160,89,0.05);border:1px solid rgba(197,160,89,0.25);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:rgba(197,160,89,0.1);border:1.5px solid rgba(197,160,89,0.35);overflow:hidden;position:relative;flex-shrink:0;">${avImg}</div><div style="flex:1;min-width:0;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-bottom:2px;">🪙 COINS EARNED</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.85rem;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.senderName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:#c5a059;font-weight:700;margin-top:2px;">+${d.points||0} COINS</div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.3);flex-shrink:0;align-self:flex-start;">${time}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE TRIBUTE CARD
    if (content.startsWith('UPDATE_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_TRIBUTE_CARD::',''));
            const coverSrc = d.image || '';
            const priceVal = d.price ? Number(d.price).toLocaleString() : '';
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:220px;"><div style="border-radius:12px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.4);box-shadow:0 6px 24px rgba(0,0,0,0.5);"><div style="width:100%;height:120px;background-image:url('${coverSrc}');background-size:cover;background-position:center;position:relative;">${priceVal?`<div style="position:absolute;top:7px;right:8px;background:rgba(10,7,3,0.85);border:1px solid rgba(197,160,89,0.5);border-radius:20px;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:0.38rem;color:#c5a059;display:flex;align-items:center;gap:5px;letter-spacing:1px;"><i class="fas fa-coins"></i> ${priceVal}</div>`:''}</div><div style="padding:10px 14px 14px;"><div style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.7);letter-spacing:2px;margin-bottom:4px;">✦ Gift Sent</div><div style="font-family:'Cinzel',serif;font-size:0.85rem;color:#fff;font-weight:700;letter-spacing:1px;">${d.title||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:rgba(255,255,255,0.35);margin-top:6px;">${d.senderName||''}</div></div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // WELCOME CARD (new member)
    if (content.startsWith('WELCOME_CARD::')) {
        try {
            const d = JSON.parse(content.replace('WELCOME_CARD::',''));
            const ini = (d.name||'S')[0].toUpperCase();
            const SVG_CROWN = `<svg width="14" height="11" viewBox="0 0 26 20" fill="#c5a059"><path d="M2 18 L5 8 L10 13 L13 3 L16 13 L21 8 L24 18 Z"/><rect x="2" y="17" width="22" height="2" rx="1"/></svg>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="width:100%;border-radius:16px;overflow:hidden;background:linear-gradient(170deg,#0c0a04 0%,#13100a 50%,#0c0a04 100%);border:1px solid rgba(197,160,89,0.6);box-shadow:0 12px 40px rgba(0,0,0,0.8),0 0 30px rgba(197,160,89,0.08);">
                <div style="position:relative;width:100%;padding:20px 0 14px;display:flex;flex-direction:column;align-items:center;background:radial-gradient(ellipse at center top,rgba(197,160,89,0.1) 0%,transparent 70%);">
                    <div style="width:64px;height:64px;border-radius:50%;border:2px solid rgba(197,160,89,0.6);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1.5rem;color:#c5a059;background:radial-gradient(circle,rgba(197,160,89,0.12) 0%,rgba(197,160,89,0.03) 100%);box-shadow:0 0 20px rgba(197,160,89,0.15),0 0 40px rgba(197,160,89,0.05);">${ini}</div>
                </div>
                <div style="padding:4px 16px 20px;text-align:center;">
                    <div style="font-family:'Cinzel',serif;font-size:1rem;color:#fff;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">${d.name||''}</div>
                    <div style="width:40%;height:1px;background:linear-gradient(to right,transparent,rgba(197,160,89,0.5),transparent);margin:0 auto 8px;"></div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.65);letter-spacing:3px;margin-bottom:12px;">HAS ENTERED THE COURT</div>
                    <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(197,160,89,0.06);border:1px solid rgba(197,160,89,0.25);border-radius:20px;padding:4px 14px;">${SVG_CROWN}<span style="font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#c5a059;letter-spacing:2px;">${(d.rank||'HALL BOY').toUpperCase()}</span></div>
                </div>
            </div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:4px;letter-spacing:1px;">${time}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // DIRECT TRIBUTE CARD (coin send)
    if (content.startsWith('DIRECT_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('DIRECT_TRIBUTE_CARD::',''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:220px;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#0d0a04,#0a0703);border:1px solid rgba(197,160,89,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);text-align:center;padding:20px 16px;"><div style="font-size:1.8rem;margin-bottom:8px;">\u2728</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(197,160,89,0.6);letter-spacing:3px;margin-bottom:10px;">TRIBUTE SENT</div><div style="font-family:'Orbitron',sans-serif;font-size:1.2rem;color:#c5a059;font-weight:700;margin-bottom:4px;">${(d.amount||0).toLocaleString()}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.4);letter-spacing:2px;margin-bottom:12px;">COINS</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);">${d.senderName||''}</div></div></div>`;
        } catch { /* fall through */ }
    }

    // RISKY TRIBUTE CARD (gamble result)
    if (content.startsWith('RISKY_TRIBUTE_CARD::')) {
        try {
            const d = JSON.parse(content.replace('RISKY_TRIBUTE_CARD::',''));
            const isWin = d.isWin;
            const borderColor = isWin ? 'rgba(197,160,89,0.5)' : d.lostAmount === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(220,50,80,0.4)';
            const bg = isWin ? '#0e0b06' : d.lostAmount === 0 ? '#060e08' : '#0e0606';
            const resultText = isWin ? `WON +${(d.wonAmount||0).toLocaleString()}` : d.lostAmount === 0 ? 'MERCY - LOST NOTHING' : `LOST ${(d.lostAmount||0).toLocaleString()}`;
            const resultColor = isWin ? '#c5a059' : d.lostAmount === 0 ? '#4ade80' : '#e03050';
            const rIconHtml = d.icon && d.icon.startsWith('/') ? `<img src="${d.icon}" style="width:70px;height:auto;">` : `<div style="font-size:2.2rem;">${d.icon||'🎰'}</div>`;
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:min(90%,320px);"><div style="border-radius:14px;overflow:hidden;background:linear-gradient(170deg,${bg},#0a0a14);border:1px solid ${borderColor};box-shadow:0 8px 30px rgba(0,0,0,0.6);padding:14px 16px;"><div style="display:flex;align-items:center;gap:14px;"><div style="flex-shrink:0;width:70px;display:flex;align-items:center;justify-content:center;">${rIconHtml}</div><div style="flex:1;min-width:0;"><div style="font-family:'Cinzel',serif;font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:4px;">${d.senderName||''}</div><div style="font-family:'Orbitron',sans-serif;font-size:0.42rem;color:rgba(255,255,255,0.35);letter-spacing:2px;margin-bottom:3px;">RISKY SEND</div><div style="font-family:'Orbitron',sans-serif;font-size:0.55rem;color:${resultColor};letter-spacing:1px;font-weight:700;margin-bottom:3px;">${d.cardName||''}</div><div style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:rgba(255,255,255,0.45);">Staked ${(d.stakeAmount||0).toLocaleString()} · <span style="color:${resultColor};font-weight:700;">${resultText}</span></div></div></div></div><div style="margin-top:8px;text-align:center;"><button onclick="if(window.openInlineRisky){window.openInlineRisky();}" style="background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.4);color:#c5a059;font-family:'Orbitron',sans-serif;font-size:0.4rem;letter-spacing:2px;padding:6px 20px;border-radius:20px;cursor:pointer;">TRY YOUR LUCK</button></div></div></div>`;
        } catch { /* fall through */ }
    }

    // UPDATE PHOTO CARD
    if (content.startsWith('UPDATE_PHOTO_CARD::')) {
        try {
            const d = JSON.parse(content.replace('UPDATE_PHOTO_CARD::',''));
            return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:72%;min-width:220px;max-width:400px;"><div style="background:#0a0a14;border:1px solid rgba(197,160,89,0.2);border-radius:14px;overflow:hidden;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.5);"><img src="${d.mediaUrl}" style="width:100%;max-height:220px;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'"><div style="padding:10px 14px 12px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:#fff;font-weight:700;">${d.senderName||''}</span><span style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.35);">${time}</span></div>${d.caption?`<div style="font-family:'Rajdhani';font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:3px;">${d.caption}</div>`:''}</div></div></div></div>`;
        } catch { /* fall through */ }
    }

    // GIF
    if ((msg.media_type === 'gif' || (msg.message === '[GIF]' && msg.media_url)) && msg.media_url) {
        return `<div style="display:flex;justify-content:center;padding:8px 0;margin-bottom:8px;"><div style="width:65%;min-width:180px;max-width:320px;"><div style="width:100%;border-radius:14px;overflow:hidden;background:linear-gradient(170deg,#0e0b06,#110d04,#0a0703);border:1px solid rgba(197,160,89,0.35);box-shadow:0 10px 30px rgba(0,0,0,0.8);"><div style="width:100%;overflow:hidden;background:#0a0703;"><img src="${msg.media_url}" ${_imgErr} style="width:100%;display:block;max-height:200px;object-fit:contain;" /></div><div style="padding:8px 14px 12px;text-align:center;border-top:1px solid rgba(197,160,89,0.1);"><div style="font-family:'Rajdhani',sans-serif;font-size:0.78rem;color:#fff;font-weight:700;letter-spacing:2px;">${name}</div></div></div><div style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.2);text-align:center;margin-top:3px;letter-spacing:1px;">${time}</div></div></div>`;
    }

    // Skip SYSTEM messages
    if (msg.sender_name === 'SYSTEM') return '';

    // Media inline
    const hasPhoto = msg.media_url && msg.media_type !== 'gif' && msg.media_type !== 'video';
    const mediaHtml = msg.media_url && msg.media_type !== 'gif' ? (
        msg.media_type === 'video'
            ? `<video src="${msg.media_url}" controls playsinline preload="metadata" ${_vidErr} style="width:100%;border-radius:8px;margin-top:8px;max-height:260px;object-fit:cover;display:block;"></video>`
            : `<img src="${msg.media_url}" ${_imgErr} style="width:100%;border-radius:8px;margin-top:8px;max-height:260px;object-fit:cover;display:block;cursor:pointer;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${(msg.media_url||'').replace(/'/g,"\\'")}')" />`
    ) : '';

    // Queen photo post card (Instagram-style)
    if (isQueen && hasPhoto) {
        const qAvSrc = av || '/queen-nav.png';
        const captionText = content && content !== '[PHOTO]' ? content : '';
        return `<div style="margin-bottom:12px;"><div style="background:linear-gradient(170deg,#0e0b06 0%,#110d04 60%,#0a0703 100%);border:1.5px solid rgba(197,160,89,0.6);border-radius:14px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 20px rgba(197,160,89,0.08);"><div style="display:flex;align-items:center;gap:8px;padding:10px 14px;"><img src="${qAvSrc}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.6);" onerror="this.src='/queen-nav.png'"><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:4px;">${SVG_CROWN}<span style="font-family:'Cinzel',serif;font-size:0.55rem;color:#c5a059;letter-spacing:1px;font-weight:700;">QUEEN KARIN</span></div></div><span style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(197,160,89,0.45);">${time}</span></div><div style="width:100%;max-height:420px;overflow:hidden;cursor:pointer;" onclick="window._openGlobalLightbox&&window._openGlobalLightbox('${(msg.media_url||'').replace(/'/g,"\\'")}')"><img src="${msg.media_url}" ${_imgErr} style="width:100%;display:block;object-fit:cover;max-height:420px;" /></div>${captionText?`<div style="padding:8px 14px 10px;"><div style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:rgba(255,255,255,0.7);line-height:1.5;"><span style="font-family:'Cinzel',serif;font-size:0.52rem;color:#c5a059;font-weight:700;margin-right:6px;">QUEEN KARIN</span>${captionText}</div></div>`:''}</div></div>`;
    }

    // Queen bubble (text or video)
    if (isQueen) {
        const qAv = av ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;" onerror="this.style.display='none'">` : `<img src="/queen-nav.png" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(197,160,89,0.7);flex-shrink:0;">`;
        const qContent = (content === '[GIF]' && msg.media_url) ? '' : content;
        return `<div style="margin-bottom:8px;"><div style="padding:9px 13px 11px;background:linear-gradient(135deg,rgba(197,160,89,0.14),rgba(100,75,15,0.08));border:1.5px solid rgba(197,160,89,0.75);border-radius:10px;box-shadow:0 0 14px rgba(197,160,89,0.1);"><div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">${qAv}<div style="display:flex;align-items:center;gap:4px;">${SVG_CROWN}<span style="font-family:'Cinzel',serif;font-size:0.65rem;color:#c5a059;letter-spacing:1px;font-weight:700;">QUEEN KARIN</span></div><span style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(197,160,89,0.55);"> · ${time}</span></div>${quoteHtml}${qContent ? `<div style="font-family:'Rajdhani',sans-serif;font-size:0.88rem;color:rgba(255,255,255,0.6);line-height:1.5;">${qContent}</div>` : ''}${mediaHtml}</div></div>`;
    }

    // Regular user bubble
    const initial = (name[0]||'S').toUpperCase();
    const userAv = av ? `<img src="${av}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:1px solid rgba(197,160,89,0.35);flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:22px;height:22px;border-radius:50%;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.25);display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-size:0.42rem;color:#c5a059;flex-shrink:0;">${initial}</div>`;
    return `<div style="margin-bottom:8px;"><div style="padding:9px 13px 11px;background:rgba(255,255,255,0.02);border:1px solid rgba(180,180,200,0.18);border-radius:10px;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">${userAv}<span style="font-family:'Rajdhani',sans-serif;font-size:0.45rem;color:rgba(197,160,89,0.6);letter-spacing:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span><span style="font-family:'Rajdhani',sans-serif;font-size:0.35rem;color:rgba(255,255,255,0.3);white-space:nowrap;flex-shrink:0;"> · ${time}</span></div>${quoteHtml}<div style="font-family:'Rajdhani',sans-serif;font-size:0.92rem;color:rgba(255,255,255,0.7);line-height:1.45;">${content}</div>${mediaHtml}</div></div>`;
}

function ChattersPanel() {
    const [chatters, setChatters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);

    const loadChatters = () => {
        fetch('/api/chatter/manage').then(r => r.json()).then(d => {
            if (d.success) setChatters(d.chatters || []);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { loadChatters(); }, []);

    const addChatter = async () => {
        if (!newEmail.trim()) return;
        setAdding(true);
        try {
            const res = await fetch('/api/chatter/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', email: newEmail.trim(), displayName: newName.trim() || undefined }),
            });
            const d = await res.json();
            if (d.success) { setNewEmail(''); setNewName(''); loadChatters(); }
            else alert(d.error);
        } catch { alert('Failed to add chatter'); }
        setAdding(false);
    };

    const removeChatter = async (email: string) => {
        if (!confirm(`Remove ${email} as chatter?`)) return;
        await fetch('/api/chatter/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', email }),
        });
        loadChatters();
    };

    return (
        <div className="glass-card span-2" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 14, background: 'rgba(197,160,89,0.7)', borderRadius: 2 }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px' }}>CHATTERS</div>
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>{chatters.filter(c => c.is_active).length} ACTIVE</div>
            </div>

            {/* Add chatter form */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
                    style={{ flex: 2, background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4, outline: 'none' }} />
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 4, outline: 'none' }} />
                <button onClick={addChatter} disabled={adding}
                    style={{ flexShrink: 0, background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.4)', color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', padding: '8px 14px', borderRadius: 4, cursor: 'pointer', letterSpacing: '1px' }}>
                    {adding ? '...' : '+ ADD'}
                </button>
            </div>

            {/* Chatter list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>}
                {!loading && chatters.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px' }}>NO CHATTERS</div>}
                {chatters.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: c.is_active ? 1 : 0.4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.is_active ? '#00cc66' : '#555', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'Rajdhani', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.display_name} <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem' }}>({c.email})</span>
                            </div>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '1px', marginTop: 2 }}>
                                {c.stats?.messages || 0} msgs · {c.stats?.tributes || 0} tributes · since {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                        {c.is_active && (
                            <button onClick={() => removeChatter(c.email)} title="Remove chatter"
                                style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 4, color: 'rgba(255,80,80,0.5)', fontSize: '0.6rem', padding: '4px 8px', cursor: 'pointer' }}>
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function LeadsInlinePanel() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState<string | null>(null);
    const [manualEmail, setManualEmail] = useState('');
    const [addingManual, setAddingManual] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');

    useEffect(() => {
        fetch('/api/leads').then(r => r.json()).then(d => {
            if (d.success) setLeads(d.leads);
        }).catch(() => {}).finally(() => setLoading(false));
        // Auto-sync leads to OneSignal on load
        fetch('/api/push/sync-leads', { method: 'POST' }).then(r => r.json()).then(d => {
            if (d.synced > 0) setSyncMsg(`${d.synced} synced`);
        }).catch(() => {});
    }, []);

    const syncLeads = async () => {
        setSyncing(true); setSyncMsg('');
        try {
            const res = await fetch('/api/push/sync-leads', { method: 'POST' });
            const d = await res.json();
            setSyncMsg(d.error ? 'Error' : `${d.synced}/${d.total} synced`);
        } catch { setSyncMsg('Error'); }
        setSyncing(false);
    };

    const addSub = async (email: string) => {
        setAdding(email);
        try {
            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: email.split('@')[0] }),
            });
            const data = await res.json();
            if (data.success) {
                setLeads(prev => prev.filter(l => l.email.toLowerCase() !== email.toLowerCase()));
                (window as any)._refreshDashboard?.();
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch { alert('Network error'); }
        setAdding(null);
    };

    const addManual = async () => {
        if (!manualEmail.trim() || !manualEmail.includes('@')) return;
        setAddingManual(true);
        await addSub(manualEmail.trim());
        setManualEmail('');
        setAddingManual(false);
    };

    return (
        <div className="glass-card span-1" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,80,80,0.15)', minHeight: 0, maxHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,80,80,0.12)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 3, height: 12, background: 'rgba(255,80,80,0.7)', borderRadius: 2 }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: 'rgba(255,100,100,0.85)', letterSpacing: '2px' }}>KNOCKING AT THE GATE</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {syncMsg && <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: '#4ade80', letterSpacing: '1px' }}>{syncMsg}</span>}
                    <button onClick={syncLeads} disabled={syncing} style={{ background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.3)', borderRadius: 3, color: '#8b0000', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', padding: '3px 8px', cursor: 'pointer', letterSpacing: '1px', opacity: syncing ? 0.5 : 1 }}>{syncing ? '...' : 'SYNC'}</button>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>{leads.length}</div>
                </div>
            </div>
            {/* Manual add */}
            <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
                <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="Add email manually..." onKeyDown={e => { if (e.key === 'Enter') addManual(); }} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.8rem', padding: '5px 10px', outline: 'none' }} />
                <button onClick={addManual} disabled={addingManual} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 4, color: '#4ade80', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', padding: '5px 10px', cursor: 'pointer', letterSpacing: '1px', opacity: addingManual ? 0.5 : 1 }}>+ ADD</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
                {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>}
                {!loading && leads.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px' }}>NO LEADS YET</div>}
                {leads.map((l: any) => {
                    const last = new Date(l.last_seen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const isAdding = adding === l.email;
                    return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Rajdhani', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>{last}{l.attempts > 1 ? ` · ${l.attempts}×` : ''}</div>
                            </div>
                            <button onClick={() => addSub(l.email)} disabled={isAdding} style={{ flexShrink: 0, background: isAdding ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 4, color: '#4ade80', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', padding: '3px 8px', cursor: 'pointer', letterSpacing: '1px', opacity: isAdding ? 0.5 : 1 }}>
                                {isAdding ? '...' : 'ADD'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
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
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', color: 'rgba(255,100,100,0.85)', letterSpacing: '3px' }}>KNOCKING AT THE GATE</div>
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>{leads.length} LEADS</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                {loading && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>}
                {!loading && leads.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '2px' }}>NO LEADS YET</div>}
                {leads.map((l: any) => {
                    const first = new Date(l.first_seen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const last = new Date(l.last_seen).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                    return (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{providerIcon(l.provider)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'Rajdhani', fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email}</div>
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', marginTop: 2 }}>first: {first} · last attempt: {last}</div>
                            </div>
                            {l.attempts > 1 && (
                                <span style={{ flexShrink: 0, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(255,100,100,0.6)', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.15)', borderRadius: 10, padding: '2px 7px', letterSpacing: '0.5px' }}>{l.attempts}×</span>
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
    const [gifOpen, setGifOpen] = useState(false);
    const [gifs, setGifs] = useState<{ url: string; preview: string }[]>([]);
    const [gifQuery, setGifQuery] = useState('');
    const gifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const renderedIdsRef = useRef(new Set<string>());
    const initialDoneRef = useRef(false);

    const searchGifs = useCallback(async (q: string) => {
        try {
            const res = await fetch(`/api/global/gifs?q=${encodeURIComponent(q || 'funny')}`);
            const { results } = await res.json();
            setGifs(results || []);
        } catch { setGifs([]); }
    }, []);

    const sendGif = useCallback(async (gifUrl: string) => {
        if (!userEmail) return;
        setGifOpen(false);
        try {
            await fetch('/api/global/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: '[GIF]', senderEmail: userEmail, media_url: gifUrl, media_type: 'gif' }),
            });
        } catch {}
    }, [userEmail]);

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
        const msg = text.trim();
        setSending(true);
        try {
            await fetch('/api/global/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderEmail: userEmail, message: msg }),
            });
            setText('');
            await load();
            // Auto-summon Guardian when @vlad is tagged
            if (/@vlad/i.test(msg)) {
                try {
                    await fetch('/api/global/guardian', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userMessage: msg, senderName: 'QUEEN KARIN', senderEmail: userEmail }),
                    });
                    await load();
                } catch {}
            }
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
            {gifOpen && (
                <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid rgba(197,160,89,0.15)', background: '#0d0b08', padding: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input
                            type="text" placeholder="Search GIFs..." autoComplete="off"
                            value={gifQuery} onChange={e => { setGifQuery(e.target.value); if (gifTimeoutRef.current) clearTimeout(gifTimeoutRef.current); gifTimeoutRef.current = setTimeout(() => searchGifs(e.target.value || 'funny'), 400); }}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.85rem', padding: '6px 10px', borderRadius: 4, outline: 'none' }}
                        />
                        <button onClick={() => setGifOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                        {gifs.map((g, i) => (
                            <div key={i} onClick={() => sendGif(g.url)} style={{ cursor: 'pointer', borderRadius: 4, overflow: 'hidden', aspectRatio: '1', background: 'rgba(255,255,255,0.04)' }}>
                                <img src={g.preview} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                        ))}
                        {gifs.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 16, fontFamily: 'Orbitron', fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)' }}>LOADING...</div>}
                    </div>
                </div>
            )}
            <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Send to global..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: '#fff', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem', padding: '8px 12px', outline: 'none' }}
                />
                <button onClick={() => { if (!gifOpen) { setGifOpen(true); searchGifs('funny'); } else { setGifOpen(false); } }} style={{ padding: '6px 8px', background: gifOpen ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${gifOpen ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.1)'}`, color: gifOpen ? '#c5a059' : 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>GIF</button>
                <button onClick={send} disabled={sending || !text.trim()} style={{ background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 6, color: '#000', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', fontWeight: 700, padding: '8px 16px', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !text.trim() ? 0.5 : 1, letterSpacing: '1px' }}>
                    SEND
                </button>
            </div>
        </div>
    );
}

// DashMobGlobal removed — now uses vanilla TS overlay via dash-mobile-global.ts

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
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 320, zIndex: 99998, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#0a0a0a', border: `1px solid ${borderColor}`, borderRadius: 14, padding: '24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.52rem', color: accentColor, letterSpacing: '3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                        LOCK USER
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>&times;</button>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                    <button onClick={() => switchTab('paywall')} style={{ flex: 1, padding: '10px', background: isPaywall ? 'rgba(197,160,89,0.12)' : 'transparent', border: `1px solid ${isPaywall ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: isPaywall ? '#c5a059' : '#555', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', letterSpacing: '2px', cursor: 'pointer' }}>
                        PAYWALL
                    </button>
                    <button onClick={() => switchTab('silence')} style={{ flex: 1, padding: '10px', background: !isPaywall ? 'rgba(200,40,40,0.1)' : 'transparent', border: `1px solid ${!isPaywall ? 'rgba(200,40,40,0.45)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 7, color: !isPaywall ? '#e03030' : '#555', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', letterSpacing: '2px', cursor: 'pointer' }}>
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
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: '#555', letterSpacing: '2px', marginBottom: 8 }}>AMOUNT (€)</div>
                        <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 50" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '1rem', padding: '10px 14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                )}

                {error && <div style={{ color: '#ff5555', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', marginBottom: 12 }}>{error}</div>}

                <button onClick={activate} disabled={loading} style={{ width: '100%', padding: '13px', background: isPaywall ? 'linear-gradient(135deg,#c5a059,#8b6914)' : 'linear-gradient(135deg,#b02020,#7a1010)', border: 'none', borderRadius: 8, color: isPaywall ? '#000' : '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.48rem', fontWeight: 700, letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
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
    const [showChattersModal, setShowChattersModal] = useState(false);
    const [challengeWidget, setChallengeWidget] = useState<{ name: string; theme: string; activeCount: number; totalCount: number; leader: string | null; isUpcoming?: boolean; startDate?: string; image_url?: string | null; description?: string; duration_days?: number; tasks_per_day?: number; window_minutes?: number; start_date_raw?: string } | null>(null);
    const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
    const [showChallenges, setShowChallenges] = useState(false);
    const [showVideoChallenges, setShowVideoChallenges] = useState(false);
    const [showGlobal, setShowGlobal] = useState(false);
    const [showKeyholder, setShowKeyholder] = useState(false);
    const [keyholderMember, setKeyholderMember] = useState('');
    const [role, setRole] = useState<'queen' | 'chatter'>('queen');
    const roleRef = useRef<'queen' | 'chatter'>('queen');
    const [queenOnlyChat, setQueenOnlyChat] = useState(false);
    const [vaultRequest, setVaultRequest] = useState<any>(null);
    const [vaultLoading, setVaultLoading] = useState(false);
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
    const [vaultSession, setVaultSession] = useState<any>(null);
    const [vaultSessionLoading, setVaultSessionLoading] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const isDashboardRoute = pathname === '/dashboard';

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
        // Fetch current user email and start heartbeat so queen's last_active stays fresh
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
        const getCurrUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
                setAdminEmail(user.email);

                // Detect role: queen or chatter
                try {
                    const roleRes = await fetch('/api/chatter/role');
                    const roleData = await roleRes.json();
                    if (roleData.role === 'chatter' || roleData.role === 'queen') {
                        setDashboardRole(roleData.role);
                        setRole(roleData.role);
                        roleRef.current = roleData.role;
                    }
                } catch {}

                // Init OneSignal so queen receives push notifications on desktop
                const w = window as any;
                w.OneSignalDeferred = w.OneSignalDeferred || [];
                w.OneSignalDeferred.push(async (OS: any) => {
                    try {
                        await OS.init({
                            appId: '761d91da-b098-44a7-8d98-75c1cce54dd0',
                            safari_web_id: 'web.onesignal.auto.5f8d50ad-7ec3-4f1c-a2de-134e8949294e',
                            notifyButton: { enable: false },
                            allowLocalhostAsSecureOrigin: true,
                        });
                        await OS.login(user.email);
                        // Auto-save subscription ID if permission already granted
                        const subId = OS?.User?.PushSubscription?.id;
                        if (subId) {
                            fetch('/api/push', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ subscriptionId: subId }),
                            }).catch(() => {});
                        }
                    } catch { /* already inited */ }
                });
            }
            if (user?.id || user?.email) {
                const ping = () => {
                    // Update via UUID-based tracking ping
                    if (user.id) {
                        fetch('/api/tracking/ping', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, clientData: {} }),
                        }).catch(() => {});
                    }
                    // Also update via email-based presence heartbeat (sends both email + userId)
                    fetch('/api/global/presence', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email || undefined, userId: user.id || undefined }),
                    }).catch(() => {});
                };
                ping(); // immediate first ping
                heartbeatInterval = setInterval(ping, 60 * 1000); // then every 60s
            }
        };
        getCurrUser();

        // Expose lock state setter so vanilla updateDetail can push state into React
        (window as any)._setActiveLocks = setActiveLocks;
        (window as any)._setQueenOnlyChat = setQueenOnlyChat;
        (window as any)._setVaultRequest = (req: any) => {
            setVaultRequest(req);
            (window as any)._isVaultActive = req?.status === 'active';
            // Auto-fetch full vault session data when user has active lock
            if (req?.status === 'active') {
                const id = (window as any).currId;
                if (id) {
                    setVaultSessionLoading(true);
                    fetch(`/api/vault/session?memberId=${encodeURIComponent(id)}`)
                        .then(r => r.json())
                        .then(d => { if (d.active) setVaultSession(d); else setVaultSession(null); })
                        .catch(() => setVaultSession(null))
                        .finally(() => setVaultSessionLoading(false));
                }
            } else {
                setVaultSession(null);
            }
        };

        // Inject scripts into window for legacy compatibility (DOM onclick handlers)
        if (typeof window !== 'undefined') {
            // Wrapped with mobile nav sync
            (window as any).showHome = () => {
                setShowChallenges(false);
                setShowVideoChallenges(false);
                setShowGlobal(false);
                markPendingRead(); // leaving a chat - mark it as read now
                showHome();
                document.querySelector('.sidebar')?.classList.remove('mob-open');
                document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
                document.getElementById('mobNavHome')?.classList.add('active');
            };
            (window as any).showProfile = (id?: string) => {
                setShowChallenges(false);
                setShowVideoChallenges(false);
                setShowGlobal(false);
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
                setShowVideoChallenges(false);
                setShowGlobal(false);
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
            // Global chat lightbox for photo posts
            if (!(window as any)._openGlobalLightbox) {
                (window as any)._openGlobalLightbox = (url: string, type?: string) => {
                    let lb = document.getElementById('globalChatLightbox');
                    if (!lb) {
                        lb = document.createElement('div');
                        lb.id = 'globalChatLightbox';
                        lb.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000002;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px);';
                        lb.innerHTML = '<div id="globalChatLightboxMedia" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:20px;box-sizing:border-box;"></div>';
                        lb.addEventListener('click', (e) => {
                            if (e.target === lb || e.target === document.getElementById('globalChatLightboxMedia')) {
                                const vid = lb!.querySelector('video');
                                if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
                                lb!.style.display = 'none';
                            }
                        });
                        document.body.appendChild(lb);
                    }
                    const media = document.getElementById('globalChatLightboxMedia');
                    if (media) {
                        media.innerHTML = '';
                        if (type === 'video') {
                            const vid = document.createElement('video');
                            vid.setAttribute('controls', '');
                            vid.setAttribute('playsinline', '');
                            vid.setAttribute('preload', 'metadata');
                            vid.muted = true;
                            vid.style.cssText = 'max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.8);cursor:default;background:#000;';
                            vid.addEventListener('click', (e) => e.stopPropagation());
                            vid.addEventListener('ended', () => { vid.pause(); lb!.style.display = 'none'; });
                            vid.src = url;
                            media.appendChild(vid);
                            vid.play().then(() => { vid.muted = false; }).catch(() => {});
                        } else {
                            media.innerHTML = `<img src="${url}" style="max-width:94vw;max-height:92vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.8);" />`;
                        }
                    }
                    lb.style.display = 'flex';
                };
            }

            // Bind mobile global overlay functions
            bindDashMobGlobal();

            // Stream chat for dashboard (Queen can chat with stream viewers)
            bindStreamPlayer();
            initDashStreamChat(() => adminEmail || '');

            // Bind inline risky send (standalone module — works on dashboard too)
            bindInlineRisky(
                () => adminEmail || '',
                () => 0,
                () => {},
            );

            // Mobile nav controller
            (window as any).mobNav = (tab: string) => {
                const sidebar = document.querySelector('.sidebar');
                document.querySelectorAll('.mob-nav-btn').forEach((b: any) => b.classList.remove('active'));
                const btnMap: Record<string, string> = { home: 'mobNavHome', subs: 'mobNavSubs', posts: 'mobNavPosts', queen: 'mobNavQueen', global: 'mobNavGlobal' };
                document.getElementById(btnMap[tab])?.classList.add('active');
                // Close global overlay when switching to another tab
                if (tab !== 'global') (window as any).closeMobGlobal?.();
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
            // Close any overlay panels (GLOBAL / CHALLENGES / KEYHOLDER) — called from vanilla JS selUser
            (window as any)._closeOverlays = () => {
                (window as any).closeMobGlobal?.();
                setShowGlobal(false);
                setShowChallenges(false);
                setShowVideoChallenges(false);
                setShowKeyholder(false);
            };
        }

        // Mobile uses MobileDashboard — skip all desktop init
        if (window.innerWidth < 768) return () => { cleanupPresenceTracking(); destroyDashStreamChat(); };

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
                    const msgFromMessages = unreadMap[(u.memberId || u.member_id || '').toLowerCase()];
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

                // Filter out queen-only chats for chatters
                const visibleUsers = roleRef.current === 'chatter'
                    ? mappedUsers.filter((u: any) => !u.parameters?.queen_only_chat)
                    : mappedUsers;
                setUsers(visibleUsers);

                try {
                    const readRes = await fetch('/api/chat/mark-read?type=admin');
                    const readData = await readRes.json();
                    const serverReadMap = readData.chatRead || {};
                    const readMap: Record<string, number> = {};
                    Object.entries(serverReadMap).forEach(([id, ts]) => {
                        readMap[id.toLowerCase()] = new Date(ts as string).getTime();
                    });

                    // Sync: server wins when newer, localStorage wins when newer
                    // Then update localStorage so mobile/desktop stay in sync
                    mappedUsers.forEach((u: any) => {
                        const uuid = (u.memberId || '').toLowerCase();
                        if (!uuid) return;
                        const key = 'read_' + uuid;
                        const localTs = parseInt(localStorage.getItem(key) || '0');
                        const serverTs = readMap[uuid] || 0;
                        if (serverTs > localTs) {
                            // Server is newer (e.g. read on mobile) — update localStorage
                            localStorage.setItem(key, serverTs.toString());
                        } else if (localTs > serverTs) {
                            // localStorage is newer — use it and persist to server
                            readMap[uuid] = localTs;
                        }
                    });

                    setAdminReadMap(readMap);
                } catch {}

                setAvailableDailyTasks(data.dailyTasks || []);

                const allQueues = data.globalQueue || [];
                setGlobalQueue(allQueues);
                mappedUsers.forEach((u: any) => {
                    const uEmail = (u.member_id || '').toLowerCase();
                    const uUuid = (u.memberId || '').toLowerCase();
                    u.reviewQueue = allQueues.filter((t: any) => {
                        const tId = (t.member_id || '').toLowerCase();
                        return tId === uEmail || tId === uUuid ||
                            (t.ownerId || '').toLowerCase() === uEmail ||
                            (t.ownerId || '').toLowerCase() === uUuid;
                    });
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
                // Safety net: re-render sidebar after a tick in case DOM wasn't ready
                setTimeout(() => renderSidebar(), 50);

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

        loadLiveAction();

        const supabaseRt = createClient();

        // ── Debounced sidebar render — max once per 300ms ──────────────────
        let _sidebarTimer: ReturnType<typeof setTimeout> | null = null;
        const debouncedRenderSidebar = () => {
            if (_sidebarTimer) clearTimeout(_sidebarTimer);
            _sidebarTimer = setTimeout(() => renderSidebar(), 300);
        };

        // ── Realtime: new chat message → sidebar lights up instantly ──────────
        // Primary handler is in dashboard-main.ts (subscribeToGlobalChat).
        // This is a backup channel — mutates in-place, no array replacement.
        const chatsChannel = supabaseRt
            .channel('chats-admin-live')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
            }, (payload: any) => {
                const msg = payload.new;
                if (!msg) return;
                const isQueenMsg = msg.metadata?.isQueen === true;
                const isSystemMsg = msg.type === 'system' || (msg.sender_email || '').toLowerCase() === 'system';
                if (isQueenMsg || isSystemMsg) return;
                // Skip admin-sent messages — only slave messages trigger unread
                const senderLc = (msg.sender_email || '').toLowerCase();
                if (senderLc && senderLc === (userEmail || '').toLowerCase()) return;
                const msgMemberId = (msg.member_id || '').toLowerCase();
                if (!msgMemberId) return;
                const msgTime = new Date(msg.created_at).getTime();
                if (!msgTime) return;
                // Match by UUID (new records) or email (old records)
                const found = users.find((u: any) => {
                    const uuid = (u.memberId || '').toLowerCase();
                    const email = (u.member_id || '').toLowerCase();
                    return msgMemberId === uuid || msgMemberId === email;
                });
                if (found && msgTime > (found.lastMessageTime || 0)) {
                    found.lastMessageTime = msgTime;
                    found.lastSeen = new Date(msgTime).toISOString();
                    updateSidebarItem(found.memberId);
                }
            })
            .subscribe();

        // ── Realtime: profile changes → surgical update from payload ──────
        const profilesChannel = supabaseRt
            .channel('profiles-admin-live')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
            }, (payload: any) => {
                const updated = payload.new;
                if (!updated) return;
                const updatedId = updated.ID || updated.id;
                const found = users.find((u: any) => u.memberId === updatedId || u.id === updatedId);
                if (!found) return;
                // Merge changed fields into existing user object
                if (updated.wallet !== undefined) found.wallet = Number(updated.wallet);
                if (updated.score !== undefined) found.score = Number(updated.score);
                if (updated.hierarchy !== undefined) found.hierarchy = updated.hierarchy;
                if (updated.name !== undefined) found.name = updated.name;
                if (updated.silence !== undefined) found.silence = updated.silence === true;
                if (updated.parameters !== undefined) {
                    found.parameters = { ...found.parameters, ...updated.parameters };
                    // Sync paywall flag
                    found.paywall = !!(updated.parameters?.paywall?.active);
                }
                if (updated.avatar_url) {
                    const pic = getOptimizedUrl(updated.avatar_url, 100) || '/collar-placeholder.png';
                    found.avatar = pic;
                    found.profilePicture = pic;
                    found.image = pic;
                }
                if (updated.last_active) found.lastSeen = updated.last_active;
                // Update the currently open user detail if viewing this user
                if (currId === found.memberId || currId === (found.member_id || '')) {
                    updateDetail(found);
                }
                debouncedRenderSidebar();
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'profiles',
            }, (payload: any) => {
                const newProfile = payload.new;
                if (!newProfile) return;
                // Check not already in list
                const existingId = newProfile.ID || newProfile.id;
                if (users.find((u: any) => u.memberId === existingId)) return;
                // Build a minimal user object from the payload
                const pic = getOptimizedUrl(newProfile.avatar_url || '/collar-placeholder.png', 100) || '/collar-placeholder.png';
                const newUser = {
                    ...newProfile,
                    id: existingId,
                    memberId: existingId,
                    name: newProfile.name || (newProfile.member_id || '').split('@')[0],
                    hierarchy: newProfile.hierarchy || 'Hall Boy',
                    score: Number(newProfile.score || 0),
                    wallet: Number(newProfile.wallet || 0),
                    avatar: pic,
                    profilePicture: pic,
                    image: pic,
                    lastMessageTime: 0,
                    lastSeen: newProfile.last_active || null,
                    silence: newProfile.silence === true,
                    parameters: newProfile.parameters || {},
                    reviewQueue: [],
                };
                users.push(newUser);
                setUsers([...users]);
                debouncedRenderSidebar();
            })
            .subscribe();

        // ── Realtime: tasks table changes → operations monitor updates ──
        const tasksChannel = supabaseRt
            .channel('tasks-admin-live')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
            }, (payload: any) => {
                const updated = payload.new;
                if (!updated) return;
                const taskMemberId = (updated.member_id || '').toLowerCase();
                if (!taskMemberId) return;

                // Parse Taskdom_History for pending entries
                let history: any[] = [];
                try { history = JSON.parse(updated['Taskdom_History'] || '[]'); } catch { return; }
                const pendingEntries = history.filter((t: any) => t.status === 'pending');

                // Build review queue items from pending entries
                const queueItems = pendingEntries.map((entry: any) => ({
                    ...entry,
                    member_id: updated.member_id,
                    memberName: updated['Name'] || 'Slave',
                }));

                // Update the matching user's reviewQueue
                const user = users.find((u: any) => {
                    const uid = (u.member_id || u.memberId || '').toLowerCase();
                    return uid === taskMemberId;
                });
                if (user) {
                    user.reviewQueue = queueItems;
                }

                // Rebuild globalQueue from all users
                const newGlobalQueue: any[] = [];
                users.forEach((u: any) => {
                    if (u.reviewQueue) {
                        u.reviewQueue.forEach((item: any) => newGlobalQueue.push(item));
                    }
                });
                setGlobalQueue(newGlobalQueue);

                renderMainDashboard();
            })
            .subscribe();

        // ── Realtime: queen-only chat restriction broadcast ──
        const restrictChannel = supabaseRt
            .channel('chat-restrict-sync')
            .on('broadcast', { event: 'restrict' }, (payload: any) => {
                if (roleRef.current !== 'chatter') return;
                const { memberId, restricted } = payload.payload || {};
                if (!memberId) return;
                if (restricted) {
                    const filtered = users.filter((u: any) => u.memberId !== memberId && u.member_id !== memberId);
                    setUsers(filtered);
                    debouncedRenderSidebar();
                } else {
                    // Unrestricted — need full re-fetch to get user back
                    loadLiveAction();
                }
            })
            .subscribe();
        // Expose for the restrict toggle to broadcast
        (window as any)._restrictChannel = restrictChannel;

        // ── Visibility handler: reconnect everything when tab becomes active ──
        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible') return;
            console.log('[DASHBOARD] tab visible — reconnecting realtime...');

            // Re-subscribe dead page-level channels (don't just remove — re-subscribe!)
            const reconnectChannel = (ch: any, name: string) => {
                if (ch && (ch.state === 'errored' || ch.state === 'closed')) {
                    console.log(`[DASHBOARD] ${name} channel dead, re-subscribing`);
                    ch.subscribe();
                }
            };
            reconnectChannel(chatsChannel, 'chats');
            reconnectChannel(profilesChannel, 'profiles');
            reconnectChannel(tasksChannel, 'tasks');

            // Reconnect chat, presence, and task watcher modules
            reconnectDashboardChat();
            reconnectPresence();
            reconnectDashboardMain();

            // Catch up on missed unread messages while tab was hidden
            try {
                const unreadMap = await getUnreadMessageStatus();
                users.forEach((u: any) => {
                    const uuid = (u.memberId || '').toLowerCase();
                    if (!uuid) return;
                    const serverTs = unreadMap[uuid];
                    if (serverTs) {
                        const ts = new Date(serverTs).getTime();
                        if (ts > (u.lastMessageTime || 0)) {
                            u.lastMessageTime = ts;
                        }
                    }
                });
            } catch {}

            // Re-render sidebar to pick up any missed updates
            debouncedRenderSidebar();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            supabaseRt.removeChannel(chatsChannel);
            supabaseRt.removeChannel(profilesChannel);
            supabaseRt.removeChannel(tasksChannel);
            supabaseRt.removeChannel(restrictChannel);
            cleanupPresenceTracking();
            destroyDashStreamChat();
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

            {/* SIDEBAR — subs list only */}
            <div className="sidebar">
                <div style={{ textAlign: 'center', padding: '5px', borderBottom: '1px solid #333' }}>
                    <div style={{ fontSize: '0.5rem', color: '#666' }}>TODAY'S ID</div>
                    <div id="adminDailyCode" style={{ color: 'var(--gold)', fontWeight: 900, fontFamily: "'Rajdhani', sans-serif", fontSize: '1.1rem', letterSpacing: '2px' }}>----</div>
                </div>
                <div onClick={() => { setShowGlobal(false); setShowChallenges(false); setShowVideoChallenges(false); setShowKeyholder(false); (window as any).showHome(); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(197,160,89,0.04)' }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: '#c5a059', letterSpacing: '3px', flex: 1 }}>DASHBOARD</span>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(197,160,89,0.5)' }}>⌂</span>
                </div>
                <div onClick={() => { (window as any).showHome(); setShowChallenges(false); setShowVideoChallenges(false); setShowGlobal(true); setShowKeyholder(false); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 8, background: showGlobal ? 'rgba(197,160,89,0.08)' : 'transparent' }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: showGlobal ? '#c5a059' : 'rgba(255,255,255,0.4)', letterSpacing: '3px', flex: 1 }}>GLOBAL</span>
                    <span style={{ fontSize: '0.8rem', color: showGlobal ? 'rgba(197,160,89,0.7)' : 'rgba(255,255,255,0.2)' }}>⊕</span>
                </div>
                <div onClick={() => { (window as any).showHome(); setShowChallenges(false); setShowVideoChallenges(false); setShowGlobal(false); setShowKeyholder(true); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 8, background: showKeyholder ? 'rgba(139,0,0,0.08)' : 'transparent' }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: showKeyholder ? 'rgba(180,40,40,0.9)' : 'rgba(255,255,255,0.4)', letterSpacing: '3px', flex: 1 }}>KEYHOLDER</span>
                    <span style={{ fontSize: '0.8rem', color: showKeyholder ? 'rgba(180,40,40,0.7)' : 'rgba(255,255,255,0.2)' }}>&#9919;</span>
                </div>
                <div className="sb-head">SUB LIST</div>
                <div id="userList" className="user-list"></div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="content" style={{ position: 'relative' }}>

                {/* CHALLENGES INLINE PANEL - overlays content area when open */}
                {showChallenges && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#04040e' }}>
                        <ChallengesContent onClose={() => setShowChallenges(false)} />
                    </div>
                )}

                {/* VIDEO CHALLENGES INLINE PANEL */}
                {showVideoChallenges && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#04040e' }}>
                        <VideoChallengesContent onClose={() => setShowVideoChallenges(false)} />
                    </div>
                )}

                {/* GLOBAL INLINE PANEL - overlays content area when open */}
                {showGlobal && !isMobile && (
                    <GlobalContent onClose={() => setShowGlobal(false)} userEmail={userEmail} />
                )}

                {/* KEYHOLDER PROGRAM PANEL */}
                {showKeyholder && !isMobile && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#08080c' }}>
                        <KeyholderProgramContent onClose={() => { setShowKeyholder(false); setKeyholderMember(''); }} initialMember={keyholderMember} />
                    </div>
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
                        <div className="v-stat-card glass-card" onClick={() => (window as any).showHome()} style={{ cursor: 'pointer', border: '1px solid rgba(197,160,89,0.25)' }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: '#c5a059' }}>DASHBOARD</div>
                            </div>
                            <div className="vs-icon gold-bg" style={{ fontSize: '1.1rem' }}>⌂</div>
                        </div>
                        <div className="v-stat-card glass-card" onClick={() => { setShowGlobal(false); setShowChallenges(false); setShowVideoChallenges(false); (window as any).showPosts(); }} style={{ cursor: 'pointer', border: '1px solid rgba(197,160,89,0.25)' }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: '#c5a059' }}>POSTS</div>
                            </div>
                            <div className="vs-icon gold-bg" style={{ fontSize: '1.1rem' }}>✦</div>
                        </div>
                        <div className="v-stat-card glass-card" onClick={() => { setShowGlobal(false); setShowVideoChallenges(false); setShowChallenges(true); }} style={{ cursor: 'pointer', border: `1px solid ${showChallenges ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.2)'}`, position: 'relative' }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: showChallenges ? '#4ade80' : '#4ade8099' }}>CHALLENGES</div>
                            </div>
                            <div className="vs-icon" style={{ background: 'rgba(74,222,128,0.12)', fontSize: '1.1rem' }}>⚔</div>
                            {pendingVerificationCount > 0 && <span style={{ position: 'absolute', top: 8, right: 12, background: '#e03030', color: '#fff', borderRadius: 10, padding: '2px 7px', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', fontWeight: 700, letterSpacing: '0.5px' }}>{pendingVerificationCount}</span>}
                        </div>
                        <div className="v-stat-card glass-card" onClick={() => { setShowGlobal(false); setShowChallenges(false); setShowVideoChallenges(true); }} style={{ cursor: 'pointer', border: `1px solid ${showVideoChallenges ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.2)'}` }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: showVideoChallenges ? '#a855f7' : '#a855f799' }}>VIDEO</div>
                            </div>
                            <div className="vs-icon" style={{ background: 'rgba(168,85,247,0.12)', fontSize: '1.1rem' }}>▶</div>
                        </div>
                        <div className="v-stat-card glass-card" onClick={() => { setShowChallenges(false); setShowVideoChallenges(false); setShowGlobal(true); setShowKeyholder(false); }} style={{ cursor: 'pointer', border: `1px solid ${showGlobal ? 'rgba(197,160,89,0.5)' : 'rgba(197,160,89,0.2)'}` }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: showGlobal ? '#c5a059' : 'rgba(255,255,255,0.45)' }}>GLOBAL</div>
                            </div>
                            <div className="vs-icon gold-bg" style={{ fontSize: '1.1rem' }}>⊕</div>
                        </div>
                        <div className="v-stat-card glass-card" onClick={() => { setShowChallenges(false); setShowVideoChallenges(false); setShowGlobal(false); setShowKeyholder(true); }} style={{ cursor: 'pointer', border: `1px solid ${showKeyholder ? 'rgba(139,0,0,0.5)' : 'rgba(139,0,0,0.2)'}` }}>
                            <div className="vs-info">
                                <div className="vs-label" style={{ color: showKeyholder ? 'rgba(180,40,40,0.9)' : 'rgba(180,40,40,0.6)' }}>KEYHOLDER</div>
                            </div>
                            <div className="vs-icon" style={{ background: 'rgba(139,0,0,0.12)', fontSize: '1.1rem' }}>&#9919;</div>
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
                                            style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}
                                        >LOGOUT</button>
                                    </div>
                                </div>
                            </div>
                            <div className="vh-footer">Tap to record →</div>
                        </div>

                        {isDashboardRoute ? (
                            <>
                                {/* KNOCKING AT THE GATE — inline in challenges slot (dashboard only) */}
                                <LeadsInlinePanel />

                                {/* EXCHEQUER — inline in global slot (dashboard only) */}
                                <div className="glass-card span-1" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 320 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid rgba(197,160,89,0.12)', flexShrink: 0 }}>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', color: '#c5a059', letterSpacing: '3px' }}>EXCHEQUER</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '1px' }}>COIN PURCHASES</div>
                                    </div>
                                    <div id="exchequerLogInline" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                                        <div style={{ padding: '20px', textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>LOADING...</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* CHALLENGES WIDGET — original card (chat route) */}
                                <div className="v-gauge-card glass-card span-1"
                                    onClick={() => setShowChallenges(true)}
                                    style={{ border: `1px solid ${challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.4)' : 'rgba(74,222,128,0.3)') : 'rgba(197,160,89,0.15)'}`, cursor: 'pointer', transition: 'border-color 0.2s', padding: 0, overflow: 'hidden' }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.7)' : 'rgba(74,222,128,0.6)') : 'rgba(197,160,89,0.4)')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = challengeWidget ? (challengeWidget.isUpcoming ? 'rgba(197,160,89,0.4)' : 'rgba(74,222,128,0.3)') : 'rgba(197,160,89,0.15)')}>
                                    <div className="vg-header" style={{ padding: '12px 16px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="vg-title" style={{ color: challengeWidget ? (challengeWidget.isUpcoming ? '#c5a059' : '#4ade80') : '#c5a059' }}>CHALLENGES</div>
                                            {pendingVerificationCount > 0 && (
                                                <span style={{ background: '#e03030', color: '#fff', borderRadius: 10, padding: '2px 7px', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.36rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                    {pendingVerificationCount} TO VALIDATE
                                                </span>
                                            )}
                                        </div>
                                        <div className="vg-sub" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setShowChallenges(true); }}>MANAGE ↗</div>
                                    </div>
                                    {challengeWidget ? (
                                        <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${challengeWidget.isUpcoming ? 'rgba(197,160,89,0.15)' : 'rgba(74,222,128,0.1)'}` }}>
                                            <div style={{ width: 120, flexShrink: 0, position: 'relative', background: 'rgba(197,160,89,0.04)', minHeight: 200 }}>
                                                {challengeWidget.image_url
                                                    ? <img src={challengeWidget.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} alt={challengeWidget.name} />
                                                    : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', opacity: 0.15 }}>★</div>
                                                }
                                                <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: 6, padding: '3px 8px', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', fontWeight: 700, letterSpacing: '1px', background: challengeWidget.isUpcoming ? 'rgba(251,191,36,0.9)' : 'rgba(74,222,128,0.9)', color: '#000' }}>
                                                    {challengeWidget.isUpcoming ? 'SOON' : 'LIVE'}
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-between', minWidth: 0 }}>
                                                <div>
                                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.95rem', color: '#fff', fontWeight: 700, letterSpacing: '1px', marginBottom: 4 }}>{challengeWidget.name}</div>
                                                    {challengeWidget.description && <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, letterSpacing: '0.5px' }}>{challengeWidget.description}</div>}
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
                                                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.78rem', color: 'rgba(197,160,89,0.9)', fontWeight: 700 }}>{val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ padding: '7px 0', borderRadius: 8, background: 'linear-gradient(135deg,#c5a059 0%,#8b6914 100%)', color: '#000', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', fontWeight: 700, letterSpacing: '1px', textAlign: 'center', boxShadow: '0 4px 15px rgba(197,160,89,0.3)' }}>
                                                    {challengeWidget.isUpcoming ? 'VIEW CHALLENGE' : 'MANAGE CHALLENGE'}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 16px' }}>
                                            <div style={{ fontSize: '2rem', opacity: 0.3 }}>★</div>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: '#333', letterSpacing: '2px', textAlign: 'center' }}>NO ACTIVE CHALLENGE</div>
                                            <div style={{ padding: '8px 18px', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 4, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: '#c5a059', letterSpacing: '2px' }}>CREATE ONE ↗</div>
                                        </div>
                                    )}
                                </div>

                                {/* ENTER GLOBAL — original card (chat route) */}
                                <div className="v-best-sub glass-card span-1" onClick={() => { setShowChallenges(false); setShowVideoChallenges(false); setShowGlobal(true); }} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(197,160,89,0.06), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.22)', transition: 'border-color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.5)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(197,160,89,0.22)')}>
                                    <div className="vb-header">
                                        <div className="vb-title" style={{ fontFamily: "'Rajdhani', sans-serif", color: '#c5a059', letterSpacing: '2px' }}>GLOBAL</div>
                                        <div className="vb-sub">Community Hub</div>
                                    </div>
                                    <div className="vb-content">
                                        <div style={{ width: 64, height: 64, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, background: 'rgba(197,160,89,0.06)', boxShadow: '0 0 24px rgba(197,160,89,0.12)' }}>
                                            <span style={{ fontSize: '1.6rem', color: '#c5a059', opacity: 0.85 }}>◎</span>
                                        </div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(197,160,89,0.6)', letterSpacing: '2px' }}>LEADERBOARD · TALK · QUEEN</div>
                                        <div style={{ marginTop: 10, padding: '5px 18px', border: '1px solid rgba(197,160,89,0.35)', borderRadius: 4, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: '#c5a059', letterSpacing: '2px', background: 'rgba(197,160,89,0.08)' }}>ENTER</div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* GLOBAL CHAT */}
                        <GlobalChatPanel userEmail={userEmail} />

                        {/* OPS MONITOR + REVENUE — side by side (queen only for Revenue) */}
                        <div className="span-2" style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
                            {/* OPERATIONS MONITOR */}
                            <div className="v-monitor-card glass-card" style={{ flex: 1, minWidth: 0 }}>
                                <div className="vm-header">Operations Monitor</div>
                                <div id="opsList"></div>
                            </div>

                            {/* REVENUE & INTEL STREAM — queen only */}
                            {role === 'queen' && (
                            <div className="v-feed-card glass-card" style={{ flex: 1, minWidth: 0 }}>
                                <div className="vf-header">Revenue & Intel Stream</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px 14px' }}>
                                    {/* CHATTERS - top priority */}
                                    <div onClick={() => setShowChattersModal(true)} style={{ aspectRatio: '1', background: 'rgba(100,200,255,0.06)', border: '1px solid rgba(100,200,255,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                                        <div style={{ fontSize: '1.2rem' }}>💬</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: 'rgba(100,200,255,0.8)', letterSpacing: '2px' }}>CHATTERS</div>
                                    </div>
                                    <div onClick={() => (window as any).expandFeedSection('wishlist')} style={{ aspectRatio: '1', background: 'rgba(197,160,89,0.06)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                                        <div style={{ fontSize: '1.2rem' }}>🎁</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: '#c5a059', letterSpacing: '2px' }}>WISHLIST</div>
                                    </div>
                                    <div onClick={() => { setLockedUsers(users.filter((u: any) => u.silence === true || !!(u.parameters?.paywall?.active) || u.paywall === true)); setShowLocksModal(true); }} style={{ aspectRatio: '1', background: 'rgba(220,60,60,0.06)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                                        <div style={{ fontSize: '1.2rem' }}>🔒</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: 'rgba(220,60,60,0.7)', letterSpacing: '2px' }}>LOCKS</div>
                                    </div>
                                    <div style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <div style={{ fontSize: '1.2rem', opacity: 0.15 }}>⚡</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '2px' }}>COMING SOON</div>
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>

                        {/* CHATTERS - manage sub-admin chatters (queen-only) */}
                        {role === 'queen' && <ChattersPanel />}
                    </div>
                </div>

                {/* POSTS VIEW */}
                <div id="viewPosts" style={{ display: 'none', flexDirection: 'column', gap: '0', overflowY: 'auto', height: '100%' }}>
                    {/* Header bar with close */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(197,160,89,0.2)', flexShrink: 0, background: 'rgba(0,0,0,0.3)' }}>
                        <div>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', color: '#c5a059', letterSpacing: '4px' }}>QUEEN'S DISPATCH</div>
                            <div style={{ fontFamily: 'Rajdhani', fontSize: '0.65rem', color: '#555', letterSpacing: '2px', marginTop: 2 }}>PUBLISH POSTS · VISIBLE TO ALL SUBJECTS</div>
                        </div>
                        <button onClick={() => (window as any).showHome()} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '25px 30px', display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    {/* COMPOSE */}
                    <div id="postComposeForm" style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: '8px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', color: '#c5a059', letterSpacing: '3px', marginBottom: '5px' }}>NEW POST</div>
                        <input
                            id="postTitleInput"
                            type="text"
                            placeholder="TITLE (optional)"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', padding: '12px 16px', outline: 'none', letterSpacing: '2px', borderRadius: '4px' }}
                        />
                        <textarea
                            id="postBodyInput"
                            placeholder="Write your decree..."
                            rows={5}
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.9rem', padding: '12px 16px', outline: 'none', resize: 'vertical', borderRadius: '4px', lineHeight: 1.6 }}
                        />
                        {/* Image upload */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label htmlFor="postImageInput" style={{ background: '#111', border: '1px solid #333', color: '#888', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', padding: '8px 16px', cursor: 'pointer', letterSpacing: '2px', borderRadius: '4px' }}>+ IMAGE</label>
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
                                <label style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>MIN RANK</label>
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
                                <label style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>PRICE (COINS)</label>
                                <input id="postPriceInput" type="number" min="0" defaultValue={0} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #333', color: '#fff', fontFamily: 'Rajdhani', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '4px', outline: 'none', width: '120px' }} />
                            </div>
                        </div>

                        {/* Media type */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', color: '#555', letterSpacing: '2px' }}>MEDIA TYPE</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['text', 'photo', 'video'].map(t => (
                                    <button key={t} id={`postMediaType_${t}`} onClick={() => {
                                        ['text','photo','video'].forEach(x => {
                                            const b = document.getElementById(`postMediaType_${x}`) as HTMLButtonElement;
                                            if (b) { b.style.background = x === t ? 'rgba(197,160,89,0.2)' : '#111'; b.style.color = x === t ? '#c5a059' : '#666'; b.style.borderColor = x === t ? 'rgba(197,160,89,0.4)' : '#333'; }
                                        });
                                        const inp = document.getElementById('postMediaTypeValue') as HTMLInputElement;
                                        if (inp) inp.value = t;
                                    }} style={{ background: t === 'text' ? 'rgba(197,160,89,0.2)' : '#111', border: `1px solid ${t === 'text' ? 'rgba(197,160,89,0.4)' : '#333'}`, color: t === 'text' ? '#c5a059' : '#666', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', padding: '6px 14px', letterSpacing: '2px', cursor: 'pointer', borderRadius: '4px', textTransform: 'uppercase' }}>{t}</button>
                                ))}
                            </div>
                            <input type="hidden" id="postMediaTypeValue" defaultValue="text" />
                        </div>

                        {/* Published toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" id="postIsPublished" defaultChecked style={{ accentColor: '#c5a059', width: '16px', height: '16px', cursor: 'pointer' }} />
                            <label htmlFor="postIsPublished" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', color: '#888', letterSpacing: '2px', cursor: 'pointer' }}>PUBLISH IMMEDIATELY</label>
                        </div>

                        <button
                            id="postSubmitBtn"
                            onClick={() => (window as any).submitQueenPost()}
                            style={{ background: '#c5a059', color: '#000', border: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '0.85rem', letterSpacing: '4px', padding: '14px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.3s' }}
                        >PUBLISH</button>
                    </div>

                    {/* POSTS LIST */}
                    <div id="postsListContainer" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ color: '#444', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>Click POSTS to load...</div>
                    </div>
                    </div>{/* end scrollable content wrapper */}
                </div>

                {/* 2. PROFILE VIEW */}
                <div id="viewProfile" style={{ display: 'none' }}>
                    <div className="qp-header">
                        <div className="qp-cover"></div>
                        <div className="qp-av-con">
                            <img src="/queen-nav.png" className="qp-av" alt="Profile" onError={(e) => { e.currentTarget.src = '/queen-nav.png' }} />
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

                        {/* ── LUXURY HEADER — 3-column grid ── */}
                        <div className="vu-card">
                            {/* Decorative gold stripes */}
                            <div className="vu-stripe-wrap">
                                <div className="vu-stripe vu-stripe-1"></div>
                                <div className="vu-stripe vu-stripe-2"></div>
                                <div className="vu-stripe vu-stripe-3"></div>
                            </div>
                            <div className="vu-glow"></div>
                            {/* Hidden elements for JS sync */}
                            <img id="chatterHeaderAvatar" src="/collar-placeholder.png" alt="" style={{ display: 'none' }} onError={(e) => { e.currentTarget.src = '/collar-placeholder.png'; }} />
                            <span id="chatterHeaderName" style={{ display: 'none' }}>—</span>
                            <span id="chatterHeaderRank" style={{ display: 'none' }}>—</span>
                            <span id="dMirrorKneel" style={{ display: 'none' }}>0 h</span>

                            <div className="vu-grid">
                                {/* Column 1 — Avatar + Identity */}
                                <div className="vu-col vu-col-identity">
                                    <div className="vu-avatar-container">
                                        <div className="vu-avatar-rim">
                                            <div className="vu-avatar-inner">
                                                <img id="dProfilePic" src="/collar-placeholder.png" alt="" className="vu-avatar-img" onError={(e) => { e.currentTarget.src = '/collar-placeholder.png' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="vu-identity">
                                        <div className="vu-name-row">
                                            <h2 id="dMirrorName" className="vu-name">—</h2>
                                            <span onClick={() => (window as any).adminRenameUser?.((window as any).currId)} className="dp-rename-btn" title="Rename user">&#9998;</span>
                                        </div>
                                        <div className="vu-tagline">
                                            <span id="dMirrorHierarchy" className="vu-rank">—</span>
                                            <span className="vu-rank-dot">·</span>
                                            <span id="dMirrorStatus" className="vu-status">—</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2 — Points & Coins */}
                                <div className="vu-col vu-col-stats">
                                    <div className="vu-glass-card">
                                        <div className="vu-glass-row">
                                            <div className="vu-glass-item">
                                                <span className="vu-glass-label">POINTS</span>
                                                <span id="dMirrorPoints" className="vu-glass-val">0</span>
                                            </div>
                                            <div className="vu-glass-sep"></div>
                                            <div className="vu-glass-item">
                                                <span className="vu-glass-label">COINS</span>
                                                <span id="dMirrorWallet" className="vu-glass-val">0</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 3 — Kneeling */}
                                <div className="vu-col vu-col-kneel">
                                    <div className="vu-glass-card">
                                        <span className="vu-glass-label" style={{ marginBottom: 8 }}>KNEELING</span>
                                        <span id="vuKneelToday" style={{ display: 'none' }}>0 / 8</span>
                                        <span id="vuKneelStatus" style={{ display: 'none' }}>—</span>
                                        <div className="vu-kneel-bar">
                                            <div id="vuKneelFill" className="vu-kneel-fill"></div>
                                        </div>
                                        <div id="vuKneelDots" className="vu-kneel-dots"></div>
                                    </div>
                                </div>

                                {/* Column 4 — Routine */}
                                <div className="vu-col vu-col-routine">
                                    <div className="vu-glass-card vu-routine-glass">
                                        <div className="vu-routine-overlay">
                                            <span className="vu-glass-label">ROUTINE</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <button id="dpChangeRoutineBtn" title="Change routine" onClick={() => { const w = window as any; if (w.changeRoutine && w._currChatterId) w.changeRoutine(w._currChatterId, w._currRoutineName || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(197,160,89,0.4)', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                                <button className="dp-cal-toggle" id="dpCalToggle" onClick={() => { const el = document.getElementById('routineCalendarDrop'); if (el) { const open = el.style.display !== 'none'; el.style.display = open ? 'none' : 'block'; } }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div id="chatter_RoutineContent" className="dp-routine-content">No routine assigned</div>
                                        <div id="routineCalendarSection" style={{ display: 'none' }}>
                                            <div id="routineCalendarDrop" style={{ display: 'none', marginTop: 10 }}>
                                                <div id="routineCalendarGrid"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── SPLIT LAYOUT — chat left, panel right ── */}
                        <div className="chatter-split" style={{ display: 'grid', gridTemplateColumns: '60% 40%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            {/* LEFT: chat */}
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>

                                {/* Task queue overlay — covers chat panel when open */}
                                <div id="taskQueueContainer" className="task-queue-overlay hidden">
                                    <div className="q-head">
                                        <span id="armoryTitle">COMMAND QUEUE</span>
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                            <input type="text" id="taskSearchInput" placeholder="FILTER..." onInput={() => (window as any).filterTaskGallery()} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(197,160,89,0.2)', color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', padding: '5px 10px', borderRadius: '4px', width: '150px' }} />
                                            <button className="q-close" onClick={() => (window as any).closeTaskGallery()}>&times;</button>
                                        </div>
                                    </div>
                                    <div className="task-gallery-split" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: 'calc(100% - 60px)', overflow: 'hidden', position: 'relative' }}>
                                        <div className="command-queue-section" style={{ borderRight: '1px solid rgba(197,160,89,0.1)', padding: '20px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)' }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", color: '#c5a059', fontSize: '0.6rem', letterSpacing: '2px', marginBottom: '15px', textTransform: 'uppercase', opacity: 0.7 }}>Command Queue</div>
                                            <div id="armoryLiveQueue" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
                                        </div>
                                        <div className="directives-section" style={{ padding: '20px', overflowY: 'auto' }}>
                                            <div id="glassTaskGrid"></div>
                                        </div>
                                        <div id="taskDetailModal" className="task-detail-overlay hidden">
                                            <div className="task-detail-glass">
                                                <button className="detail-close" onClick={() => (window as any).closeTaskDetail()}>&times;</button>
                                                <div id="taskDetailContent"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SYSTEM TICKER */}
                                <div id="dashSystemTicker" className="dash-system-ticker"
                                    onClick={() => (window as any).toggleDashSystemLog()}>
                                    SYSTEM ONLINE
                                </div>

                                {/* SYSTEM LOG OVERLAY */}
                                <div id="dashSystemLogContainer" className="dash-syslog-container hidden" style={{ display: 'none' }}>
                                    <div className="dash-syslog-header">
                                        <span>SYSTEM LOGS</span>
                                        <button className="dash-syslog-close" onClick={() => (window as any).toggleDashSystemLog()}>&times;</button>
                                    </div>
                                    <div id="dashSystemLogContent" className="dash-syslog-body"></div>
                                </div>

                                <div className="c-body" id="adminChatBox" style={{ flex: 1, minHeight: 0 }}></div>

                                <div className="c-foot">
                                    <button className="btn-plus" onClick={() => (window as any).triggerAdminMediaPick()}>+</button>
                                    <textarea id="adminInp" className="inp" placeholder="Issue Command..." rows={1} style={{ resize: 'none', overflow: 'hidden' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (window as any).sendMsg(); } }} onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }} />
                                    <button onClick={() => (window as any).openChatGifPicker?.()} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>GIF</button>
                                    <button id="aiDraftBtn" onClick={() => (window as any).requestAiDraft?.()} style={{ padding: '6px 8px', background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', color: 'rgba(147,51,234,0.7)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', fontWeight: 700, cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>AI</button>
                                    <button onClick={() => (window as any).sendMsg()} className="btn-send">{'>'}</button>
                                </div>
                            </div>

                            {/* RIGHT: info panel */}
                            <div style={{ background: '#060606', borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>

                                {/* ── TAB BAR: Profile / Media ── */}
                                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                                    <button id="panelTabProfile" onClick={() => (window as any).toggleMediaGallery?.()} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: '2px solid #c5a059', color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', letterSpacing: '2px', cursor: 'pointer' }}>PROFILE</button>
                                    <button id="panelTabMedia" onClick={() => (window as any).toggleMediaGallery?.()} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: 'none', color: '#555', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.4rem', letterSpacing: '2px', cursor: 'pointer' }}>MEDIA</button>
                                </div>

                                {/* ── MEDIA GALLERY PANEL (hidden by default) ── */}
                                <div id="paidMediaGallery" style={{ display: 'none', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

                                    {/* Upload zone */}
                                    <div style={{ padding: '10px 14px 0' }}>
                                        <div
                                            id="galleryDropZone"
                                            className="media-gallery-drop"
                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
                                            onDragLeave={(e) => { e.currentTarget.classList.remove('dragging'); }}
                                            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('dragging'); (window as any).handleGalleryDrop?.(e.nativeEvent); }}
                                            onClick={() => (window as any).handleGalleryPick?.()}
                                            style={{ padding: '16px 14px' }}
                                        >
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: '#555', letterSpacing: '2px' }}>+ ADD TO VAULT</div>
                                            <div style={{ fontSize: '0.55rem', color: '#333', marginTop: 3 }}>drop or click to upload</div>
                                        </div>
                                    </div>

                                    {/* Category filter pills */}
                                    <div id="vaultCategoryBar" style={{ display: 'flex', gap: 4, padding: '10px 14px', overflowX: 'auto', flexShrink: 0 }}>
                                        {['all', 'feet', 'lifestyle', 'sexy', 'videos'].map(cat => (
                                            <button key={cat} data-cat={cat} onClick={() => (window as any).filterVault?.(cat)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(197,160,89,0.2)', background: cat === 'all' ? 'rgba(197,160,89,0.15)' : 'transparent', color: cat === 'all' ? '#c5a059' : '#555', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', letterSpacing: '1px', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase', flexShrink: 0 }}>{cat}</button>
                                        ))}
                                    </div>

                                    {/* Vault grid */}
                                    <div id="vaultGrid" className="media-gallery-grid" style={{ padding: '0 14px' }}></div>

                                    {/* Send bar — sticky at bottom */}
                                    <div id="vaultSendBar" style={{ display: 'none', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#060606', position: 'sticky', bottom: 0 }}>
                                        <div id="vaultSelectedPreview" style={{ marginBottom: 8 }}></div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: '#555', letterSpacing: '1px', flexShrink: 0 }}>PRICE</div>
                                            <input id="galleryPriceInput" type="number" min="1" step="1" placeholder="e.g. 500" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 6, color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} />
                                        </div>
                                        <button id="gallerySendBtn" onClick={() => (window as any).sendPaidMedia?.()} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 6, color: '#000', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', fontWeight: 700, letterSpacing: '2px', cursor: 'pointer' }}>
                                            SEND PAID MEDIA
                                        </button>
                                    </div>
                                </div>

                                {/* ── PROFILE PANEL (default visible) ── */}
                                <div id="chatterProfilePanel" className="dp-panel">
                                <div id="apMirrorHeader" style={{ display: 'none' }}></div>

                                {/* ═══ SECTIONS ═══ */}
                                <div className="dp-sections">

                                {/* ── VAULT LOCKED VIEW — replaces normal sections when user is locked ── */}
                                {vaultRequest?.status === 'active' && (() => {
                                    const vs = vaultSession;
                                    const s = vs?.session;
                                    const daysIn = vs?.daysIn ?? 0;
                                    const lockDays = s?.lock_days || vaultRequest.lockDays || 0;
                                    const startedAt = s?.started_at ? new Date(s.started_at) : null;
                                    const expiresAt = s?.expires_at ? new Date(s.expires_at) : null;
                                    const remaining = expiresAt ? Math.max(0, expiresAt.getTime() - Date.now()) : 0;
                                    const remainDays = Math.floor(remaining / 86400000);
                                    const remainHrs = Math.floor((remaining % 86400000) / 3600000);
                                    const pctDone = lockDays > 0 ? Math.min(100, (daysIn / lockDays) * 100) : 0;
                                    const penaltyHrs = vs?.totalPenaltyHours || 0;
                                    const streak = s?.current_streak || 0;
                                    const bestStreak = s?.best_streak || 0;
                                    const perfectDays = s?.total_perfect_days || 0;
                                    const failedDays = s?.total_failed_days || 0;
                                    const sealEarned = s?.seal_earned || null;
                                    const todayOrders: any[] = vs?.today?.orders ? (typeof vs.today.orders === 'string' ? JSON.parse(vs.today.orders) : vs.today.orders) : [];
                                    const todayPerfect = vs?.today?.perfect || false;
                                    const dailyRecords: any[] = vs?.dailyRecords || [];
                                    const begs: any[] = vs?.begs || [];
                                    const orderLabels: Record<string, string> = { kneel: 'KNEEL', chastity_check: 'CHASTITY CHECK', trial: 'TRIAL', spin: 'SPIN', tribute: 'TRIBUTE' };
                                    // Chastity check data from vault_check_log (proper table, not orders JSON)
                                    const chastityCheckRow = vs?.chastityCheck || null;
                                    const todayChastityPhoto = chastityCheckRow?.proof_url || null;
                                    const chastityStatus = chastityCheckRow?.status || 'none';
                                    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                    return (
                                    <div style={{ padding: '0 4px' }}>
                                        {/* ── LOCKED HEADER ── */}
                                        <div style={{ textAlign: 'center', padding: '20px 10px 16px' }}>
                                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(139,0,0,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                            </svg>
                                            <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.85rem', color: 'rgba(180,40,40,0.85)', letterSpacing: 6, fontWeight: 700, marginTop: 8 }}>VAULT LOCKED</div>
                                            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 3, marginTop: 4 }}>
                                                {s?.tier || `${lockDays}d`} SENTENCE
                                            </div>
                                        </div>

                                        {/* ── COUNTDOWN ── */}
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, margin: '0 0 16px' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{daysIn}</div>
                                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>DAY</div>
                                            </div>
                                            <div style={{ width: 1, background: 'rgba(139,0,0,0.2)', alignSelf: 'stretch' }} />
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '1.6rem', fontWeight: 800, color: 'rgba(139,0,0,0.8)' }}>{remainDays}d {remainHrs}h</div>
                                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>REMAINING</div>
                                            </div>
                                        </div>

                                        {/* ── PROGRESS BAR ── */}
                                        <div style={{ margin: '0 8px 20px' }}>
                                            <div style={{ height: 4, background: 'rgba(139,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pctDone}%`, background: 'linear-gradient(90deg, rgba(139,0,0,0.4), rgba(139,0,0,0.7))', borderRadius: 2, transition: 'width 0.5s' }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>{startedAt ? fmtDate(startedAt) : '—'}</span>
                                                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.45rem', color: 'rgba(139,0,0,0.5)' }}>{Math.round(pctDone)}%</span>
                                                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)' }}>{expiresAt ? fmtDate(expiresAt) : '—'}</span>
                                            </div>
                                        </div>

                                        {/* ── TODAY'S ORDERS ── */}
                                        <div style={{ background: 'rgba(139,0,0,0.04)', border: '1px solid rgba(139,0,0,0.12)', borderRadius: 8, margin: '0 4px 12px', padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <span style={{ fontFamily: "'Cinzel',serif", fontSize: '0.5rem', color: 'rgba(180,40,40,0.7)', letterSpacing: 3 }}>TODAY&apos;S ORDERS</span>
                                                {todayPerfect && <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.45rem', color: 'rgba(80,200,80,0.8)', letterSpacing: 2 }}>✓ PERFECT</span>}
                                            </div>
                                            {todayOrders.length > 0 ? todayOrders.map((o: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${o.done >= o.target ? 'rgba(80,200,80,0.6)' : 'rgba(139,0,0,0.3)'}`, background: o.done >= o.target ? 'rgba(80,200,80,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem', color: o.done >= o.target ? 'rgba(80,200,80,0.8)' : 'transparent' }}>✓</div>
                                                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.5rem', color: o.done >= o.target ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)', letterSpacing: 2, flex: 1, textDecoration: o.done >= o.target ? 'line-through' : 'none', opacity: o.done >= o.target ? 0.5 : 1 }}>{orderLabels[o.type] || o.type.toUpperCase()}</span>
                                                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.5rem', color: o.done >= o.target ? 'rgba(80,200,80,0.6)' : 'rgba(139,0,0,0.6)' }}>{o.done}/{o.target}</span>
                                                </div>
                                            )) : (
                                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>{vaultSessionLoading ? 'Loading...' : 'No orders yet'}</div>
                                            )}
                                        </div>

                                        {/* ── VIEW FULL PROGRAM + OPEN CHAT BUTTONS ── */}
                                        <div style={{ margin: '0 4px 12px', display: 'flex', gap: 8 }}>
                                            <button onClick={() => { setKeyholderMember(currId || ''); setShowKeyholder(true); }} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(139,0,0,0.25)', background: 'rgba(139,0,0,0.06)', color: 'rgba(180,40,40,0.8)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer' }}>VIEW PROGRAM</button>
                                            <button onClick={async () => {
                                                const until = Date.now() + 365 * 24 * 60 * 60 * 1000;
                                                try {
                                                    await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_chat_cooldown', memberId: currId, until }) });
                                                    alert('Chat opened');
                                                } catch {}
                                            }} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(197,160,89,0.25)', background: 'rgba(197,160,89,0.06)', color: 'rgba(197,160,89,0.8)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer' }}>OPEN CHAT</button>
                                        </div>

                                        {/* ── CHASTITY CHECK — PRIMARY TASK ── */}
                                        <div style={{ margin: '0 4px 12px', background: chastityStatus === 'approved' ? 'rgba(80,200,80,0.04)' : chastityStatus === 'pending' ? 'rgba(197,160,89,0.06)' : 'rgba(139,0,0,0.04)', border: `1px solid ${chastityStatus === 'approved' ? 'rgba(80,200,80,0.2)' : chastityStatus === 'pending' ? 'rgba(197,160,89,0.25)' : 'rgba(139,0,0,0.12)'}`, borderRadius: 8, padding: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: todayChastityPhoto ? 8 : 0 }}>
                                                <span style={{ fontFamily: "'Cinzel',serif", fontSize: '0.5rem', color: chastityStatus === 'approved' ? 'rgba(80,200,80,0.8)' : 'rgba(180,40,40,0.7)', letterSpacing: 3 }}>CHASTITY CHECK</span>
                                                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.4rem', letterSpacing: 2, color: chastityStatus === 'approved' ? 'rgba(80,200,80,0.8)' : chastityStatus === 'pending' ? 'rgba(197,160,89,0.8)' : chastityStatus === 'rejected' ? 'rgba(255,60,60,0.7)' : 'rgba(255,255,255,0.25)' }}>
                                                    {chastityStatus === 'approved' ? '✓ APPROVED' : chastityStatus === 'pending' ? '⏳ PENDING' : chastityStatus === 'rejected' ? '✕ REJECTED' : 'NOT SUBMITTED'}
                                                </span>
                                            </div>
                                            {todayChastityPhoto && (
                                                <>
                                                    <a href={todayChastityPhoto} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(139,0,0,0.15)', marginBottom: chastityStatus === 'pending' ? 8 : 0 }}>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={todayChastityPhoto} alt="Chastity check" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                                                    </a>
                                                    {chastityStatus === 'pending' && (
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button disabled={vaultLoading} onClick={async () => {
                                                                setVaultLoading(true);
                                                                try {
                                                                    await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve_chastity', memberId: currId }) });
                                                                    // Refresh vault data
                                                                    const r = await fetch(`/api/vault/session?memberId=${encodeURIComponent(currId || '')}`);
                                                                    const d = await r.json();
                                                                    if (d.active) setVaultSession(d);
                                                                } catch (_) {} finally { setVaultLoading(false); }
                                                            }} style={{ flex: 1, padding: '8px', background: 'rgba(80,200,80,0.08)', border: '1px solid rgba(80,200,80,0.3)', borderRadius: 6, color: 'rgba(80,200,80,0.9)', fontFamily: "'Cinzel',serif", fontSize: '0.45rem', letterSpacing: 3, cursor: 'pointer', fontWeight: 700 }}>APPROVE</button>
                                                            <button disabled={vaultLoading} onClick={async () => {
                                                                setVaultLoading(true);
                                                                try {
                                                                    await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject_chastity', memberId: currId, reason: 'Rejected' }) });
                                                                    const r = await fetch(`/api/vault/session?memberId=${encodeURIComponent(currId || '')}`);
                                                                    const d = await r.json();
                                                                    if (d.active) setVaultSession(d);
                                                                } catch (_) {} finally { setVaultLoading(false); }
                                                            }} style={{ padding: '8px 14px', background: 'none', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 6, color: 'rgba(255,60,60,0.5)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.42rem', letterSpacing: 2, cursor: 'pointer' }}>REJECT</button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* ── SEAL BADGE ── */}
                                        {sealEarned && (
                                            <div style={{ textAlign: 'center', margin: '0 4px 12px', padding: '10px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8 }}>
                                                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.6rem', letterSpacing: 3, color: sealEarned === 'diamond' ? 'rgba(185,242,255,0.9)' : sealEarned === 'gold' ? 'rgba(197,160,89,0.9)' : sealEarned === 'silver' ? 'rgba(192,192,192,0.9)' : 'rgba(205,127,50,0.9)' }}>
                                                    {sealEarned === 'diamond' ? '◆' : sealEarned === 'gold' ? '★' : sealEarned === 'silver' ? '☆' : '●'} {sealEarned.toUpperCase()} SEAL
                                                </span>
                                            </div>
                                        )}

                                        {/* ── STATS GRID ── */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, margin: '0 4px 12px' }}>
                                            {[
                                                { label: 'STREAK', value: streak, color: streak > 0 ? 'rgba(80,200,80,0.7)' : 'rgba(255,255,255,0.4)' },
                                                { label: 'BEST', value: bestStreak, color: 'rgba(197,160,89,0.7)' },
                                                { label: 'PERFECT', value: perfectDays, color: 'rgba(80,200,80,0.5)' },
                                                { label: 'FAILED', value: failedDays, color: failedDays > 0 ? 'rgba(255,60,60,0.7)' : 'rgba(255,255,255,0.25)' },
                                                { label: 'DAY', value: `${daysIn + 1}/${lockDays}`, color: 'rgba(255,255,255,0.5)' },
                                                { label: 'PENALTY', value: penaltyHrs > 0 ? `+${penaltyHrs}h` : '0', color: penaltyHrs > 0 ? 'rgba(255,60,60,0.6)' : 'rgba(255,255,255,0.25)' },
                                            ].map((st, i) => (
                                                <div key={i} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(139,0,0,0.03)', border: '1px solid rgba(139,0,0,0.08)', borderRadius: 6 }}>
                                                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '1rem', fontWeight: 700, color: st.color }}>{st.value}</div>
                                                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.4rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>{st.label}</div>
                                                </div>
                                            ))}
                                        </div>


                                        {/* ── DAILY HISTORY (last 7) ── */}
                                        {dailyRecords.length > 0 && (
                                            <div style={{ margin: '0 4px 12px' }}>
                                                <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.45rem', color: 'rgba(180,40,40,0.5)', letterSpacing: 3, marginBottom: 8 }}>DAILY LOG</div>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {dailyRecords.slice(-14).map((d: any, i: number) => (
                                                        <div key={i} title={`Day ${d.day_number}: ${d.perfect ? 'Perfect' : `${d.orders_completed || 0}/${d.orders_total || 0}`}`} style={{ width: 22, height: 22, borderRadius: 4, background: d.perfect ? 'rgba(80,200,80,0.15)' : 'rgba(139,0,0,0.08)', border: `1px solid ${d.perfect ? 'rgba(80,200,80,0.3)' : 'rgba(139,0,0,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Orbitron',sans-serif", fontSize: '0.35rem', color: d.perfect ? 'rgba(80,200,80,0.7)' : 'rgba(255,255,255,0.2)' }}>
                                                            {d.day_number}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}


                                        {/* ── ALL TASK SUBMISSIONS LOG ── */}
                                        {(() => {
                                            const all: any[] = vs?.allSubmissions || [];
                                            if (all.length === 0) return null;
                                            const pendingAll = all.filter((s: any) => s.status === 'pending');
                                            return (
                                                <div style={{ margin: '0 4px 12px' }}>
                                                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.45rem', color: 'rgba(180,40,40,0.5)', letterSpacing: 3, marginBottom: 8 }}>
                                                        SUBMISSION LOG ({all.length}) {pendingAll.length > 0 && <span style={{ color: 'rgba(197,160,89,0.8)' }}>— {pendingAll.length} PENDING</span>}
                                                    </div>
                                                    <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {all.slice().reverse().slice(0, 20).map((sub: any) => {
                                                            const isOpen = expandedSubs.has(sub.id);
                                                            return (
                                                            <div key={sub.id}>
                                                                <div onClick={() => {
                                                                    setExpandedSubs(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(sub.id)) next.delete(sub.id);
                                                                        else next.add(sub.id);
                                                                        return next;
                                                                    });
                                                                }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: sub.status === 'approved' ? 'rgba(80,200,80,0.03)' : sub.status === 'pending' ? 'rgba(197,160,89,0.04)' : 'rgba(255,60,60,0.03)', border: `1px solid ${sub.status === 'approved' ? 'rgba(80,200,80,0.1)' : sub.status === 'pending' ? 'rgba(197,160,89,0.15)' : 'rgba(255,60,60,0.1)'}`, borderRadius: 6, cursor: 'pointer' }}>
                                                                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.33rem', color: sub.status === 'approved' ? 'rgba(80,200,80,0.6)' : sub.status === 'pending' ? 'rgba(197,160,89,0.7)' : 'rgba(255,60,60,0.5)', letterSpacing: 1, width: 50 }}>{sub.status === 'approved' ? '✓ OK' : sub.status === 'pending' ? '⏳' : '✕ REJ'}</span>
                                                                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', width: 55 }}>{sub.date}</span>
                                                                    <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.4)', flex: 1 }}>{sub.label || sub.order_type}</span>
                                                                    {sub.photo_url && <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.2)' }}>📷</span>}
                                                                    {sub.video_url && <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.2)' }}>🎥</span>}
                                                                    {sub.queen_comment && <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.38rem', color: 'rgba(197,160,89,0.4)', fontStyle: 'italic', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{sub.queen_comment}&rdquo;</span>}
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M7 10l5 5 5-5z"/></svg>
                                                                </div>
                                                                {isOpen && (
                                                                    <div style={{ padding: '10px 12px', marginTop: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
                                                                        {sub.photo_url && (
                                                                            <a href={sub.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.15)', marginBottom: 8 }}>
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                <img src={sub.photo_url} alt="Submission" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                                                                            </a>
                                                                        )}
                                                                        {sub.video_url && <video src={sub.video_url} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid rgba(197,160,89,0.15)', background: '#000', marginBottom: 8 }} />}
                                                                        {sub.text && (
                                                                            <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 8, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{sub.text}</div>
                                                                        )}
                                                                        {sub.queen_comment && (
                                                                            <div style={{ padding: '6px 10px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 6, fontFamily: "'Rajdhani',sans-serif", fontSize: '0.45rem', color: 'rgba(197,160,89,0.5)', fontStyle: 'italic' }}>&ldquo;{sub.queen_comment}&rdquo;</div>
                                                                        )}
                                                                        {!sub.photo_url && !sub.video_url && !sub.text && (
                                                                            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No media attached</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* ── BEGS ── */}
                                        {begs.length > 0 && (
                                            <div style={{ margin: '0 4px 12px' }}>
                                                <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.45rem', color: 'rgba(180,40,40,0.5)', letterSpacing: 3, marginBottom: 8 }}>BEGS ({begs.length})</div>
                                                <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {begs.slice(-5).map((b: any, i: number) => (
                                                        <div key={i} style={{ padding: '6px 10px', background: 'rgba(139,0,0,0.04)', border: '1px solid rgba(139,0,0,0.08)', borderRadius: 6, fontFamily: "'Rajdhani',sans-serif", fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                                                            &ldquo;{b.message}&rdquo;
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── VIDEO PROOF ── */}
                                        {s?.video_proof_url && (
                                            <div style={{ margin: '0 4px 12px' }}>
                                                <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.45rem', color: 'rgba(180,40,40,0.5)', letterSpacing: 3, marginBottom: 8 }}>VIDEO PROOF {s.video_reviewed && <span style={{ color: 'rgba(100,180,100,0.6)' }}>- REVIEWED</span>}</div>
                                                <video src={s.video_proof_url} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid rgba(139,0,0,0.15)', background: '#000' }} />
                                            </div>
                                        )}

                                        {/* ── RELEASE CONTROLS ── */}
                                        <div style={{ margin: '0 4px 12px', padding: '12px', background: 'rgba(139,0,0,0.04)', border: '1px solid rgba(139,0,0,0.15)', borderRadius: 8 }}>
                                            <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.45rem', color: 'rgba(180,40,40,0.5)', letterSpacing: 3, marginBottom: 10 }}>RELEASE</div>
                                            <textarea id="vaultReleaseReasonTop" placeholder="Reason for release (shown to user)..." style={{ width: '100%', minHeight: 50, padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,0,0,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.5rem', resize: 'vertical', marginBottom: 8 }} />
                                            <button disabled={vaultLoading} onClick={async () => {
                                                const reasonEl = document.getElementById('vaultReleaseReasonTop') as HTMLTextAreaElement;
                                                const reason = reasonEl?.value?.trim() || '';
                                                if (!confirm('Release this lock immediately?')) return;
                                                setVaultLoading(true);
                                                try {
                                                    await fetch('/api/vault/apply/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', sessionId: vaultRequest.sessionId, reason }) });
                                                    setVaultRequest(null);
                                                    setVaultSession(null);
                                                } catch (_) {} finally { setVaultLoading(false); }
                                            }} style={{ width: '100%', padding: '10px', background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: 6, color: 'rgba(255,60,60,0.7)', fontFamily: "'Cinzel',serif", fontSize: '0.5rem', letterSpacing: 3, cursor: vaultLoading ? 'default' : 'pointer', fontWeight: 700, opacity: vaultLoading ? 0.5 : 1 }}>IMMEDIATE RELEASE</button>
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* ── DIRECTIVE (collapsible) — hidden when vault locked ── */}
                                <div className="dp-section" style={vaultRequest?.status === 'active' ? { display: 'none' } : {}}>
                                    <div className="dp-directive-header" onClick={() => { const d = document.getElementById('taskDrawer'); if (d) d.classList.toggle('open'); }}>
                                        <div className="dp-divider-label">
                                            <span className="dp-divider-text" style={{ fontFamily: "'Cinzel', serif" }}>DIRECTIVES</span>
                                            <span id="statusDot" className="status-dot unproductive"></span>
                                        </div>
                                        <div id="dActiveStatus" className="dp-directive-status">IDLE</div>
                                    </div>
                                    <div id="taskDrawer" className="task-drawer">
                                        <div id="activeTaskContent" className="dp-task-card">
                                            <div id="dActiveText" className="dp-task-text">None</div>
                                            <div className="dp-task-footer">
                                                <div id="dActiveTimer" className="dp-timer">--:--</div>
                                                <button className="dp-cancel-btn" onClick={() => (window as any).adminTaskAction((window as any).currId, 'skip')}>SKIP</button>
                                            </div>
                                        </div>
                                        <div id="idleActions" style={{ display: 'none' }}></div>
                                        <div id="qListContainer" className="dp-queue-list"></div>
                                    </div>
                                </div>

                                {/* ── PENDING REVIEW — regular queue (hidden by vanilla JS when vault active) ── */}
                                <div id="userQueueSec" className="dp-section" style={{ display: 'none' }}></div>

                                {/* ── VAULT PENDING REVIEW — same card-stack look, replaces regular queue ── */}
                                {vaultRequest?.status === 'active' && vaultSession && (() => {
                                    const subs: any[] = vaultSession?.submissions || [];
                                    const pending = subs.filter((s: any) => s.status === 'pending');
                                    if (pending.length === 0) return null;
                                    const count = pending.length;
                                    return (
                                        <div className="dp-section">
                                            <div className="dp-divider-label" style={{ marginBottom: 16 }}>
                                                <span className="dp-divider-text" style={{ fontFamily: "'Cinzel',serif" }}>PENDING REVIEW</span>
                                                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.4rem', color: 'rgba(197,160,89,0.5)', fontWeight: 700, letterSpacing: 2 }}>{count}</span>
                                            </div>
                                            <div className="cs-stage">
                                                {pending.map((sub: any, i: number) => {
                                                    const isVideo = !!sub.video_url;
                                                    const hasPreview = !!(sub.photo_url || sub.video_url);
                                                    const mid2 = (count - 1) / 2;
                                                    const off = i - mid2;
                                                    const absOff = Math.abs(off);
                                                    const zIdx = 10 - Math.round(absOff);
                                                    const dateStr = sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                    return (
                                                        <div key={sub.id} className="cs-card" style={{ '--off': off, '--abs': absOff, zIndex: zIdx, cursor: 'pointer' } as any}
                                                            onClick={() => {
                                                                const el = document.getElementById(`vaultSubExpand-${sub.id}`);
                                                                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                                                            }}>
                                                            <div className="cs-card-bg" style={hasPreview ? { display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } : {}}>
                                                                {sub.photo_url ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={sub.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : sub.video_url ? (
                                                                    <>
                                                                        <video src={sub.video_url} preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}><path d="M8 5v14l11-7z" /></svg>
                                                                        </div>
                                                                    </>
                                                                ) : sub.text ? (
                                                                    <div style={{ padding: 10, fontFamily: "'Rajdhani',sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '100%' }}>{sub.text.slice(0, 120)}</div>
                                                                ) : (
                                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(197,160,89,0.35)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                                                                )}
                                                            </div>
                                                            <div className="cs-card-overlay">
                                                                <div className="cs-card-type" style={{ color: '#c5a059' }}>{(sub.label || sub.order_type || 'TASK').toUpperCase()}</div>
                                                                <div className="cs-card-date">{dateStr}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Expanded view for approve/reject — shown when card is tapped */}
                                            {pending.map((sub: any) => (
                                                <div key={`exp-${sub.id}`} id={`vaultSubExpand-${sub.id}`} style={{ display: 'none', marginTop: 12, padding: 12, background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>{sub.label || sub.order_type}</span>
                                                        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.38rem', color: 'rgba(197,160,89,0.6)' }}>
                                                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    {sub.photo_url && (
                                                        <a href={sub.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.15)', marginBottom: 8 }}>
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={sub.photo_url} alt="Proof" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                                                        </a>
                                                    )}
                                                    {sub.video_url && <video src={sub.video_url} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid rgba(197,160,89,0.15)', background: '#000', marginBottom: 8 }} />}
                                                    {sub.text && (
                                                        <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 8, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{sub.text}</div>
                                                    )}
                                                    <textarea id={`pendingSubComment-${sub.id}`} placeholder="Comment (optional)..." style={{ width: '100%', minHeight: 36, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.45rem', resize: 'vertical', outline: 'none', marginBottom: 6 }} />
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button disabled={vaultLoading} onClick={async () => {
                                                            setVaultLoading(true);
                                                            const cEl = document.getElementById(`pendingSubComment-${sub.id}`) as HTMLTextAreaElement;
                                                            const comment = cEl?.value?.trim() || '';
                                                            try {
                                                                await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve_task', memberId: currId, submissionId: sub.id, date: sub.date, comment }) });
                                                                const r = await fetch(`/api/vault/session?memberId=${encodeURIComponent(currId || '')}`);
                                                                const d = await r.json();
                                                                if (d.active) setVaultSession(d);
                                                            } catch (_) {} finally { setVaultLoading(false); }
                                                        }} style={{ flex: 1, padding: '8px', background: 'rgba(80,200,80,0.08)', border: '1px solid rgba(80,200,80,0.3)', borderRadius: 6, color: 'rgba(80,200,80,0.9)', fontFamily: "'Cinzel',serif", fontSize: '0.42rem', letterSpacing: 3, cursor: 'pointer', fontWeight: 700 }}>APPROVE</button>
                                                        <button disabled={vaultLoading} onClick={async () => {
                                                            setVaultLoading(true);
                                                            const cEl = document.getElementById(`pendingSubComment-${sub.id}`) as HTMLTextAreaElement;
                                                            const comment = cEl?.value?.trim() || '';
                                                            try {
                                                                await fetch('/api/vault/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject_task', memberId: currId, submissionId: sub.id, date: sub.date, comment }) });
                                                                const r = await fetch(`/api/vault/session?memberId=${encodeURIComponent(currId || '')}`);
                                                                const d = await r.json();
                                                                if (d.active) setVaultSession(d);
                                                            } catch (_) {} finally { setVaultLoading(false); }
                                                        }} style={{ padding: '8px 14px', background: 'none', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 6, color: 'rgba(255,60,60,0.5)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.42rem', letterSpacing: 2, cursor: 'pointer' }}>REJECT</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* kneeling is in the header now */}
                                <div id="admin_KneelSection" style={{ display: 'none' }}></div>

                                {/* ── PROMOTION — hidden when vault locked ── */}
                                <div id="progress_section" className="dp-section" style={vaultRequest?.status === 'active' ? { display: 'none' } : {}}>
                                    <div className="dp-divider-label">
                                        <span className="dp-divider-text">PROMOTION</span>
                                        <span id="admin_NextRank" className="dp-promo-target">—</span>
                                    </div>
                                    <div id="admin_ProgressContainer" className="dp-promo-bars"></div>
                                </div>

                                {/* ── INVENTORY — hidden when vault locked ── */}
                                <div className="dp-section" style={vaultRequest?.status === 'active' ? { display: 'none' } : {}}>
                                    <div className="dp-divider-label">
                                        <span className="dp-divider-text">INVENTORY</span>
                                    </div>
                                    <div className="dp-inv-grid">
                                        <div className="dp-inv-card">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 5H2"/><path d="M13 9H2"/><path d="M13 13H6"/><path d="M17 17l4-4-4-4"/><path d="M21 13H8"/></svg>
                                            <div className="dp-inv-name">SKIP PASS</div>
                                            <div className="dp-inv-count" id="dpInvSkip">0</div>
                                        </div>
                                        <div className="dp-inv-card">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                            <div className="dp-inv-name">CUM PASS</div>
                                            <div className="dp-inv-count" id="dpInvCum">0</div>
                                        </div>
                                        <div className="dp-inv-card">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                            <div className="dp-inv-name">CHECKPOINT</div>
                                            <div className="dp-inv-count" id="dpInvCheck">0</div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── TELEMETRY + KINKS — hidden when vault locked ── */}
                                <div className="dp-section dp-section-split" style={vaultRequest?.status === 'active' ? { display: 'none' } : {}}>
                                    <div id="telemetry_section" className="dp-split-half" onClick={() => { const c = document.getElementById('admin_TelemetryContainer'); const a = document.getElementById('telemetry_arrow'); if (c) { const open = c.style.display !== 'none'; c.style.display = open ? 'none' : 'grid'; if (a) a.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)'; } }}>
                                        <div className="dp-split-trigger">
                                            <span className="dp-section-title">INTEL</span>
                                            <span id="telemetry_arrow" className="dp-split-arrow">&#9662;</span>
                                        </div>
                                        <div id="admin_TelemetryContainer" className="dp-split-content" style={{ display: 'none' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: 'rgba(255,255,255,0.15)', fontSize: '0.5rem', textAlign: 'center', gridColumn: 'span 2' }}>No data</div>
                                        </div>
                                    </div>
                                    <div className="dp-split-half" onClick={() => { const c = document.getElementById('admin_KinksLimits'); if (c) { const open = c.style.display !== 'none'; c.style.display = open ? 'none' : 'block'; } }}>
                                        <div className="dp-split-trigger">
                                            <span className="dp-section-title">KINKS</span>
                                            <span className="dp-split-arrow">&#9662;</span>
                                        </div>
                                        <div id="admin_KinksLimits" className="dp-split-content" style={{ display: 'none' }} onClick={(e) => e.stopPropagation()}></div>
                                    </div>
                                </div>

                                {/* ── FOOTER ── */}
                                <div className="dp-footer">
                                    <div style={{ opacity: 0.25 }}>
                                        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.4rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px' }}>REG </span>
                                        <span id="dMirrorSlaveSince" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.4rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>—</span>
                                    </div>

                                    {role === 'queen' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', background: queenOnlyChat ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${queenOnlyChat ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, color: queenOnlyChat ? 'rgba(168,85,247,0.9)' : 'rgba(255,255,255,0.35)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={async () => {
                                                const id = (window as any).currId;
                                                if (!id) return;
                                                const newVal = !queenOnlyChat;
                                                setQueenOnlyChat(newVal);
                                                await fetch('/api/chat/restrict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id, restricted: newVal }) });
                                                (window as any)._restrictChannel?.send({ type: 'broadcast', event: 'restrict', payload: { memberId: id, restricted: newVal } });
                                                (window as any)._refreshDashboard?.();
                                            }}>
                                                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                                                {queenOnlyChat ? 'QUEEN ONLY' : 'RESTRICT'}
                                            </button>

                                            {(activeLocks.paywall || activeLocks.silenced) ? (
                                                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', background: 'rgba(80,80,80,0.12)', border: '1px solid rgba(150,150,150,0.25)', borderRadius: 6, color: '#888', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', letterSpacing: '2px', cursor: 'pointer' }} onClick={async () => {
                                                    const id = (window as any).currId;
                                                    if (!id) return;
                                                    if (activeLocks.paywall) await fetch('/api/paywall/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id }) });
                                                    if (activeLocks.silenced) await fetch('/api/silence/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id }) });
                                                    setActiveLocks({ paywall: false, silenced: false });
                                                }}>
                                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/></svg>
                                                    UNLOCK
                                                </button>
                                            ) : (
                                                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 6, color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', letterSpacing: '2px', cursor: 'pointer' }} onClick={() => { const id = (window as any).currId; if (id) setLockTarget(id); }}>
                                                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                                                    LOCK
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ── VAULT LOCK REQUEST — BIG PANEL ── */}
                                {vaultRequest && vaultRequest.status === 'pending' && (
                                    <div style={{ background: 'linear-gradient(170deg, rgba(255,180,50,0.06) 0%, rgba(10,8,4,0.95) 100%)', border: '1px solid rgba(255,180,50,0.3)', borderRadius: 14, margin: '0 8px 12px', padding: '20px 18px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
                                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.7rem', color: 'rgba(255,180,50,0.9)', letterSpacing: 4, fontWeight: 700, marginBottom: 4 }}>LOCK REQUEST</div>
                                        <div style={{ width: 40, height: 1, background: 'rgba(255,180,50,0.25)', margin: '10px auto 14px' }}></div>

                                        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.4rem', color: '#fff', fontWeight: 700, marginBottom: 4 }}>{vaultRequest.lockDays || '?'} DAYS</div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                                            {vaultRequest.coinsPaid ? `${Number(vaultRequest.coinsPaid).toLocaleString()} coins paid` : 'Keyholder purchase'}
                                        </div>

                                        {vaultRequest.requestedStart && (
                                            <div style={{ background: 'rgba(255,180,50,0.08)', border: '1px solid rgba(255,180,50,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: 'rgba(255,180,50,0.5)', letterSpacing: 2, marginBottom: 4 }}>REQUESTED START</div>
                                                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', color: 'rgba(255,180,50,0.9)', fontWeight: 700 }}>
                                                    {new Date(vaultRequest.requestedStart).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                                            <button disabled={vaultLoading} onClick={async () => {
                                                setVaultLoading(true);
                                                try {
                                                    await fetch('/api/vault/apply/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', sessionId: vaultRequest.sessionId }) });
                                                    setVaultRequest({ ...vaultRequest, status: 'active' });
                                                } catch (_) {} finally { setVaultLoading(false); }
                                            }} style={{ width: '100%', padding: '12px', background: 'rgba(80,200,80,0.1)', border: '1px solid rgba(80,200,80,0.35)', borderRadius: 8, color: 'rgba(80,200,80,0.9)', fontFamily: "'Cinzel', serif", fontSize: '0.5rem', letterSpacing: 3, cursor: 'pointer', fontWeight: 700 }}>ACTIVATE LOCK NOW</button>

                                            <button disabled={vaultLoading} onClick={async () => {
                                                const when = prompt('Schedule start (YYYY-MM-DD HH:MM):');
                                                if (!when) return;
                                                setVaultLoading(true);
                                                try {
                                                    await fetch('/api/vault/apply/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schedule', sessionId: vaultRequest.sessionId, scheduledStart: new Date(when).toISOString() }) });
                                                    setVaultRequest({ ...vaultRequest, status: 'scheduled' });
                                                } catch (_) {} finally { setVaultLoading(false); }
                                            }} style={{ width: '100%', padding: '12px', background: 'rgba(100,180,255,0.06)', border: '1px solid rgba(100,180,255,0.25)', borderRadius: 8, color: 'rgba(100,180,255,0.7)', fontFamily: "'Cinzel', serif", fontSize: '0.5rem', letterSpacing: 2, cursor: 'pointer' }}>SCHEDULE DIFFERENT TIME</button>

                                            <button disabled={vaultLoading} onClick={async () => {
                                                setVaultLoading(true);
                                                try {
                                                    await fetch('/api/vault/apply/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deny', sessionId: vaultRequest.sessionId }) });
                                                    setVaultRequest(null);
                                                } catch (_) {} finally { setVaultLoading(false); }
                                            }} style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: 'rgba(255,60,60,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', letterSpacing: 2, cursor: 'pointer' }}>DENY & REFUND</button>
                                        </div>
                                    </div>
                                )}
                                {vaultRequest && (vaultRequest.status === 'scheduled' || vaultRequest.status === 'awaiting_video') && (
                                    <div style={{ background: 'rgba(139,0,0,0.04)', border: '1px solid rgba(139,0,0,0.2)', borderRadius: 10, margin: '0 8px 12px', padding: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <span style={{ fontSize: '1.2rem' }}>{vaultRequest.status === 'awaiting_video' ? '🔏' : '📅'}</span>
                                            <div>
                                                <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.5rem', color: 'rgba(180,40,40,0.8)', letterSpacing: 2, fontWeight: 700 }}>
                                                    {vaultRequest.status === 'awaiting_video' ? 'AWAITING VIDEO' : 'SCHEDULED'}
                                                </div>
                                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>{vaultRequest.lockDays}d sentence</div>
                                            </div>
                                        </div>
                                        <textarea id="vaultReleaseReason" placeholder="Reason for release (shown to user)..." style={{ width: '100%', minHeight: 60, padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,0,0,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.7)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', resize: 'vertical', marginBottom: 8 }} />
                                        <button disabled={vaultLoading} onClick={async () => {
                                            const reasonEl = document.getElementById('vaultReleaseReason') as HTMLTextAreaElement;
                                            const reason = reasonEl?.value?.trim() || '';
                                            if (!confirm('Release this lock immediately?')) return;
                                            setVaultLoading(true);
                                            try {
                                                await fetch('/api/vault/apply/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'release', sessionId: vaultRequest.sessionId, reason }) });
                                                setVaultRequest(null);
                                                setVaultSession(null);
                                            } catch (_) {} finally { setVaultLoading(false); }
                                        }} style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: 'rgba(255,60,60,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', letterSpacing: 2, cursor: 'pointer' }}>IMMEDIATE RELEASE</button>
                                    </div>
                                )}

                                {/* ── ADMIN TOOLS ── */}
                                <div className="dp-section" style={{ borderTop: '1px solid rgba(197,160,89,0.06)', paddingTop: 16 }}>
                                    <button onClick={() => (window as any).backfillThumbnails?.()} style={{ width: '100%', padding: '10px', background: 'rgba(197,160,89,0.07)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: 'rgba(197,160,89,0.6)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', letterSpacing: '2px', cursor: 'pointer' }}>GENERATE MISSING THUMBNAILS</button>
                                </div>

                                </div>{/* close sections */}
                                </div>{/* close chatterProfilePanel */}
                            </div>
                        </div>
                </div>


            </div>

            {/* ── GLOBAL OVERLAY — exact copy from /profile ── */}
            <div id="mobGlobalOverlay" className="mob-overlay" style={{ display: 'none', flexDirection: 'column' }}>
                <div className="mob-overlay-header">
                    <span className="mob-overlay-title">{'\u25CE'} GLOBAL</span>
                    <button className="mob-overlay-close" onClick={() => (window as any).closeMobGlobal()}>&#10005;</button>
                </div>

                {/* Tab bar */}
                <div className="mob-gl-tabs">
                    <button id="mobGlTab_rank" className="mob-gl-tab active" onClick={() => (window as any).switchMobGlTab('rank')}>RANK</button>
                    <button id="mobGlTab_talk" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('talk')}>TALK</button>
                    <button id="mobGlTab_challenges" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('challenges')}>NEWS</button>
                    <button id="mobGlTab_updates" className="mob-gl-tab" onClick={() => (window as any).switchMobGlTab('updates')}>LIVE</button>
                </div>

                {/* RANK panel */}
                <div id="mobGlPanel_rank" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="mob-gl-period-bar">
                        <button id="mobGlPeriod_today" className="mob-gl-period-btn active" onClick={() => (window as any).switchMobGlPeriod('today')}>TODAY</button>
                        <button id="mobGlPeriod_weekly" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('weekly')}>WEEK</button>
                        <button id="mobGlPeriod_monthly" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('monthly')}>MONTH</button>
                        <button id="mobGlPeriod_alltime" className="mob-gl-period-btn" onClick={() => (window as any).switchMobGlPeriod('alltime')}>ALL</button>
                    </div>
                    <div id="mobGlRankList" className="mob-gl-scroll"></div>
                </div>

                {/* TALK panel */}
                <div id="mobGlPanel_talk" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlTalkFeed" className="mob-gl-scroll" style={{ flex: 1 }}></div>
                    <div className="mob-gl-talk-footer">
                        <div className="chat-input-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                            <button className="chat-btn-plus" onClick={() => (window as any).handleGlobalMediaPlus?.()} style={{ position: 'absolute', left: 8, zIndex: 2, background: 'none', border: 'none', color: 'rgba(197,160,89,0.6)', fontSize: '1.3rem', cursor: 'pointer', padding: '0 4px' }}>+</button>
                            <input
                                type="text"
                                id="mobGlTalkInput"
                                className="mob-gl-talk-input"
                                placeholder="speak..."
                                style={{ paddingLeft: 36 }}
                                onKeyDown={(e) => (window as any).handleMobGlKey(e.nativeEvent)}
                            />
                        </div>
                        <button onClick={() => (window as any).openMobGlGifPicker?.()} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontFamily: 'Orbitron', fontSize: '0.38rem', fontWeight: 700, color: 'rgba(197,160,89,0.6)', letterSpacing: '1px', flexShrink: 0 }}>GIF</button>
                        <button onClick={() => (window as any).toggleTributeHunt?.()} style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', padding: '0 10px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#c5a059' }}>
                                <rect x="3" y="8" width="18" height="12" rx="1"></rect>
                                <path d="M12 8v12"></path>
                                <path d="M19 8c-1.5-1.5-3-2-4.5-2C13 6 12 8 12 8s-1-2-2.5-2C8 6 6.5 6.5 5 8"></path>
                            </svg>
                        </button>
                        <button className="mob-gl-talk-send" onClick={() => (window as any).sendMobGlMessage()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#c5a059" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* CHALLENGES panel */}
                <div id="mobGlPanel_challenges" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlChallengesFeed" className="mob-gl-scroll"></div>
                </div>

                {/* UPDATES panel */}
                <div id="mobGlPanel_updates" className="mob-gl-panel" style={{ flexDirection: 'column', flex: 1, overflow: 'hidden', display: 'none' }}>
                    <div id="mobGlUpdatesFeed" className="mob-gl-scroll"></div>
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
                    <span className="mob-nav-icon">{'\u266B'}</span>
                    <span className="mob-nav-label">QUEEN</span>
                </button>
                <button className="mob-nav-btn" id="mobNavGlobal" onClick={() => { (window as any).openMobGlobal?.(); setShowChallenges(false); setShowVideoChallenges(false); }}>
                    <span className="mob-nav-icon">{'\u25CE'}</span>
                    <span className="mob-nav-label">GLOBAL</span>
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
            <div id="feedSectionOverlay" style={{ display: 'none', position: 'fixed', top: 0, right: 0, bottom: 0, left: 320, background: 'rgba(6,6,16,0.97)', zIndex: 1000, flexDirection: 'column', backdropFilter: 'blur(10px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid rgba(197,160,89,0.2)', flexShrink: 0 }}>
                    <div id="feedSectionOverlayTitle" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: '#c5a059', letterSpacing: '4px' }}>WISHLIST</div>
                    <button onClick={() => (window as any).collapseFeedSection()} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
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

            {/* CHATTERS MANAGEMENT MODAL */}
            {showChattersModal && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 320, zIndex: 99999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid rgba(100,200,255,0.2)', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: 'rgba(100,200,255,0.8)', letterSpacing: '4px' }}>CHATTER MANAGEMENT</div>
                        <button onClick={() => setShowChattersModal(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', maxWidth: 600, margin: '0 auto', width: '100%' }}>
                        <ChattersPanel />
                    </div>
                </div>
            )}

            {/* LOCKS LIST MODAL */}
            {showLocksModal && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 320, zIndex: 99999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid rgba(220,60,60,0.2)', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: 'rgba(220,60,60,0.8)', letterSpacing: '4px' }}>LOCKED USERS</div>
                        <button onClick={() => setShowLocksModal(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', padding: '6px 14px', cursor: 'pointer', borderRadius: '4px', letterSpacing: '1px' }}>✕ CLOSE</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                        {lockedUsers.length === 0 ? (
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 60, fontSize: '0.9rem' }}>No locked users</div>
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
                                                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.95rem', color: '#fff' }}>{u.name || u.memberId}</span>
                                                    {isSilenced && <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(220,60,60,0.8)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '1px' }}>SILENCED</span>}
                                                    {isPaywalled && !isSilenced && <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(197,160,89,0.8)', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 4, padding: '2px 6px', letterSpacing: '1px' }}>PAYWALLED</span>}
                                                </div>
                                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                                                    {isSilenced ? (u.parameters?.silence_reason || '-') : (u.parameters?.paywall?.reason || '-')}
                                                </div>
                                                {isPaywalled && !isSilenced && u.parameters?.paywall?.amount > 0 && (
                                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', color: 'rgba(197,160,89,0.7)', marginTop: 4 }}>€{Number(u.parameters.paywall.amount).toFixed(2)}</div>
                                                )}
                                            </div>
                                            <button onClick={() => { (window as any).selUser?.(u.memberId); setShowLocksModal(false); }} style={{ background: 'none', border: `1px solid ${border}`, color: accent, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', letterSpacing: '1px', flexShrink: 0 }}>VIEW</button>
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

