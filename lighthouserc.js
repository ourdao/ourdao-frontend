// Highest median LCP per route (ms) across four hydrated Chrome runs:
// https://github.com/ourdao/ourdao-frontend/actions/runs/45034037316/job/137260760757
// https://github.com/dave-drips/ourdao-frontend/actions/runs/45045552216
// https://github.com/dave-drips/ourdao-frontend/actions/runs/45046203854
// https://github.com/dave-drips/ourdao-frontend/actions/runs/45046710589
// Allow 15% runner variance and round up to the next 100 ms.
const routeGroups = [
  { '/': 4452, '/privacy': 3666, '/governance/create': 3930 },
  { '/governance': 3932, '/loans/request': 3637, '/admin': 3928 },
  { '/register': 3500, '/dashboard': 3663, '/loans': 4313, '/treasury': 3935 },
]
const allRoutes = Object.assign({}, ...routeGroups)
const urlPrefix = 'http://localhost:3000'
const shard = process.env.LHCI_ROUTE_GROUP
const routes = shard === undefined ? allRoutes : routeGroups[shard]

if (!routes) throw new Error(`Unknown Lighthouse route group: ${shard}`)

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 30000,
      url: Object.keys(routes).map(route => urlPrefix + route),
      numberOfRuns: 3,
      settings: { throttlingMethod: 'simulate' },
    },
    assert: {
      assertMatrix: [
        {
          assertions: {
            'largest-contentful-paint': ['warn', { maxNumericValue: 3000, aggregationMethod: 'median' }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
            'total-blocking-time': ['warn', { maxNumericValue: 300, aggregationMethod: 'median' }],
            'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
            'speed-index': ['warn', { maxNumericValue: 4000 }],
          },
        },
        {
          assertions: {
            // The slower hosted runners measured about 400 ms with hydration enabled.
            'total-blocking-time': ['error', { maxNumericValue: 500, aggregationMethod: 'median' }],
          },
        },
        ...Object.entries(routes).map(([route, median]) => ({
          matchingUrlPattern: `^${urlPrefix}${route}$`,
          // Fail when even the fastest sample exceeds the route budget.
          assertions: {
            'largest-contentful-paint': [
              'error',
              { maxNumericValue: Math.ceil((median * 1.15) / 100) * 100, aggregationMethod: 'optimistic' },
            ],
          },
        })),
      ],
    },
    upload: { target: 'temporary-public-storage' },
  },
}
