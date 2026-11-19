'use client'

import { useEffect, useState } from 'react'

// พลุเบาๆ สำหรับหน้าเช็คอิน (น้อยกว่าหน้า QR)
// ใช้ CSS ล้วน (ดู .burst-particle ใน globals.css) จึงไม่หนักมือถือ
// และปิดเองอัตโนมัติถ้าเครื่องตั้งค่า "ลดการเคลื่อนไหว"

const COLORS = ['#D4B46A', '#E6CF94', '#CD7F52', '#6BAA8E', '#B8954A']

type Burst = {
  id: number
  x: number // % จากซ้าย
  y: number // % จากบน
  radius: number // px
  duration: number // วินาที (รวมช่วงเว้นระหว่างลูก)
  delay: number // วินาที
  color: string
  accent: string
}

const PARTICLES = 14

// ประกายเล็กๆ ร่วงลงมาแบบหน้า QR แต่จำนวนน้อยกว่า (QR ใช้ 30)
// ใช้ keyframes floatDown ที่มีอยู่แล้วใน globals.css
export function FallingParticles({ count = 12 }: { count?: number }) {
  const [items, setItems] = useState<
    { id: number; x: number; size: number; duration: number; delay: number; drift: number; color: string }[]
  >([])

  useEffect(() => {
    setItems(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        size: Math.random() * 3 + 2,
        duration: Math.random() * 4 + 6, // ร่วงช้ากว่าหน้า QR ให้ดูนุ่มๆ
        delay: Math.random() * 6,
        drift: Math.random() * 50 - 25,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
    )
  }, [count])

  if (items.length === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {items.map((p) => (
        <span
          key={p.id}
          className="falling-particle absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: `${p.color}CC`,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}99`,
            animation: `floatDown ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

export default function LightFireworks({ count = 4 }: { count?: number }) {
  const [bursts, setBursts] = useState<Burst[]>([])

  // สุ่มฝั่ง client เท่านั้น กัน hydration mismatch
  useEffect(() => {
    setBursts(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        // กระจายซ้าย-ขวาสลับกัน ไม่ให้ไปกองตรงกลางทับฟอร์ม
        x: i % 2 === 0 ? 8 + Math.random() * 22 : 70 + Math.random() * 22,
        y: 6 + Math.random() * 38,
        radius: 45 + Math.random() * 35,
        duration: 5 + Math.random() * 2.5,
        delay: i * 1.6 + Math.random() * 0.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        accent: COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
    )
  }, [count])

  if (bursts.length === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {bursts.map((b) => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {/* แสงวาบตรงกลางตอนพลุแตก */}
          <span
            className="burst-flash"
            style={{
              background: `radial-gradient(circle, ${b.color}AA 0%, transparent 70%)`,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            } as React.CSSProperties}
          />
          {Array.from({ length: PARTICLES }, (_, i) => {
            const color = i % 3 === 0 ? b.accent : b.color
            return (
              <span
                key={i}
                className="burst-particle"
                style={{
                  '--a': `${(360 / PARTICLES) * i}deg`,
                  '--r': `${b.radius * (i % 2 === 0 ? 1 : 0.78)}px`,
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}`,
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
