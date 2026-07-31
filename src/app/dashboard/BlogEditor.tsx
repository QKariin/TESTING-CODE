"use client";

import { useState, useEffect } from 'react';

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
    textarea: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 8, color: '#fff', fontFamily: "monospace", fontSize: '0.85rem', outline: 'none', resize: 'vertical' as const, minHeight: 300, lineHeight: 1.6, boxSizing: 'border-box' as const },
    btn: { padding: '10px 24px', borderRadius: 8, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', fontWeight: 700, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase' as const, border: 'none' },
    goldBtn: { background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.4)', color: '#c5a059' },
    dimBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' },
    dangerBtn: { background: 'rgba(220,40,40,0.1)', border: '1px solid rgba(220,40,40,0.3)', color: '#e04040' },
    publishBtn: { background: 'rgba(40,180,80,0.15)', border: '1px solid rgba(40,180,80,0.4)', color: '#40cc60' },
    field: { marginBottom: 20 },
    required: { color: '#e04040', marginLeft: 4 },
};

export default function BlogEditor({ onClose }: { onClose: () => void }) {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<BlogPost | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form fields
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [content, setContent] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [tags, setTags] = useState('');
    const [metaDesc, setMetaDesc] = useState('');
    const [metaKeywords, setMetaKeywords] = useState('');

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

    const openEditor = (post?: BlogPost) => {
        if (post) {
            setEditing(post);
            setIsNew(false);
            setTitle(post.title);
            setSlug(post.slug);
            setExcerpt(post.excerpt || '');
            setContent(post.content || '');
            setCoverImage(post.cover_image || '');
            setTags((post.tags || []).join(', '));
            setMetaDesc(post.meta_description || '');
            setMetaKeywords(post.meta_keywords || '');
        } else {
            setEditing(null);
            setIsNew(true);
            setTitle(''); setSlug(''); setExcerpt(''); setContent('');
            setCoverImage(''); setTags(''); setMetaDesc(''); setMetaKeywords('');
        }
        setError('');
    };

    const closeEditor = () => { setEditing(null); setIsNew(false); setError(''); };

    const validate = (): string | null => {
        if (!title.trim()) return 'Title is required';
        if (!content.trim()) return 'Content is required';
        if (!metaDesc.trim()) return 'Meta description is required for SEO';
        if (!metaKeywords.trim()) return 'Meta keywords are required for SEO';
        if (!excerpt.trim()) return 'Excerpt is required — it shows on the blog listing';
        if (!tags.trim()) return 'At least one tag is required';
        return null;
    };

    const save = async (publishStatus: 'draft' | 'published') => {
        const err = validate();
        if (err) { setError(err); return; }

        setSaving(true);
        setError('');

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

    // Editor form view
    if (isNew || editing) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '1.1rem', color: '#c5a059', letterSpacing: 4, fontWeight: 700 }}>
                        {isNew ? 'NEW POST' : 'EDIT POST'}
                    </div>
                    <button onClick={closeEditor} style={{ ...S.btn, ...S.dimBtn }}>BACK</button>
                </div>

                {error && (
                    <div style={{ background: 'rgba(220,40,40,0.1)', border: '1px solid rgba(220,40,40,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#e04040', fontFamily: "'Rajdhani',sans-serif", fontSize: '0.8rem', letterSpacing: 1 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Left column — content */}
                    <div>
                        <div style={S.field}>
                            <label style={S.label}>Title<span style={S.required}>*</span></label>
                            <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title" />
                        </div>
                        <div style={S.field}>
                            <label style={S.label}>Slug (auto-generated if empty)</label>
                            <input style={S.input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-post-title" />
                        </div>
                        <div style={S.field}>
                            <label style={S.label}>Excerpt<span style={S.required}>*</span></label>
                            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short summary shown on the blog listing" rows={2} />
                        </div>
                        <div style={S.field}>
                            <label style={S.label}>Content (HTML)<span style={S.required}>*</span></label>
                            <textarea style={S.textarea} value={content} onChange={e => setContent(e.target.value)} placeholder="<p>Write your post here...</p>" />
                        </div>
                    </div>

                    {/* Right column — SEO & settings */}
                    <div>
                        <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.6rem', color: '#c5a059', letterSpacing: 3, fontWeight: 700, marginBottom: 16 }}>SEO SETTINGS</div>
                            <div style={S.field}>
                                <label style={S.label}>Meta Description<span style={S.required}>*</span></label>
                                <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Description for search engines (150-160 chars ideal)" rows={2} />
                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.6rem', color: metaDesc.length > 160 ? '#e04040' : 'rgba(255,255,255,0.25)', marginTop: 4 }}>{metaDesc.length}/160</div>
                            </div>
                            <div style={S.field}>
                                <label style={S.label}>Meta Keywords<span style={S.required}>*</span></label>
                                <input style={S.input} value={metaKeywords} onChange={e => setMetaKeywords(e.target.value)} placeholder="keyholder, femdom, chastity (comma-separated)" />
                            </div>
                        </div>

                        <div style={S.field}>
                            <label style={S.label}>Tags<span style={S.required}>*</span></label>
                            <input style={S.input} value={tags} onChange={e => setTags(e.target.value)} placeholder="keyholder, lifestyle, discipline (comma-separated)" />
                        </div>
                        <div style={S.field}>
                            <label style={S.label}>Cover Image URL</label>
                            <input style={S.input} value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." />
                            {coverImage && (
                                <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(197,160,89,0.12)' }}>
                                    <img src={coverImage} alt="Preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} onError={e => (e.currentTarget.style.display = 'none')} />
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
                        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
                            <button disabled={saving} onClick={() => save('draft')} style={{ ...S.btn, ...S.goldBtn, opacity: saving ? 0.5 : 1 }}>
                                {saving ? 'SAVING...' : 'SAVE DRAFT'}
                            </button>
                            <button disabled={saving} onClick={() => save('published')} style={{ ...S.btn, ...S.publishBtn, opacity: saving ? 0.5 : 1 }}>
                                {saving ? 'SAVING...' : 'PUBLISH'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // List view
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24 }}>
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
                            {/* Cover thumbnail */}
                            {post.cover_image ? (
                                <div style={{ width: 60, height: 40, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                                    <img src={post.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                            ) : (
                                <div style={{ width: 60, height: 40, borderRadius: 6, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
                            )}

                            {/* Title + meta */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.95rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                                    {(post.tags || []).slice(0, 3).map(t => (
                                        <span key={t} style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.55rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>{t}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Status badge */}
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

                            {/* Date */}
                            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 1, flexShrink: 0 }}>
                                {post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Draft'}
                            </div>

                            {/* Delete */}
                            <button onClick={e => { e.stopPropagation(); deletePost(post.slug); }} style={{ ...S.btn, ...S.dangerBtn, padding: '6px 12px', fontSize: '0.5rem' }}>DEL</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
