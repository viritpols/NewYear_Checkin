import { Building2, Cpu } from 'lucide-react'

export default function Header() {
  return (
    <header className="bg-black/80 backdrop-blur-xl shadow-lg border-b border-blue-500/30 relative">
      {/* Glowing top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
      
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 p-2.5 rounded-lg shadow-lg shadow-blue-500/50">
              <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text">
                ระบบเช็คอินอัจฉริยะ
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                AI-Powered Check-in System
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-blue-400 font-mono">
              {new Date().toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Happy New Year 2026!
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

