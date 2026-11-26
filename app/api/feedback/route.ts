import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { cookies } from 'next/headers'
import { checkAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { starrate, comment, deviceId, deviceFingerprint } = body

    // ดึง IP address และ User-Agent
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     request.headers.get('x-real-ip') || 
                     request.ip ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Validate input
    if (!comment || typeof comment !== 'string' || comment.trim().length < 10) {
      return NextResponse.json(
        { error: 'Comment is required and must be at least 10 characters' },
        { status: 400 }
      )
    }

    const starRate = starrate ? parseInt(starrate, 10) : 0
    if (starRate < 0 || starRate > 5) {
      return NextResponse.json(
        { error: 'Star rate must be between 0 and 5' },
        { status: 400 }
      )
    }

    console.log(starRate, comment)

    // Insert feedback into database
    const sql = `
      INSERT INTO feedback (starrate, comment)
      VALUES (?, ?)
    `
    
    const result = await query(sql, [starRate, comment.trim()])

    // บันทึก state ลง device_checkin เมื่อ submit feedback
    if (deviceFingerprint && deviceId) {
      try {
        const deviceSignatureRaw = `${deviceFingerprint}_${clientIp}_${userAgent.substring(0, 100)}`
        let hash = 0
        for (let i = 0; i < deviceSignatureRaw.length; i++) {
          const char = deviceSignatureRaw.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash & hash
        }
        const deviceSignature = Math.abs(hash).toString(36)
        
        try {
          const updateDeviceSql = `
            UPDATE device_checkin 
            SET feedback_submitted = 1, updated_at = CURRENT_TIMESTAMP
            WHERE device_signature = ? OR device_id = ?
          `
          await query(updateDeviceSql, [deviceSignature, deviceId])
        } catch (error: any) {
          // ถ้าไม่มี columns ใหม่ ให้ข้ามไป
          if (!error.message?.includes('Unknown column')) {
            console.error('Error updating device feedback state:', error)
          }
        }
      } catch (error) {
        console.error('Error saving device feedback state:', error)
      }
    }

    return NextResponse.json(
      {
        message: 'Feedback inserted successfully'
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in feedback API:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method to retrieve feedbacks — เฉพาะ admin (ต้องมี x-api-key)
export async function GET(request: NextRequest) {
  const denied = checkAdmin(request)
  if (denied) return denied

  try {
    const sql = 'SELECT * FROM feedback LIMIT 100'
    const results = await query(sql)

    return NextResponse.json(
      {
        success: true,
        data: results
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching feedbacks:', error)

    return NextResponse.json(
      { error: 'Failed to fetch feedbacks' },
      { status: 500 }
    )
  }
}

