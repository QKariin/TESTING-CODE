import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/auth/',
                    '/profile/',
                    '/profile',
                    '/dashboard/',
                    '/dashboard',
                    '/chat/',
                    '/chat',
                    '/onboarding/',
                    '/onboarding',
                    '/initiate/',
                    '/initiate',
                    '/locked/',
                    '/locked',
                    '/global/',
                    '/global',
                    '/vault/',
                    '/vault',
                    '/vault-tasks/',
                    '/vault-tasks',
                    '/test/',
                    '/test',
                    '/test-payment/',
                    '/test-payment',
                ],
            },
            // Explicitly allow AI crawlers on all public pages
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ChatGPT-User', allow: '/' },
            { userAgent: 'anthropic-ai', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
            { userAgent: 'PerplexityBot', allow: '/' },
            { userAgent: 'cohere-ai', allow: '/' },
            { userAgent: 'Applebot-Extended', allow: '/' },
            { userAgent: 'YouBot', allow: '/' },
            { userAgent: 'Amazonbot', allow: '/' },
        ],
        sitemap: 'https://throne.qkarin.com/sitemap.xml',
    }
}
