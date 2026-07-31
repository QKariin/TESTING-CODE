"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    cover_image: string | null;
    tags: string[];
    meta_description: string | null;
    meta_keywords: string | null;
    status: string;
    published_at: string | null;
    created_at: string;
}

const S = {
    label: { fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', letterSpacing: 3, color: 'rgba(197,160,89,0.7)', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' as const },
    input: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const },
    btn: { padding: '10px 24px', borderRadius: 8, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', fontWeight: 700, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase' as const, border: 'none' },
    goldBtn: { background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.4)', color: '#c5a059' },
    dimBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' },
    dangerBtn: { background: 'rgba(220,40,40,0.1)', border: '1px solid rgba(220,40,40,0.3)', color: '#e04040' },
    publishBtn: { background: 'rgba(40,180,80,0.15)', border: '1px solid rgba(40,180,80,0.4)', color: '#40cc60' },
    field: { marginBottom: 20 },
    required: { color: '#e04040', marginLeft: 4 },
};

// ── Toolbar button style ──
const tbBtn = (active?: boolean): React.CSSProperties => ({
    background: active ? 'rgba(197,160,89,0.2)' : 'transparent',
    border: active ? '1px solid rgba(197,160,89,0.4)' : '1px solid transparent',
    color: active ? '#c5a059' : 'rgba(255,255,255,0.5)',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
    fontFamily: "'Rajdhani', sans-serif",
    lineHeight: 1,
    minWidth: 28,
    textAlign: 'center' as const,
});

const tbSep: React.CSSProperties = {
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.08)',
    margin: '0 4px',
    flexShrink: 0,
};

// ── Auto-generate helpers ──
function stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function autoExcerpt(html: string): string {
    const text = stripHtml(html).trim();
    if (!text) return '';
    // First 200 chars, break at word
    if (text.length <= 200) return text;
    return text.slice(0, 200).replace(/\s+\S*$/, '') + '...';
}

function autoMetaDescription(html: string): string {
    const text = stripHtml(html).trim();
    if (!text) return '';
    if (text.length <= 155) return text;
    return text.slice(0, 155).replace(/\s+\S*$/, '') + '...';
}

function autoKeywords(title: string, html: string): string {
    const text = (title + ' ' + stripHtml(html)).toLowerCase();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'not', 'no', 'so', 'if', 'as', 'from', 'up', 'out', 'about', 'into', 'just', 'also', 'than', 'when', 'what', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'very']);
    const words = text.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([w]) => w)
        .join(', ');
}

function autoTags(title: string, html: string): string {
    const text = (title + ' ' + stripHtml(html)).toLowerCase();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'not', 'no', 'so', 'if', 'as', 'from', 'up', 'out', 'about', 'into', 'just', 'also', 'than', 'when', 'what', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'very']);
    const words = text.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w)
        .join(', ');
}

// ── Upload helper ──
async function uploadFile(file: File, folder: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    try {
        // Get signed upload URL
        const res = await fetch('/api/upload/signed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket: 'media', path }),
        });
        const { signedUrl, token, publicUrl, error } = await res.json();
        if (error || !signedUrl) { console.error('Upload signed URL error:', error); return null; }

        // Upload the file using the signed URL
        const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        });
        if (!uploadRes.ok) { console.error('Upload failed:', uploadRes.statusText); return null; }

        return publicUrl;
    } catch (e) {
        console.error('Upload error:', e);
        return null;
    }
}

export default function BlogEditor({ onClose }: { onClose: () => void }) {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<BlogPost | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showSeo, setShowSeo] = useState(false);

    // Form fields
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [tags, setTags] = useState('');
    const [metaDesc, setMetaDesc] = useState('');
    const [metaKeywords, setMetaKeywords] = useState('');

    // Rich editor ref
    const editorRef = useRef<HTMLDivElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const inlineImgInputRef = useRef<HTMLInputElement>(null);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/blog');
            const d = await r.json();
            setPosts(d.posts || []);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchPosts(); }, []);

    const getEditorContent = (): string => {
        return editorRef.current?.innerHTML || '';
    };

    const openEditor = (post?: BlogPost) => {
        if (post) {
            setEditing(post);
            setIsNew(false);
            setTitle(post.title);
            setSlug(post.slug);
            setExcerpt(post.excerpt || '');
            setCoverImage(post.cover_image || '');
            setTags((post.tags || []).join(', '));
            setMetaDesc(post.meta_description || '');
            setMetaKeywords(post.meta_keywords || '');
            // Set content in editor after render
            setTimeout(() => {
                if (editorRef.current) editorRef.current.innerHTML = post.content || '';
            }, 0);
        } else {
            setEditing(null);
            setIsNew(true);
            setTitle(''); setSlug(''); setExcerpt('');
            setCoverImage(''); setTags(''); setMetaDesc(''); setMetaKeywords('');
            setTimeout(() => {
                if (editorRef.current) editorRef.current.innerHTML = '';
            }, 0);
        }
        setError('');
        setShowSeo(false);
    };

    const closeEditor = () => { setEditing(null); setIsNew(false); setError(''); };

    // ── Auto-fill SEO fields from content ──
    const autoFillSeo = useCallback(() => {
        const html = getEditorContent();
        if (!excerpt.trim()) setExcerpt(autoExcerpt(html));
        if (!metaDesc.trim()) setMetaDesc(autoMetaDescription(html));
        if (!metaKeywords.trim()) setMetaKeywords(autoKeywords(title, html));
        if (!tags.trim()) setTags(autoTags(title, html));
    }, [title, excerpt, metaDesc, metaKeywords, tags]);

    // ── Toolbar commands ──
    const exec = (command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
    };

    const handleLink = () => {
        const url = prompt('Enter URL:');
        if (url) exec('createLink', url);
    };

    // ── Cover image upload ──
    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const url = await uploadFile(file, 'blog-covers');
        if (url) setCoverImage(url);
        setUploading(false);
        if (coverInputRef.current) coverInputRef.current.value = '';
    };

    // ── Inline image upload ──
    const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const url = await uploadFile(file, 'blog-content');
        if (url) {
            editorRef.current?.focus();
            document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:16px 0;" />`);
        }
        setUploading(false);
        if (inlineImgInputRef.current) inlineImgInputRef.current.value = '';
    };

    const validate = (): string | null => {
        if (!title.trim()) return 'Title is required';
        const content = getEditorContent();
        if (!content.trim() || content === '<br>') return 'Content is required';
        if (!metaDesc.trim()) return 'Meta description is required for SEO';
        if (!metaKeywords.trim()) return 'Meta keywords are required for SEO';
        if (!excerpt.trim()) return 'Excerpt is required';
        if (!tags.trim()) return 'At least one tag is required';
        return null;
    };

    const save = async (publishStatus: 'draft' | 'published') => {
        // Auto-fill empty SEO fields before validation
        autoFillSeo();
        // Defer validation to next tick so state updates land
        await new Promise(r => setTimeout(r, 50));

        const err = validate();
        if (err) { setError(err); return; }

        setSaving(true);
        setError('');

        const content = getEditorContent();
        const tagArr = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const body = {
            title: title.trim(),
            slug: slug.trim() || undefined,
            excerpt: excerpt.trim(),
            content: content.trim(),
            cover_image: coverImage.trim() || null,
            tags: tagArr,
            meta_description: metaDesc.trim(),
            meta_keywords: metaKeywords.trim(),
            status: publishStatus,
        };

        try {
            const isEdit = editing && !isNew;
            const url = isEdit ? `/api/blog/${editing.slug}` : '/api/blog';
            const method = isEdit ? 'PUT' : 'POST';

            const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'Failed to save');

            closeEditor();
            fetchPosts();
        } catch (e: any) {
            setError(e.message);
        }
        setSaving(false);
    };

    const deletePost = async (postSlug: string) => {
        if (!confirm('Delete this post permanently?')) return;
        try {
            await fetch(`/api/blog/${postSlug}`, { method: 'DELETE' });
            fetchPosts();
        } catch {}
    };

    // ── Hidden file inputs ──
    const fileInputs = (
        <>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
            <input ref={inlineImgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInlineImage} />
        </>
    );

    // ══════════════════════════════════════════
    //  EDITOR VIEW
    // ══════════════════════════════════════════
    if (isNew || editing) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24 }}>
                {fileInputs}

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '1.1rem', color: '#c5a059', letterSpacing: 4, fontWeight: 700 }}>
                        {isNew ? 'NEW POST' : 'EDIT POST'}
                    </div>
                    <button onClick={closeEditor} style={{ ...S.btn, ...S.dimBtn }}>BACK</button>
                </div>

                {error && (
                    <div style={{ background: 'rgba(220,40,40,0.1)', border: '1px solid rgba(220,40,40,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#e04040', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.8rem', letterSpacing: 1 }}>
                        {error}
                    </div>
                )}

                {uploading && (
                    <div style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 8, padding: '8px 16px', marginBottom: 16, color: '#c5a059', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.75rem', letterSpacing: 1 }}>
                        UPLOADING IMAGE...
                    </div>
                )}

                {/* Title */}
                <div style={S.field}>
                    <label style={S.label}>Title<span style={S.required}>*</span></label>
                    <input style={{ ...S.input, fontSize: '1.1rem', fontWeight: 700 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title" />
                </div>

                {/* Slug */}
                <div style={{ ...S.field, marginBottom: 12 }}>
                    <label style={S.label}>Slug (auto-generated if empty)</label>
                    <input style={S.input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-post-title" />
                </div>

                {/* Cover image */}
                <div style={{ ...S.field, marginBottom: 16 }}>
                    <label style={S.label}>Cover Image</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button onClick={() => coverInputRef.current?.click()} style={{ ...S.btn, ...S.goldBtn, padding: '8px 16px', fontSize: '0.6rem' }}>
                            UPLOAD FROM PC
                        </button>
                        <input style={{ ...S.input, flex: 1 }} value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="Or paste image URL..." />
                        {coverImage && (
                            <button onClick={() => setCoverImage('')} style={{ ...S.btn, ...S.dangerBtn, padding: '8px 12px', fontSize: '0.55rem' }}>X</button>
                        )}
                    </div>
                    {coverImage && (
                        <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.12)', maxHeight: 140 }}>
                            <img src={coverImage} alt="Cover preview" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
                        </div>
                    )}
                </div>

                {/* ── Rich Text Toolbar ── */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 3,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(197,160,89,0.15)',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                    padding: '6px 10px',
                }}>
                    {/* Block type */}
                    <select
                        onChange={e => { exec('formatBlock', e.target.value); e.target.value = ''; }}
                        defaultValue=""
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(197,160,89,0.2)',
                            borderRadius: 4,
                            color: 'rgba(255,255,255,0.6)',
                            fontFamily: "'Rajdhani', sans-serif",
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="" disabled>Paragraph</option>
                        <option value="p">Paragraph</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="h4">Heading 4</option>
                        <option value="blockquote">Quote</option>
                        <option value="pre">Code Block</option>
                    </select>

                    <div style={tbSep} />

                    {/* Inline formatting */}
                    <button onClick={() => exec('bold')} style={tbBtn()} title="Bold"><b>B</b></button>
                    <button onClick={() => exec('italic')} style={tbBtn()} title="Italic"><i>I</i></button>
                    <button onClick={() => exec('underline')} style={tbBtn()} title="Underline"><u>U</u></button>
                    <button onClick={() => exec('strikeThrough')} style={tbBtn()} title="Strikethrough"><s>S</s></button>

                    <div style={tbSep} />

                    {/* Text color */}
                    <label title="Text color" style={{ ...tbBtn(), position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>A</span>
                        <input
                            type="color"
                            defaultValue="#ffffff"
                            onChange={e => exec('foreColor', e.target.value)}
                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, cursor: 'pointer' }}
                        />
                        <span style={{ width: 12, height: 3, background: '#c5a059', display: 'block', marginTop: 1, borderRadius: 1 }} />
                    </label>

                    <div style={tbSep} />

                    {/* Lists */}
                    <button onClick={() => exec('insertUnorderedList')} style={tbBtn()} title="Bullet List">&#8226;</button>
                    <button onClick={() => exec('insertOrderedList')} style={tbBtn()} title="Numbered List">1.</button>

                    <div style={tbSep} />

                    {/* Alignment */}
                    <button onClick={() => exec('justifyLeft')} style={tbBtn()} title="Align Left">
                        <span style={{ fontSize: '0.65rem' }}>&#9776;</span>
                    </button>
                    <button onClick={() => exec('justifyCenter')} style={tbBtn()} title="Center">
                        <span style={{ fontSize: '0.65rem' }}>&#9776;</span>
                    </button>
                    <button onClick={() => exec('justifyRight')} style={tbBtn()} title="Align Right">
                        <span style={{ fontSize: '0.65rem' }}>&#9776;</span>
                    </button>

                    <div style={tbSep} />

                    {/* Link */}
                    <button onClick={handleLink} style={tbBtn()} title="Insert Link">
                        <span style={{ fontSize: '0.75rem' }}>&#128279;</span>
                    </button>
                    <button onClick={() => exec('unlink')} style={tbBtn()} title="Remove Link">
                        <span style={{ fontSize: '0.65rem', textDecoration: 'line-through' }}>&#128279;</span>
                    </button>

                    {/* Inline image */}
                    <button onClick={() => inlineImgInputRef.current?.click()} style={tbBtn()} title="Insert Image">
                        <span style={{ fontSize: '0.75rem' }}>&#128247;</span>
                    </button>

                    <div style={tbSep} />

                    {/* Indent */}
                    <button onClick={() => exec('indent')} style={tbBtn()} title="Indent">&#8594;</button>
                    <button onClick={() => exec('outdent')} style={tbBtn()} title="Outdent">&#8592;</button>

                    <div style={tbSep} />

                    {/* Undo / Redo */}
                    <button onClick={() => exec('undo')} style={tbBtn()} title="Undo">&#8630;</button>
                    <button onClick={() => exec('redo')} style={tbBtn()} title="Redo">&#8631;</button>

                    {/* Clear formatting */}
                    <button onClick={() => exec('removeFormat')} style={tbBtn()} title="Clear Formatting">
                        <span style={{ fontSize: '0.7rem' }}>T&#10005;</span>
                    </button>
                </div>

                {/* ── Content Editable Area ── */}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                        flex: 1,
                        minHeight: 300,
                        padding: '16px 18px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(197,160,89,0.15)',
                        borderRadius: '0 0 8px 8px',
                        color: '#fff',
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontSize: '0.95rem',
                        lineHeight: 1.7,
                        outline: 'none',
                        overflowY: 'auto',
                        maxHeight: 500,
                    }}
                    onPaste={e => {
                        // Clean paste: strip Word/Google Docs junk but keep basic HTML
                        e.preventDefault();
                        const html = e.clipboardData.getData('text/html');
                        const text = e.clipboardData.getData('text/plain');
                        if (html) {
                            // Strip style attrs and class attrs but keep tags
                            const cleaned = html
                                .replace(/\s*(style|class|id|data-\w+)="[^"]*"/gi, '')
                                .replace(/<meta[^>]*>/gi, '')
                                .replace(/<link[^>]*>/gi, '')
                                .replace(/<!--[\s\S]*?-->/g, '');
                            document.execCommand('insertHTML', false, cleaned);
                        } else {
                            document.execCommand('insertText', false, text);
                        }
                    }}
                />

                {/* ── Excerpt ── */}
                <div style={{ ...S.field, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={S.label}>Excerpt<span style={S.required}>*</span></label>
                        <button
                            onClick={() => setExcerpt(autoExcerpt(getEditorContent()))}
                            style={{ ...S.btn, ...S.dimBtn, padding: '3px 10px', fontSize: '0.5rem', marginBottom: 6 }}
                        >
                            AUTO-FILL
                        </button>
                    </div>
                    <textarea style={{ ...S.input, minHeight: 50, resize: 'vertical' }} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short summary for the listing page" rows={2} />
                </div>

                {/* ── Tags ── */}
                <div style={S.field}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={S.label}>Tags<span style={S.required}>*</span></label>
                        <button
                            onClick={() => setTags(autoTags(title, getEditorContent()))}
                            style={{ ...S.btn, ...S.dimBtn, padding: '3px 10px', fontSize: '0.5rem', marginBottom: 6 }}
                        >
                            AUTO-GENERATE
                        </button>
                    </div>
                    <input style={S.input} value={tags} onChange={e => setTags(e.target.value)} placeholder="keyholder, lifestyle, discipline (comma-separated)" />
                </div>

                {/* ── SEO Settings (collapsed by default) ── */}
                <div style={{ marginBottom: 16 }}>
                    <button
                        onClick={() => { setShowSeo(!showSeo); if (!showSeo) autoFillSeo(); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#c5a059',
                            fontFamily: "'Rajdhani',sans-serif",
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            letterSpacing: 3,
                            cursor: 'pointer',
                            padding: '8px 0',
                            textTransform: 'uppercase',
                        }}
                    >
                        {showSeo ? '▼' : '▶'} SEO SETTINGS {!showSeo && '(auto-filled)'}
                    </button>

                    {showSeo && (
                        <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 20, marginTop: 8 }}>
                            <div style={S.field}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={S.label}>Meta Description<span style={S.required}>*</span></label>
                                    <button
                                        onClick={() => setMetaDesc(autoMetaDescription(getEditorContent()))}
                                        style={{ ...S.btn, ...S.dimBtn, padding: '3px 10px', fontSize: '0.5rem', marginBottom: 6 }}
                                    >
                                        AUTO-FILL
                                    </button>
                                </div>
                                <textarea style={{ ...S.input, minHeight: 50, resize: 'vertical' }} value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Description for search engines (150-160 chars ideal)" rows={2} />
                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.6rem', color: metaDesc.length > 160 ? '#e04040' : 'rgba(255,255,255,0.25)', marginTop: 4 }}>{metaDesc.length}/160</div>
                            </div>
                            <div style={S.field}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={S.label}>Meta Keywords<span style={S.required}>*</span></label>
                                    <button
                                        onClick={() => setMetaKeywords(autoKeywords(title, getEditorContent()))}
                                        style={{ ...S.btn, ...S.dimBtn, padding: '3px 10px', fontSize: '0.5rem', marginBottom: 6 }}
                                    >
                                        AUTO-GENERATE
                                    </button>
                                </div>
                                <input style={S.input} value={metaKeywords} onChange={e => setMetaKeywords(e.target.value)} placeholder="keyholder, femdom, chastity (comma-separated)" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview link for existing published posts */}
                {editing && editing.status === 'published' && (
                    <div style={S.field}>
                        <a href={`/blog/${editing.slug}`} target="_blank" rel="noopener" style={{ color: '#c5a059', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.7rem', letterSpacing: 2, textDecoration: 'underline' }}>
                            VIEW LIVE POST &rarr;
                        </a>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button disabled={saving || uploading} onClick={() => save('draft')} style={{ ...S.btn, ...S.goldBtn, opacity: saving ? 0.5 : 1 }}>
                        {saving ? 'SAVING...' : 'SAVE DRAFT'}
                    </button>
                    <button disabled={saving || uploading} onClick={() => save('published')} style={{ ...S.btn, ...S.publishBtn, opacity: saving ? 0.5 : 1 }}>
                        {saving ? 'SAVING...' : 'PUBLISH'}
                    </button>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════
    //  LIST VIEW
    // ══════════════════════════════════════════
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24 }}>
            {fileInputs}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '1.1rem', color: '#c5a059', letterSpacing: 4, fontWeight: 700 }}>BLOG</div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => openEditor()} style={{ ...S.btn, ...S.publishBtn }}>+ NEW POST</button>
                    <button onClick={fetchPosts} style={{ ...S.btn, ...S.goldBtn }}>REFRESH</button>
                    <button onClick={onClose} style={{ ...S.btn, ...S.dimBtn }}>CLOSE</button>
                </div>
            </div>

            {loading && <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.8rem', letterSpacing: 2 }}>LOADING...</div>}

            {!loading && posts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.9rem', letterSpacing: 3, marginBottom: 16 }}>NO BLOG POSTS YET</div>
                    <button onClick={() => openEditor()} style={{ ...S.btn, ...S.goldBtn }}>CREATE YOUR FIRST POST</button>
                </div>
            )}

            {!loading && posts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {posts.map(post => (
                        <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer' }} onClick={() => openEditor(post)}>
                            {post.cover_image ? (
                                <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                                    <img src={post.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                            ) : (
                                <div style={{ width: 60, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.95rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                                    {(post.tags || []).slice(0, 3).map(t => (
                                        <span key={t} style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.55rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>{t}</span>
                                    ))}
                                </div>
                            </div>

                            <div style={{
                                padding: '4px 12px',
                                borderRadius: 14,
                                fontFamily: "'Rajdhani',sans-serif",
                                fontSize: '0.55rem',
                                fontWeight: 700,
                                letterSpacing: 2,
                                textTransform: 'uppercase',
                                ...(post.status === 'published'
                                    ? { background: 'rgba(40,180,80,0.1)', color: '#40cc60', border: '1px solid rgba(40,180,80,0.25)' }
                                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }
                                ),
                            }}>
                                {post.status}
                            </div>

                            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 1, flexShrink: 0 }}>
                                {post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Draft'}
                            </div>

                            <button onClick={e => { e.stopPropagation(); deletePost(post.slug); }} style={{ ...S.btn, ...S.dangerBtn, padding: '6px 12px', fontSize: '0.5rem' }}>DEL</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
