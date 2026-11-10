import { NextRequest, NextResponse } from 'next/server'
import { query, executeTransaction } from '@/lib/db'
import { cookies } from 'next/headers'
import { checkRateLimit, checkSuspiciousPattern } from '@/utils/rateLimit'
import mysql from 'mysql2/promise'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { staffid, name, reward, deviceId, hwFingerprint, deviceFingerprint } = body

    // ดึง IP address และ User-Agent จาก request
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     request.ip ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    console.log(staffid, name, reward, deviceFingerprint, clientIp)

    // Rate limiting: ตรวจสอบ IP address (ป้องกัน public IP/DNS)
    // เพิ่ม limit เป็น 20 requests/min สำหรับรองรับ concurrent users มากๆ
    if (checkRateLimit(`ip_${clientIp}`, 20, 60 * 1000)) { // 20 requests per minute per IP
      return NextResponse.json(
        {
          error: 'คำขอนี้ถูกจำกัด',
          message: 'มีการส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
        },
        { status: 429 } // 429 Too Many Requests
      )
    }

    // Rate limiting: ตรวจสอบ device fingerprint (ป้องกัน device เดียวกัน)
    // เพิ่ม limit เป็น 10 requests/min สำหรับรองรับ concurrent users มากๆ
    if (deviceFingerprint && checkRateLimit(`fp_${deviceFingerprint}`, 10, 60 * 1000)) { // 10 requests per minute per fingerprint
      return NextResponse.json(
        {
          error: 'อุปกรณ์นี้ถูกจำกัด',
          message: 'มีการส่งคำขอบ่อยเกินไปจากอุปกรณ์นี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
        },
        { status: 429 }
      )
    }

    // Validate input
    if (!staffid || typeof staffid !== 'string' || staffid.trim().length === 0) {
      return NextResponse.json(
        { error: 'Staff ID is required' },
        { status: 400 }
      )
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name is required and must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Verify staff ID exists in user table and get group
    let userData = null
    try {
      const userSql = 'SELECT staffid, staffname, `group`, rewardid FROM user WHERE staffid = ?'
      const userResults = await query<any[]>(userSql, [staffid.trim()])
      
      if (!userResults || userResults.length === 0) {
        return NextResponse.json(
          { error: 'Staff ID not found' },
          { status: 404 }
        )
      }
      userData = userResults[0]
    } catch (error) {
      console.error('Error verifying staff ID:', error)
      return NextResponse.json(
        { error: 'Failed to verify staff ID' },
        { status: 500 }
      )
    }

    // ตรวจสอบว่ามี checkinlog สำหรับ staffid นี้แล้วหรือยัง (ป้องกัน rewrite)
    try {
      const checkExistingSql = 'SELECT recordid FROM checkinlog WHERE staffid = ? LIMIT 1'
      const existingResults = await query<any[]>(checkExistingSql, [staffid.trim()])
      
      if (existingResults && existingResults.length > 0) {
        // ถ้ามีแล้ว ให้ return error message เพื่อเตือนผู้ใช้
        return NextResponse.json(
          {
            error: 'รหัสพนักงานนี้ได้ทำการเช็คอินไปแล้ว',
            message: 'ไม่สามารถเช็คอินซ้ำได้ กรุณาตรวจสอบรหัสพนักงานอีกครั้ง',
            alreadyCheckedIn: true
          },
          { status: 409 } // 409 Conflict - ใช้สำหรับกรณีที่ข้อมูลซ้ำ
        )
      }
    } catch (error) {
      console.error('Error checking existing checkin:', error)
      // ต่อเนื่องไปยังการ insert ใหม่
    }

    // ตรวจสอบเพิ่มเติม: ถ้าไม่มี deviceId หรือ deviceFingerprint แสดงว่าอาจเป็น private mode
    if (!deviceId || !deviceFingerprint) {
      return NextResponse.json(
        {
          error: 'ไม่สามารถระบุตัวตนของอุปกรณ์ได้',
          message: 'กรุณาใช้โหมดปกติแทนโหมดไม่ระบุตัวตน (Private/Incognito Mode)'
        },
        { status: 403 } // 403 Forbidden
      )
    }

    // ตรวจสอบว่า device นี้เคยเช็คอินไปแล้วหรือไม่ (ป้องกัน private mode)
    // ใช้เฉพาะ hardware fingerprint เท่านั้น (ไม่ใช้ IP) เพื่อป้องกันเครื่องอื่นใน network เดียวกันถูก detect เป็นเครื่องเดียวกัน
    try {
      // ใช้ hardware fingerprint เป็นหลัก (เสถียรข้าม browser)
      const primaryFingerprint = hwFingerprint || deviceFingerprint
      // ไม่ใช้ IP ในการสร้าง device signature เพื่อป้องกันเครื่องอื่นใน network เดียวกันถูก detect เป็นเครื่องเดียวกัน
      const deviceSignature = primaryFingerprint // ใช้ hardware fingerprint โดยตรง
      
      // ตรวจสอบ pattern การใช้งานที่น่าสงสัย
      const suspiciousCheck = checkSuspiciousPattern(deviceSignature, staffid.trim(), Date.now())
      if (suspiciousCheck.suspicious) {
        return NextResponse.json(
          {
            error: 'ตรวจพบพฤติกรรมที่น่าสงสัย',
            message: suspiciousCheck.reason || 'ไม่สามารถเช็คอินได้ในขณะนี้'
          },
          { status: 429 }
        )
      }
      
      // ตรวจสอบ cookie
      const cookieStore = await cookies()
      const existingDeviceCookie = cookieStore.get('ny2026_device')
      
      // ตรวจสอบว่า device นี้เคยเช็คอินไปแล้วหรือไม่ (ไม่ว่าจะเป็นรหัสพนักงานไหน)
      // วิธีที่ 1: ตรวจสอบจาก cookie
      if (existingDeviceCookie && existingDeviceCookie.value && deviceId === existingDeviceCookie.value) {
        // Device นี้เคยเช็คอินไปแล้ว (มี cookie และ deviceId ตรงกัน)
        return NextResponse.json(
          {
            error: 'อุปกรณ์นี้ได้ทำการเช็คอินไปแล้ว',
            message: 'ไม่สามารถเช็คอินซ้ำได้จากอุปกรณ์เดียวกัน กรุณาใช้อุปกรณ์อื่นหรือปิดโหมดไม่ระบุตัวตน',
            alreadyCheckedIn: true
          },
          { status: 409 } // 409 Conflict
        )
      }
      
      // วิธีที่ 2: ตรวจสอบจากตาราง device_checkin โดยใช้ hwFingerprint เป็นหลัก (ไม่ใช้ device_signature ที่มี IP)
      try {
        const checkDeviceSql = `
          SELECT id, staffid, device_id, hwFingerprint, employee_staffid
          FROM device_checkin 
          WHERE hwFingerprint = ? OR device_id = ? 
          LIMIT 1
        `
        const deviceCheckResults = await query<any[]>(checkDeviceSql, [primaryFingerprint, deviceId || null])
        
        if (deviceCheckResults && deviceCheckResults.length > 0) {
          // Device นี้เคยเช็คอินไปแล้ว
          const existingStaffid = deviceCheckResults[0].employee_staffid || deviceCheckResults[0].staffid
          console.log(`Device already checked in. Staff: ${existingStaffid}`)
          return NextResponse.json(
            {
              error: 'อุปกรณ์นี้ได้ทำการเช็คอินไปแล้ว',
              message: 'ไม่สามารถเช็คอินซ้ำได้จากอุปกรณ์เดียวกัน',
              alreadyCheckedIn: true,
              existingStaffid: existingStaffid
            },
            { status: 409 } // 409 Conflict
          )
        }
      } catch (error) {
        // ถ้าตาราง device_checkin ยังไม่มี ให้ข้ามไป
        console.log('Table device_checkin may not exist, skipping device check:', error)
      }
      
    } catch (error) {
      console.error('Error checking device fingerprint:', error)
      // ต่อเนื่องไปยังการ insert ใหม่
    }

    // ใช้ transaction เพื่อป้องกัน race condition เมื่อหลายคนเช็คอินพร้อมกัน
    try {
      // Insert check-in เข้า database (ยังไม่สุ่มรางวัล)
      await executeTransaction<null>(async (connection: mysql.PoolConnection) => {
        // Insert check-in into database (ไม่มีรางวัล)
        // ตาราง checkinlog ใช้ column name (ไม่ใช่ staffname)
        const insertCheckinSql = `
          INSERT INTO checkinlog (staffid, name, reward)
          VALUES (?, ?, NULL)
        `
        await connection.execute(insertCheckinSql, [
          staffid.trim(), 
          name.trim()
        ])
        
        console.log(`Check-in completed for staff ${staffid.trim()} (no reward assigned yet)`)
        
        // Return null เพราะยังไม่มีรางวัล
        return null
      })
    } catch (error: any) {
      console.error('Error in check-in transaction:', error)
      return NextResponse.json(
        {
          error: 'ไม่สามารถเช็คอินได้',
          message: error.message || 'กรุณาลองใหม่อีกครั้ง'
        },
        { status: 500 }
      )
    }

    // บันทึก device check-in เพื่อป้องกันการเช็คอินซ้ำ
    try {
      // ใช้เฉพาะ hardware fingerprint เท่านั้น (ไม่ใช้ IP) เพื่อป้องกันเครื่องอื่นใน network เดียวกันถูก detect เป็นเครื่องเดียวกัน
      const primaryFingerprint = hwFingerprint || deviceFingerprint
      const deviceSignature = primaryFingerprint // ใช้ hardware fingerprint โดยตรง (ไม่รวม IP)
      
      // บันทึกลงตาราง device_checkin พร้อม state (ถ้ามี columns)
      try {
        // ลองบันทึกพร้อม state columns ก่อน (รวม hwFingerprint)
        try {
          const insertDeviceSql = `
            INSERT INTO device_checkin (
              device_signature, hwFingerprint, device_id, staffid, ip_address, user_agent,
              feedback_submitted, checked_in,
              employee_staffid, employee_name, employee_reward, user_group
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              hwFingerprint = VALUES(hwFingerprint),
              staffid = VALUES(staffid),
              feedback_submitted = VALUES(feedback_submitted),
              checked_in = VALUES(checked_in),
              employee_staffid = VALUES(employee_staffid),
              employee_name = VALUES(employee_name),
              employee_reward = VALUES(employee_reward),
              user_group = VALUES(user_group),
              updated_at = CURRENT_TIMESTAMP
          `
          await query(insertDeviceSql, [
            deviceSignature,
            primaryFingerprint, // hwFingerprint
            deviceId,
            staffid.trim(),
            clientIp,
            userAgent.substring(0, 500),
            staffid.trim(),
            name.trim(),
            null, // employee_reward (ยังไม่มีรางวัล)
            userData?.group || null
          ])
          console.log('Device check-in saved with hwFingerprint:', primaryFingerprint)
        } catch (error: any) {
          // ถ้าไม่มี columns ใหม่ ให้ใช้แบบเดิม
          if (error.message?.includes('Unknown column')) {
            const insertDeviceSql = `
              INSERT INTO device_checkin (device_signature, device_id, staffid, ip_address, user_agent)
              VALUES (?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE staffid = VALUES(staffid), created_at = CURRENT_TIMESTAMP
            `
            await query(insertDeviceSql, [
              deviceSignature,
              deviceId,
              staffid.trim(),
              clientIp,
              userAgent.substring(0, 500)
            ])
          } else {
            throw error
          }
        }
      } catch (error) {
        // ถ้าตาราง device_checkin ยังไม่มี ให้ข้ามไป
        console.log('Table device_checkin may not exist, skipping device check-in record')
      }
    } catch (error) {
      console.error('Error saving device check-in:', error)
      // ไม่ throw error เพราะ check-in สำเร็จแล้ว
    }

    // ไม่มีการสุ่มรางวัลในขั้นตอนนี้แล้ว
    // รางวัลจะถูกสุ่มเมื่อผู้ใช้กดปุ่ม "สุ่มรางวัล" ใน frontend
    
    // เช็ค rewardid จากตาราง user เพื่อดูว่าเคยสุ่มแล้วหรือยัง
    const rewardid = userData?.rewardid || null

    const response = NextResponse.json(
      {
        message: 'Checkin inserted successfully',
        reward: null, // ยังไม่มีรางวัล
        group: userData?.group || null,
        rewardid: rewardid, // ส่ง rewardid กลับไปด้วย
        hasReward: false // บอก frontend ว่ายังไม่มีรางวัล
      },
      { status: 200 }
    )

    // ตั้งค่า HttpOnly cookie เพื่อล็อก device (ช่วยกันล้าง localStorage)
    if (deviceId) {
      try {
        response.cookies.set('ny2026_device', deviceId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
          path: '/',
          maxAge: 60 * 60 * 24 // 1 day
        })
      } catch (error) {
        console.error('Error setting device cookie:', error)
      }
    }

    return response
  } catch (error: any) {
    console.error('Error in check-in API:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to check in',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method to retrieve check-ins (optional, for admin)
export async function GET() {
  try {
    const sql = 'SELECT * FROM checkinlog ORDER BY recordid DESC LIMIT 100'
    const results = await query(sql)
    
    return NextResponse.json(
      {
        success: true,
        data: results
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching check-ins:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to fetch check-ins',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

