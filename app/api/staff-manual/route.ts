import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { checkAdmin } from '@/lib/adminAuth'

// API สำหรับหน้าเพิ่มรายชื่อด้วยมือ (ใช้ได้เฉพาะคนที่มี ADMIN_KEY)
// ทุก request ต้องส่ง header: x-admin-key

export const dynamic = 'force-dynamic'

// GET: รายชื่อล่าสุด 50 คน (ใช้ตรวจรหัสผู้ดูแลตอนเข้าหน้าด้วย)
export async function GET(request: NextRequest) {
  const denied = checkAdmin(request)
  if (denied) return denied

  try {
    const rows = await query<any[]>(
      `SELECT recordid, \`group\`, staffid, stafftitle, staffname, staffnickname,
              jobtitle, \`position\`, department, branch, startdate, rewardid
       FROM \`user\`
       ORDER BY recordid DESC
       LIMIT 50`
    )
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('staff-manual GET error:', error)
    return NextResponse.json(
      { success: false, error: 'ดึงข้อมูลไม่สำเร็จ (เชื่อมต่อฐานข้อมูลไม่ได้?)' },
      { status: 500 }
    )
  }
}

const toText = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

const toInt = (v: unknown): number | null | 'invalid' => {
  if (v === undefined || v === null || String(v).trim() === '') return null
  const s = String(v).trim()
  if (!/^\d+$/.test(s)) return 'invalid'
  return parseInt(s, 10)
}

// POST: เพิ่มพนักงาน 1 คน
export async function POST(request: NextRequest) {
  const denied = checkAdmin(request)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }

  const group = toInt(body.group)
  const staffid = toInt(body.staffid)
  const rewardid = toInt(body.rewardid)
  const staffname = toText(body.staffname, 100)

  if (staffid === null || staffid === 'invalid') {
    return NextResponse.json({ success: false, error: 'รหัสพนักงานต้องเป็นตัวเลข' }, { status: 400 })
  }
  if (!staffname) {
    return NextResponse.json({ success: false, error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 })
  }
  if (group === 'invalid') {
    return NextResponse.json({ success: false, error: 'กลุ่ม (GROUP) ต้องเป็นตัวเลข' }, { status: 400 })
  }
  if (rewardid === 'invalid') {
    return NextResponse.json({ success: false, error: 'rewardid ต้องเป็นตัวเลข หรือเว้นว่าง' }, { status: 400 })
  }

  // วันที่เริ่มงาน: เว้นว่าง = เวลาปัจจุบัน
  let startdate: string | null = null
  const rawDate = toText(body.startdate, 30)
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return NextResponse.json({ success: false, error: 'วันที่เริ่มงานไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 })
    }
    startdate = `${rawDate} 00:00:00`
  }

  try {
    const existing = await query<any[]>('SELECT recordid, staffname FROM `user` WHERE staffid = ? LIMIT 1', [staffid])
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: `รหัสพนักงาน ${staffid} มีอยู่แล้ว (${existing[0].staffname})` },
        { status: 409 }
      )
    }

    const result = await query<any>(
      `INSERT INTO \`user\`
        (\`group\`, staffid, stafftitle, staffname, staffnickname, jobtitle, \`position\`, department, branch, startdate, rewardid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)`,
      [
        group,
        staffid,
        toText(body.stafftitle, 100),
        staffname,
        toText(body.staffnickname, 50),
        toText(body.jobtitle, 1000),
        toText(body.position, 1000),
        toText(body.department, 1000),
        toText(body.branch, 10),
        startdate,
        rewardid,
      ]
    )

    return NextResponse.json({ success: true, recordid: result.insertId }, { status: 201 })
  } catch (error) {
    console.error('staff-manual POST error:', error)
    return NextResponse.json(
      { success: false, error: 'บันทึกไม่สำเร็จ (เชื่อมต่อฐานข้อมูลไม่ได้?)' },
      { status: 500 }
    )
  }
}
