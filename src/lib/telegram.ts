// src/lib/telegram.ts
// Telegram Bot utility — send messages, answer callbacks

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const QUEEN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function tgSend(
    text: string,
    options?: {
        chatId?: string | number;
        parseMode?: 'HTML' | 'MarkdownV2';
        replyMarkup?: object;
    }
): Promise<any> {
    if (!BOT_TOKEN || !QUEEN_CHAT_ID) return null;
    const chatId = options?.chatId ?? QUEEN_CHAT_ID;
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: options?.parseMode ?? 'HTML',
                reply_markup: options?.replyMarkup,
                disable_web_page_preview: true,
            }),
        });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function tgAnswer(callbackQueryId: string, text?: string): Promise<void> {
    if (!BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    }).catch(() => {});
}
