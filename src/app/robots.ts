import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
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
                '/tribute/',
                '/tribute',
                '/onboarding/',
                '/onboarding',
                '/initiate/',
                '/initiate',
                '/locked/',
                '/locked',
                '/global/',
                '/global',
            ],
        },
        sitemap: 'https://throne.qkarin.com/sitemap.xml',
    }
}
