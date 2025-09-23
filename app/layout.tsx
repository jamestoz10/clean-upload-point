import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/layout/Navigation'

export const metadata: Metadata = {
  title: 'CAD Upload Point',
  description: 'A clean upload and mapping application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/leaflet-toolbar@0.4.0-alpha.2/dist/leaflet.toolbar.css"
          crossOrigin=""
        />
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/leaflet-distortableimage@0.21.9/dist/leaflet.distortableimage.css"
          crossOrigin=""
        />
        <script 
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
        />
        <script 
          src="https://unpkg.com/leaflet-toolbar@0.4.0-alpha.2/dist/leaflet.toolbar.js"
          crossOrigin=""
        />
        <script 
          src="https://unpkg.com/leaflet-distortableimage@0.21.9/dist/leaflet.distortableimage.js"
          crossOrigin=""
        />
      </head>
      <body className="antialiased">
        <Navigation />
        {children}
      </body>
    </html>
  )
}
