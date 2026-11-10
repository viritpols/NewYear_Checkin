// Device identification utility for preventing duplicate check-ins

import { isIncognitoMode, isLocalStorageAvailable, getDeviceFingerprint } from './incognito'

const DEVICE_ID_KEY = 'newyear2026_device_id'
const DEVICE_CHECKIN_KEY = 'newyear2026_device_checkin'
const DEVICE_FINGERPRINT_KEY = 'newyear2026_device_fingerprint'

// ตรวจสอบว่าเป็น incognito mode หรือไม่
export const checkIncognitoMode = async (): Promise<boolean> => {
  return await isIncognitoMode()
}

// Synchronous version สำหรับใช้ในที่ที่ไม่สามารถใช้ async ได้
export const checkIncognitoModeSync = (): boolean => {
  // ใช้วิธีตรวจสอบแบบ sync เท่านั้น
  if (typeof window === 'undefined') return false
  try {
    if (!isLocalStorageAvailable()) return true
    const test = '__sync_test__'
    localStorage.setItem(test, test)
    const retrieved = localStorage.getItem(test)
    localStorage.removeItem(test)
    return retrieved !== test
  } catch {
    return true
  }
}

// สร้างหรือดึง Device ID
export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return ''

  // ตรวจสอบ incognito mode ก่อน (ใช้ sync version)
  if (checkIncognitoModeSync()) {
    console.error('🚫 ตรวจพบ incognito/private mode - ไม่สามารถใช้งานได้')
    throw new Error('INCOGNITO_MODE_DETECTED')
  }

  if (!isLocalStorageAvailable()) {
    console.error('🚫 localStorage ไม่สามารถใช้งานได้')
    throw new Error('STORAGE_UNAVAILABLE')
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    const storedFingerprint = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    const currentFingerprint = getDeviceFingerprint()
    
    if (!deviceId) {
      // สร้าง unique device ID
      // ใช้ combination ของ timestamp + random + user agent hash + fingerprint
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 15)
      const userAgent = navigator.userAgent.substring(0, 10)
      const screenInfo = `${window.screen.width}x${window.screen.height}`
      
      // สร้าง hash แบบง่าย
      const hash = btoa(`${timestamp}-${random}-${userAgent}-${screenInfo}-${currentFingerprint}`)
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 32)
      
      deviceId = `device_${timestamp}_${hash}`
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
      localStorage.setItem(DEVICE_FINGERPRINT_KEY, currentFingerprint)
      console.log('📱 สร้าง Device ID ใหม่:', deviceId)
    } else {
      // ตรวจสอบว่า fingerprint ยังตรงกันหรือไม่
      if (storedFingerprint && storedFingerprint !== currentFingerprint) {
        console.warn('⚠️ Device fingerprint เปลี่ยนไป - อาจเป็น incognito mode หรือ device ใหม่')
        // ยังคงใช้ device ID เดิม แต่จะตรวจสอบอีกครั้งใน isDeviceCheckedIn
      }
      console.log('📱 ใช้ Device ID เดิม:', deviceId)
    }
    
    return deviceId
  } catch (error: any) {
    console.error('Error getting device ID:', error)
    
    // ถ้าเป็น incognito mode ให้ throw error
    if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
      throw error
    }
    
    // Fallback: ใช้ timestamp + random (แต่จะไม่สามารถใช้งานได้จริงใน incognito mode)
    const fallbackId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    console.log('📱 ใช้ Device ID fallback:', fallbackId)
    return fallbackId
  }
}

// Helper สำหรับ ensure ว่ามี deviceId เสมอ (throw เมื่อ incognito หรือ storage ใช้ไม่ได้)
export const ensureDeviceId = (): string => {
  return getDeviceId()
}

// ตรวจสอบว่า device นี้เคยเช็คอินแล้วหรือยัง
export const isDeviceCheckedIn = (): boolean => {
  if (typeof window === 'undefined') return false

  // ตรวจสอบ incognito mode ก่อน (ใช้ sync version)
  if (checkIncognitoModeSync()) {
    console.error('🚫 ตรวจพบ incognito/private mode - ไม่สามารถตรวจสอบสถานะได้')
    return false
  }

  if (!isLocalStorageAvailable()) {
    console.error('🚫 localStorage ไม่สามารถใช้งานได้')
    return false
  }

  try {
    const checkinData = localStorage.getItem(DEVICE_CHECKIN_KEY)
    if (!checkinData) {
      console.log('🔍 ไม่พบข้อมูลการเช็คอิน')
      return false
    }

    const data = JSON.parse(checkinData)
    
    // ตรวจสอบ device fingerprint
    const storedFingerprint = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    const currentFingerprint = getDeviceFingerprint()
    
    if (storedFingerprint && storedFingerprint !== currentFingerprint) {
      console.warn('⚠️ Device fingerprint ไม่ตรงกัน - อาจเป็น incognito mode')
      // ลบข้อมูลเก่า
      clearDeviceCheckIn()
      return false
    }
    
    let deviceId: string
    try {
      deviceId = getDeviceId()
    } catch (error: any) {
      if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
        console.error('🚫 ไม่สามารถใช้งานได้เนื่องจาก incognito mode')
        return false
      }
      throw error
    }
    
    console.log('🔍 ตรวจสอบ Device Check-in:', {
      storedDeviceId: data.deviceId,
      currentDeviceId: deviceId,
      checkedIn: data.checkedIn,
      timestamp: new Date(data.timestamp).toLocaleString('th-TH')
    })
    
    // ตรวจสอบว่า device ID ตรงกันและยังไม่หมดอายุ (24 ชั่วโมง)
    if (data.deviceId === deviceId && data.checkedIn) {
      const expiryTime = data.timestamp + (24 * 60 * 60 * 1000) // 24 hours
      const now = Date.now()
      if (now < expiryTime) {
        console.log('✅ Device นี้เช็คอินแล้ว (ยังไม่หมดอายุ)')
        return true
      } else {
        // หมดอายุแล้ว ลบข้อมูล
        console.log('⏰ ข้อมูลการเช็คอินหมดอายุแล้ว')
        clearDeviceCheckIn()
        return false
      }
    }
    
    console.log('❌ Device ID ไม่ตรงกันหรือยังไม่เช็คอิน')
    return false
  } catch (error: any) {
    console.error('Error checking device check-in status:', error)
    if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
      return false
    }
    return false
  }
}

// บันทึกว่า device นี้เช็คอินแล้ว
export const setDeviceCheckedIn = (): void => {
  if (typeof window === 'undefined') return

  // ตรวจสอบ incognito mode ก่อน (ใช้ sync version)
  if (checkIncognitoModeSync()) {
    console.error('🚫 ตรวจพบ incognito/private mode - ไม่สามารถบันทึกข้อมูลได้')
    throw new Error('INCOGNITO_MODE_DETECTED')
  }

  if (!isLocalStorageAvailable()) {
    console.error('🚫 localStorage ไม่สามารถใช้งานได้')
    throw new Error('STORAGE_UNAVAILABLE')
  }

  try {
    const deviceId = getDeviceId()
    const fingerprint = getDeviceFingerprint()
    
    const checkinData = {
      deviceId,
      fingerprint,
      checkedIn: true,
      timestamp: Date.now()
    }
    
    localStorage.setItem(DEVICE_CHECKIN_KEY, JSON.stringify(checkinData))
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint)
    
    console.log('💾 บันทึกการเช็คอินของ Device:', {
      deviceId,
      fingerprint,
      timestamp: new Date(checkinData.timestamp).toLocaleString('th-TH')
    })
  } catch (error: any) {
    console.error('Error setting device check-in:', error)
    if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
      throw error
    }
  }
}

// ลบข้อมูลการเช็คอินของ device
export const clearDeviceCheckIn = (): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(DEVICE_CHECKIN_KEY)
    localStorage.removeItem(DEVICE_FINGERPRINT_KEY)
  } catch (error) {
    console.error('Error clearing device check-in:', error)
  }
}

// ดึงข้อมูลการเช็คอินของ device
export const getDeviceCheckInData = (): { deviceId: string; checkedIn: boolean; timestamp: number } | null => {
  if (typeof window === 'undefined') return null

  try {
    const checkinData = localStorage.getItem(DEVICE_CHECKIN_KEY)
    if (!checkinData) return null

    return JSON.parse(checkinData)
  } catch (error) {
    console.error('Error getting device check-in data:', error)
    return null
  }
}

