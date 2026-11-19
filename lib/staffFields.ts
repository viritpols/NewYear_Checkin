// ข้อมูลกลางของฟิลด์ตาราง `user` ใช้ร่วมกันทั้งหน้าเว็บ (อ่าน Excel) และ API (ตรวจ/บันทึก)
// ไฟล์นี้ห้าม import ของฝั่ง server (เช่น db) เพราะหน้าเว็บก็ใช้ด้วย

export type StaffField =
  | 'group'
  | 'staffid'
  | 'stafftitle'
  | 'staffname'
  | 'staffnickname'
  | 'jobtitle'
  | 'position'
  | 'department'
  | 'branch'
  | 'startdate'
  | 'rewardid'

export const STAFF_FIELDS: StaffField[] = [
  'group',
  'staffid',
  'stafftitle',
  'staffname',
  'staffnickname',
  'jobtitle',
  'position',
  'department',
  'branch',
  'startdate',
  'rewardid',
]

export const FIELD_LABELS: Record<StaffField, string> = {
  group: 'กลุ่ม',
  staffid: 'รหัสพนักงาน',
  stafftitle: 'คำนำหน้า',
  staffname: 'ชื่อ-นามสกุล',
  staffnickname: 'ชื่อเล่น',
  jobtitle: 'Job title',
  position: 'ตำแหน่ง',
  department: 'แผนก',
  branch: 'สาขา',
  startdate: 'วันที่เริ่มงาน',
  rewardid: 'rewardid',
}

// ⭐ หัวคอลัมน์ใน Excel ที่ยอมรับ (ไม่สนตัวพิมพ์เล็ก/ใหญ่ และช่องว่างหัวท้าย)
// ถ้าไฟล์จริงใช้ชื่อหัวคอลัมน์อื่น ให้เพิ่มชื่อนั้นเข้าไปในรายการของฟิลด์ที่ตรงกันได้เลย
export const HEADER_ALIASES: Record<StaffField, string[]> = {
  group: ['group', 'กลุ่ม', 'กรุ๊ป', 'สี'],
  staffid: ['staffid', 'staff id', 'staff_id', 'รหัสพนักงาน', 'รหัส', 'emp id', 'employee id'],
  stafftitle: ['stafftitle', 'title', 'คำนำหน้า', 'คำนำหน้าชื่อ'],
  staffname: ['staffname', 'name', 'ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ชื่อนามสกุล', 'ชื่อ'],
  staffnickname: ['staffnickname', 'nickname', 'ชื่อเล่น'],
  jobtitle: ['jobtitle', 'job title', 'job_title'],
  position: ['position', 'ตำแหน่ง'],
  department: ['department', 'dept', 'แผนก', 'ฝ่าย'],
  branch: ['branch', 'สาขา'],
  startdate: ['startdate', 'start date', 'start_date', 'วันที่เริ่มงาน', 'วันเริ่มงาน'],
  rewardid: ['rewardid', 'reward id', 'reward_id'],
}

const MAX_LEN: Partial<Record<StaffField, number>> = {
  stafftitle: 100,
  staffname: 100,
  staffnickname: 50,
  branch: 10,
  jobtitle: 1000,
  position: 1000,
  department: 1000,
}

const INT_FIELDS: StaffField[] = ['group', 'staffid', 'rewardid']

// แถวที่ผ่านการแปลงแล้ว: undefined = ไม่มีคอลัมน์นี้ในไฟล์ / ช่องว่าง (ไม่แตะค่าเดิม), null ไม่ใช้
export type StaffRecord = Partial<Record<StaffField, string | number>>

const normalizeHeader = (h: string) => h.replace(/\s+/g, ' ').trim().toLowerCase()

/** จับคู่หัวคอลัมน์ใน Excel -> ฟิลด์ใน DB คืนค่า { ชื่อหัวคอลัมน์จริง: ฟิลด์ } */
export function mapHeaders(headers: string[]): { mapping: Record<string, StaffField>; unknown: string[] } {
  const lookup = new Map<string, StaffField>()
  for (const field of STAFF_FIELDS) {
    for (const alias of HEADER_ALIASES[field]) lookup.set(normalizeHeader(alias), field)
  }
  const mapping: Record<string, StaffField> = {}
  const used = new Set<StaffField>()
  const unknown: string[] = []
  for (const h of headers) {
    const field = lookup.get(normalizeHeader(String(h)))
    if (field && !used.has(field)) {
      mapping[h] = field
      used.add(field)
    } else if (String(h).trim()) {
      unknown.push(String(h))
    }
  }
  return { mapping, unknown }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** แปลงวันที่หลายรูปแบบ -> 'YYYY-MM-DD' (รองรับปี พ.ศ.) */
export function normalizeDate(v: unknown): string | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null
  let y: number, m: number, d: number
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return 'invalid'
    y = v.getFullYear()
    m = v.getMonth() + 1
    d = v.getDate()
  } else {
    const s = String(v).trim()
    let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) {
      y = +match[1]; m = +match[2]; d = +match[3]
    } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) {
      // DD/MM/YYYY (แบบไทย)
      d = +match[1]; m = +match[2]; y = +match[3]
    } else {
      return 'invalid'
    }
  }
  if (y > 2400) y -= 543 // ปี พ.ศ. -> ค.ศ.
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return 'invalid'
  return `${y}-${pad(m)}-${pad(d)}`
}

/** ตรวจ + แปลงข้อมูล 1 แถว คืน record ที่สะอาดแล้ว หรือรายการ error */
export function cleanStaffRow(raw: Record<string, unknown>): { record: StaffRecord; errors: string[] } {
  const record: StaffRecord = {}
  const errors: string[] = []

  for (const field of STAFF_FIELDS) {
    const v = raw[field]
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue

    if (INT_FIELDS.includes(field)) {
      const s = String(v).trim()
      if (!/^\d+$/.test(s)) {
        errors.push(`${FIELD_LABELS[field]} ต้องเป็นตัวเลข`)
        continue
      }
      record[field] = parseInt(s, 10)
    } else if (field === 'startdate') {
      const d = normalizeDate(v)
      if (d === 'invalid') errors.push('วันที่เริ่มงานอ่านไม่ออก')
      else if (d) record.startdate = d
    } else {
      const s = String(v).trim()
      const max = MAX_LEN[field]
      if (max && s.length > max) errors.push(`${FIELD_LABELS[field]} ยาวเกิน ${max} ตัวอักษร`)
      else record[field] = s
    }
  }

  if (record.staffid === undefined && !errors.some(e => e.startsWith(FIELD_LABELS.staffid))) {
    errors.push('ไม่มีรหัสพนักงาน')
  }
  if (record.staffname === undefined) errors.push('ไม่มีชื่อ-นามสกุล')

  return { record, errors }
}

/** แปลงค่าจาก DB ให้อยู่รูปเดียวกับ StaffRecord เพื่อเทียบกัน */
export function dbRowToRecord(row: Record<string, any>): StaffRecord {
  const rec: StaffRecord = {}
  for (const field of STAFF_FIELDS) {
    const v = row[field]
    if (v === undefined || v === null || v === '') continue
    if (field === 'startdate') {
      const d = normalizeDate(v instanceof Date ? v : String(v))
      if (d && d !== 'invalid') rec.startdate = d
    } else if (INT_FIELDS.includes(field)) {
      rec[field] = Number(v)
    } else {
      rec[field] = String(v).trim()
    }
  }
  return rec
}

/** ฟิลด์ที่ไฟล์มีค่า แต่ไม่ตรงกับใน DB (ช่องว่างในไฟล์ไม่นับ) */
export function diffFields(fromFile: StaffRecord, fromDb: StaffRecord): StaffField[] {
  return STAFF_FIELDS.filter(
    f => f !== 'staffid' && fromFile[f] !== undefined && String(fromFile[f]) !== String(fromDb[f] ?? '')
  )
}
