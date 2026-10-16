import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const routes = [
    '',
    '/dashboard',
    '/governance',
    '/treasury',
    '/loans',
    '/staking',
    '/notifications',
  ]

  const now = new Date()

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))
}
