import Card from '@/components/ui/Card'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-blue-900 mb-4">
            CAD Upload Point
          </h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card 
            href="/upload" 
            title="Upload" 
            description="Upload and manage your files with ease. Support for multiple file types and formats." 
          />
          
          <Card 
            href="/projects" 
            title="Projects" 
            description="Organize and manage your projects efficiently. Keep everything in one place." 
          />
        </div>
      </div>
    </div>
  )
}