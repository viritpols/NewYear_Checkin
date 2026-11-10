/**
 * แปลงเวลาเป็นเวลาไทย (UTC+7)
 * @param dateString - วันที่ในรูปแบบ string (ISO format หรือ MySQL datetime)
 * @returns Date object ที่ปรับเป็นเวลาไทยแล้ว
 */
export const toThaiTime = (dateString: string | Date | null | undefined): Date | null => {
  if (!dateString) return null
  
  let date: Date
  if (dateString instanceof Date) {
    date = new Date(dateString)
  } else if (typeof dateString === 'string') {
    // ถ้าเป็น string จาก MySQL (2026-12-13 11:56:13) ให้แปลงเป็น ISO format
    // MySQL datetime ไม่มี timezone info ดังนั้นเราจะถือว่าเป็นเวลาไทย (UTC+7)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
      // แปลง MySQL datetime เป็น ISO format โดยถือว่าเป็นเวลาไทย
      // ตัวอย่าง: "2026-12-13 11:56:13" -> "2026-12-13T11:56:13+07:00"
      const isoString = dateString.replace(' ', 'T') + '+07:00'
      date = new Date(isoString)
    } else if (dateString.includes('T')) {
      // ถ้าเป็น ISO string
      if (dateString.endsWith('Z')) {
        // ถ้าเป็น UTC (Z) ให้แปลงเป็นเวลาไทยโดยลบ 7 ชั่วโมงออก
        // แต่จริงๆ แล้วเราต้องการให้แสดงเวลาเดิม (ไม่ต้องแปลง)
        // เพราะเวลาที่มาจาก DB เป็นเวลาไทยอยู่แล้ว
        date = new Date(dateString)
      } else if (dateString.includes('+') || dateString.includes('-', 10)) {
        // มี timezone info แล้ว
        date = new Date(dateString)
      } else {
        // ไม่มี timezone info ให้ถือว่าเป็น UTC และแปลงเป็นเวลาไทย
        // แต่เนื่องจากเวลาจาก DB เป็นเวลาไทยอยู่แล้ว เราจะไม่แปลง
        date = new Date(dateString + '+07:00')
      }
    } else {
      // รูปแบบอื่นๆ
      date = new Date(dateString)
    }
  } else {
    return null
  }
  
  return date
}

/**
 * แสดงเวลาตามรูปแบบไทย
 * @param dateString - วันที่ในรูปแบบ string หรือ Date
 * @param options - options สำหรับ toLocaleString
 * @returns string ที่แสดงเวลาไทย
 */
export const formatThaiDateTime = (
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok'
  }
): string => {
  if (!dateString) return ''
  
  let date: Date
  
  // ถ้าเป็น MySQL datetime format (2026-12-13 11:56:13)
  // ให้ parse โดยตรงแล้วสร้าง Date object โดยใช้ค่าเวลาโดยตรง
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    // Parse MySQL datetime string โดยตรง
    // ตัวอย่าง: "2026-12-13 11:56:13"
    // เวลาจาก DB เป็นเวลาไทย (UTC+7) อยู่แล้ว
    const [datePart, timePart] = dateString.split(' ')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes, seconds] = timePart.split(':').map(Number)
    
    // สร้าง Date object โดยใช้ค่าเวลาโดยตรง
    // แต่ต้องสร้างเป็น UTC แล้วแปลงเป็น Asia/Bangkok
    // เพราะเวลาจาก DB เป็นเวลาไทย (UTC+7) อยู่แล้ว
    // เราต้องสร้าง Date object ที่เมื่อแสดงใน timezone Asia/Bangkok จะได้เวลาเดิม
    // วิธี: สร้างเป็น UTC โดยลบ 7 ชั่วโมงออก
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, seconds || 0))
    date = utcDate
  } else if (dateString instanceof Date) {
    date = dateString
  } else {
    date = new Date(dateString)
  }
  
  // ใช้ timeZone: 'Asia/Bangkok' เพื่อบังคับให้แสดงเป็นเวลาไทยเสมอ
  return date.toLocaleString('th-TH', {
    ...options,
    timeZone: 'Asia/Bangkok'
  })
}

