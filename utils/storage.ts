// Utility functions for localStorage management

const STORAGE_KEY = 'newyear2026_checkin_state'
const STORAGE_EXPIRY_KEY = 'newyear2026_checkin_expiry'
const EXPIRY_HOURS = 24 // ข้อมูลจะหมดอายุหลังจาก 24 ชั่วโมง

export interface CheckInState {
  feedbackSubmitted: boolean
  checkedIn: boolean
  employeeData: {
    staffid: string
    name: string
    reward: string
    addon?: string
    checkinTime?: string
  }
  feedbackData: {
    comment: string
    rating?: number
  } | null
  userGroup?: number | null
  timestamp: number
}

// ตรวจสอบว่า localStorage ใช้งานได้หรือไม่
const isStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

// โหลด state จาก localStorage
export const loadState = (): CheckInState | null => {
  if (!isStorageAvailable()) return null

  try {
    const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY)
    if (expiry) {
      const expiryTime = parseInt(expiry, 10)
      if (Date.now() > expiryTime) {
        // ข้อมูลหมดอายุแล้ว ลบออก
        clearState()
        return null
      }
    }

    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      return JSON.parse(savedState) as CheckInState
    }
  } catch (error) {
    console.error('Error loading state from localStorage:', error)
  }

  return null
}

// บันทึก state ลง localStorage
export const saveState = (state: Partial<CheckInState>): void => {
  if (!isStorageAvailable()) return

  try {
    const currentState = loadState() || {
      feedbackSubmitted: false,
      checkedIn: false,
      employeeData: { staffid: '', name: '', reward: '', addon: '', checkinTime: '' },
      feedbackData: null,
      userGroup: null,
      timestamp: Date.now()
    }

    const newState: CheckInState = {
      ...currentState,
      ...state,
      timestamp: Date.now()
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    
    // ตั้งค่า expiry time
    const expiryTime = Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000)
    localStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString())
  } catch (error) {
    console.error('Error saving state to localStorage:', error)
  }
}

// ลบ state จาก localStorage
export const clearState = (): void => {
  if (!isStorageAvailable()) return

  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_EXPIRY_KEY)
  } catch (error) {
    console.error('Error clearing state from localStorage:', error)
  }
}

// ตรวจสอบว่า state ยังใช้งานได้หรือไม่
export const isStateValid = (): boolean => {
  if (!isStorageAvailable()) return false

  try {
    const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY)
    if (expiry) {
      const expiryTime = parseInt(expiry, 10)
      return Date.now() <= expiryTime
    }
  } catch {
    return false
  }

  return false
}

