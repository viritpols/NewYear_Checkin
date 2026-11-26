import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

// ตรวจ header x-api-key กับ API_KEY ใน env
// คืน NextResponse (error) ถ้าไม่ผ่าน หรือ null ถ้าผ่าน
export function checkAdmin(request: NextRequest): NextResponse | null {
  const adminKey = process.env.API_KEY
  if (!adminKey) {
    return NextResponse.json(
      { success: false, error: 'ยังไม่ได้ตั้งค่า API_KEY ในเซิร์ฟเวอร์' },
      { status: 503 }
    )
  }
  const provided = request.headers.get('x-api-key') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(adminKey)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { success: false, error: 'รหัสผู้ดูแลไม่ถูกต้อง' },
      { status: 401 }
    )
  }
  return null
}
