import { NextRequest, NextResponse } from 'next/server'
import { query, executeTransaction, executeQuery } from '@/lib/db'
import { checkAdmin } from '@/lib/adminAuth'
import { STAFF_FIELDS, StaffField, cleanStaffRow } from '@/lib/staffFields'

// นำเข้ารายชื่อจาก Excel (หน้าเว็บอ่านไฟล์เอง แล้วส่งข้อมูลเป็น JSON มา)
//   action: 'check'  -> ส่ง staffids มา คืนข้อมูลเดิมใน DB ของรหัสเหล่านั้น (ไว้ทำพรีวิว)
//   action: 'commit' -> ส่ง insert[] / update[] มา บันทึกใน transaction เดียว

export const dynamic = 'force-dynamic'

const MAX_ROWS_PER_REQUEST = 500

const COLUMN_SQL: Record<StaffField, string> = {
  group: '`group`',
  staffid: 'staffid',
  stafftitle: 'stafftitle',
  staffname: 'staffname',
  staffnickname: 'staffnickname',
  jobtitle: 'jobtitle',
  position: '`position`',
  department: 'department',
  branch: 'branch',
  startdate: 'startdate',
  rewardid: 'rewardid',
}

const toDbValue = (field: StaffField, v: string | number) =>
  field === 'startdate' ? `${v} 00:00:00` : v

export async function POST(request: NextRequest) {
  const denied = checkAdmin(request)
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }

  if (body.action === 'check') return handleCheck(body)
  if (body.action === 'commit') return handleCommit(body)
  return NextResponse.json({ success: false, error: 'action ไม่ถูกต้อง' }, { status: 400 })
}

async function handleCheck(body: any) {
  const ids: number[] = Array.isArray(body.staffids)
    ? Array.from(new Set<number>(body.staffids.filter((x: unknown) => Number.isInteger(x) && (x as number) >= 0)))
    : []
  if (ids.length === 0) return NextResponse.json({ success: true, existing: [] })
  if (ids.length > 5000) {
    return NextResponse.json({ success: false, error: 'ไฟล์ใหญ่เกินไป (เกิน 5,000 คน)' }, { status: 400 })
  }

  try {
    const existing: any[] = []
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000)
      const rows = await query<any[]>(
        `SELECT recordid, ${STAFF_FIELDS.map(f => COLUMN_SQL[f]).join(', ')}
         FROM \`user\` WHERE staffid IN (${chunk.map(() => '?').join(',')})`,
        chunk
      )
      existing.push(...rows)
    }
    return NextResponse.json({ success: true, existing })
  } catch (error) {
    console.error('staff-manual bulk check error:', error)
    return NextResponse.json({ success: false, error: 'ตรวจข้อมูลกับฐานข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}

async function handleCommit(body: any) {
  const insertRaw: unknown[] = Array.isArray(body.insert) ? body.insert : []
  const updateRaw: unknown[] = Array.isArray(body.update) ? body.update : []
  if (insertRaw.length + updateRaw.length === 0) {
    return NextResponse.json({ success: true, inserted: 0, updated: 0, skipped: [] })
  }
  if (insertRaw.length + updateRaw.length > MAX_ROWS_PER_REQUEST) {
    return NextResponse.json(
      { success: false, error: `ส่งได้ครั้งละไม่เกิน ${MAX_ROWS_PER_REQUEST} แถว` },
      { status: 400 }
    )
  }

  // ตรวจซ้ำฝั่ง server (ไม่เชื่อข้อมูลจากหน้าเว็บ 100%)
  const clean = (list: unknown[]) =>
    list.map((r, i) => {
      const { record, errors } = cleanStaffRow((r ?? {}) as Record<string, unknown>)
      return { record, errors, index: i }
    })
  const inserts = clean(insertRaw)
  const updates = clean(updateRaw)
  const bad = [...inserts, ...updates].find(r => r.errors.length > 0)
  if (bad) {
    return NextResponse.json(
      { success: false, error: `ข้อมูลไม่ถูกต้อง (รหัส ${bad.record.staffid ?? '?'}): ${bad.errors.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const result = await executeTransaction(async (conn) => {
      let inserted = 0
      let updated = 0
      const skipped: { staffid: number; reason: string }[] = []

      for (const { record } of inserts) {
        // กันกรณีมีคนเพิ่มรหัสนี้ไปแล้วระหว่างพรีวิว
        const exists = await executeQuery<any[]>(conn, 'SELECT 1 FROM `user` WHERE staffid = ? LIMIT 1', [record.staffid])
        if (exists.length > 0) {
          skipped.push({ staffid: record.staffid as number, reason: 'มีรหัสนี้ในระบบแล้ว' })
          continue
        }
        const fields = STAFF_FIELDS.filter(f => record[f] !== undefined)
        const cols = fields.map(f => COLUMN_SQL[f])
        const placeholders = fields.map(() => '?')
        if (record.startdate === undefined) {
          cols.push('startdate')
          placeholders.push('CURRENT_TIMESTAMP')
        }
        await executeQuery(
          conn,
          `INSERT INTO \`user\` (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
          fields.map(f => toDbValue(f, record[f] as string | number))
        )
        inserted++
      }

      for (const { record } of updates) {
        // อัปเดตเฉพาะฟิลด์ที่ไฟล์มีค่า (ช่องว่างในไฟล์ = คงค่าเดิม)
        const fields = STAFF_FIELDS.filter(f => f !== 'staffid' && record[f] !== undefined)
        if (fields.length === 0) continue
        const res = await executeQuery<any>(
          conn,
          `UPDATE \`user\` SET ${fields.map(f => `${COLUMN_SQL[f]} = ?`).join(', ')} WHERE staffid = ?`,
          [...fields.map(f => toDbValue(f, record[f] as string | number)), record.staffid]
        )
        if (res.affectedRows > 0) updated++
        else skipped.push({ staffid: record.staffid as number, reason: 'ไม่พบรหัสนี้ในระบบแล้ว' })
      }

      return { inserted, updated, skipped }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('staff-manual bulk commit error:', error)
    return NextResponse.json(
      { success: false, error: 'บันทึกไม่สำเร็จ ไม่มีข้อมูลถูกบันทึกในชุดนี้ (ยกเลิกทั้งชุด)' },
      { status: 500 }
    )
  }
}
