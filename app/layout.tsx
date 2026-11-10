import type { Metadata } from 'next'
import { 
  Anuphan, 
  IBM_Plex_Sans_Thai_Looped,
  IBM_Plex_Sans_Thai,
  Kanit,
  Maitree,
  Mali,
  Mitr
} from 'next/font/google'
import './globals.css'

// ตั้งค่า fonts
const anuphan = Anuphan({ 
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-anuphan',
  display: 'swap',
})

const ibmPlexSansThaiLooped = IBM_Plex_Sans_Thai_Looped({ 
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-thai-looped',
  display: 'swap',
})

const ibmPlexSansThai = IBM_Plex_Sans_Thai({ 
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-thai',
  display: 'swap',
})

const kanit = Kanit({ 
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-kanit',
  display: 'swap',
})

const maitree = Maitree({ 
  subsets: ['latin', 'thai'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-maitree',
  display: 'swap',
})

const mali = Mali({ 
  subsets: ['latin', 'thai'],
  weight: ['200', '300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-mali',
  display: 'swap',
})

const mitr = Mitr({ 
  subsets: ['latin', 'thai'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-mitr',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ระบบเช็คอินงานปีใหม่ 2026',
  description: 'ระบบเช็คอินเข้างานปีใหม่สำหรับพนักงาน',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={`${anuphan.variable} ${ibmPlexSansThaiLooped.variable} ${ibmPlexSansThai.variable} ${kanit.variable} ${maitree.variable} ${mali.variable} ${mitr.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}

