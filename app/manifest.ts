import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FNB App',
    short_name: 'FNB App',
    description: 'FNB POS System',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    // No icon file exists yet (owner decision 2026-09-07: remove the dead
    // /icon.png reference rather than keep a 404 on every page load; add it
    // back here once a real square PNG is supplied).
    icons: []
  }
}
