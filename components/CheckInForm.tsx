'use client'

import { useState, useEffect } from 'react'
import { User, Hash, LogIn, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { isDeviceCheckedIn, checkIncognitoModeSync, ensureDeviceId } from '@/utils/device'
import { getDeviceFingerprint } from '@/utils/incognito'
import { getAdvancedFingerprint } from '@/utils/browserFingerprint'
import { getHardwareFingerprint } from '@/utils/hardwareFingerprint'

interface CheckInFormProps {
  onSubmit: (data: { staffid: string; name: string; reward?: string | { name?: string; addon?: string }; group?: number; rewardid?: number | null; deviceId?: string }) => void
}

export default function CheckInForm({ onSubmit }: CheckInFormProps) {
  const [formData, setFormData] = useState({
    staffid: '',
    name: ''
  })
  const [errors, setErrors] = useState({
    staffid: '',
    name: '',
    submit: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [deviceAlreadyCheckedIn, setDeviceAlreadyCheckedIn] = useState(false)
  const [isIncognito, setIsIncognito] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // ตรวจสอบว่า device นี้เคยเช็คอินแล้วหรือยัง และตรวจสอบ incognito mode
  useEffect(() => {
    const incognitoDetected = checkIncognitoModeSync()
    setIsIncognito(incognitoDetected)
    
    if (incognitoDetected) {
      return
    }
    
    try {
      const alreadyCheckedIn = isDeviceCheckedIn()
      setDeviceAlreadyCheckedIn(alreadyCheckedIn)
    } catch (error: any) {
      if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
        setIsIncognito(true)
      }
    }
  }, [])

  // Auto-search เมื่อกรอกรหัสพนักงานครบ 5 หลัก
  useEffect(() => {
    const searchStaff = async () => {
      if (formData.staffid.length >= 5 && /^\d+$/.test(formData.staffid)) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/user?staffid=${formData.staffid}`)
          const data = await res.json()
          
          if (data.success && data.data) {
            // พบรหัสพนักงาน ให้ดึงชื่อมาแสดง
            setFormData(prev => ({
              ...prev,
              name: data.data.staffname || ''
            }))
            setErrors(prev => ({
              ...prev,
              staffid: ''
            }))
          } else {
            // ไม่พบรหัสพนักงาน
            setErrors(prev => ({
              ...prev,
              staffid: 'ไม่พบรหัสพนักงานในระบบ'
            }))
            setFormData(prev => ({
              ...prev,
              name: ''
            }))
          }
        } catch (error) {
          console.error('Error searching staff:', error)
          // ไม่แสดง error ถ้า network error
        } finally {
          setIsSearching(false)
        }
      } else if (formData.staffid.length < 5) {
        // ถ้ายังไม่ครบ 5 หลัก ให้ล้างชื่อ
        setFormData(prev => ({
          ...prev,
          name: ''
        }))
        setErrors(prev => ({
          ...prev,
          staffid: ''
        }))
      }
    }
    
    // Debounce search เพื่อไม่ให้ search บ่อยเกินไป
    const timeoutId = setTimeout(() => {
      searchStaff()
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [formData.staffid])

  const validate = () => {
    const newErrors = {
      staffid: '',
      name: '',
      submit: ''
    }

    if (!formData.staffid.trim()) {
      newErrors.staffid = 'กรุณากรอกรหัสพนักงาน'
    } else if (!/^\d+$/.test(formData.staffid.trim())) {
      newErrors.staffid = 'รหัสพนักงานต้องเป็นตัวเลขเท่านั้น'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อ'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'
    }

    setErrors(newErrors)
    return !newErrors.staffid && !newErrors.name
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ตรวจสอบ incognito mode
    if (checkIncognitoModeSync()) {
      setIsIncognito(true)
      setErrors(prev => ({
        ...prev,
        submit: 'ไม่สามารถใช้งานได้ในโหมดไม่ระบุตัวตน กรุณาปิดโหมดไม่ระบุตัวตนและใช้โหมดปกติ'
      }))
      return
    }
    
    // ตรวจสอบว่า device นี้เคยเช็คอินแล้วหรือยัง
    try {
      if (isDeviceCheckedIn()) {
        setDeviceAlreadyCheckedIn(true)
        setErrors(prev => ({
          ...prev,
          submit: 'เครื่องมือถือนี้ได้ทำการเช็คอินไปแล้ว กรุณาใช้เครื่องมือถืออื่น'
        }))
        return
      }
    } catch (error: any) {
      if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
        setIsIncognito(true)
        setErrors(prev => ({
          ...prev,
          submit: 'ไม่สามารถใช้งานได้ในโหมดไม่ระบุตัวตน กรุณาปิดโหมดไม่ระบุตัวตนและใช้โหมดปกติ'
        }))
        return
      }
    }
    
    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    setErrors(prev => ({ ...prev, submit: '' }))
    setSubmitSuccess(false)

    try {
      const deviceId = ensureDeviceId()
      // ใช้ hardware fingerprint ที่เสถียรข้าม browser (ส่ง deviceId ไปด้วยเพื่อเพิ่ม uniqueness)
      const hwFingerprint = getHardwareFingerprint(deviceId)
      const deviceFingerprint = await getAdvancedFingerprint() || getDeviceFingerprint()

      const payload = {
        staffid: formData.staffid.trim(),
        name: formData.name.trim(),
        deviceId,
        hwFingerprint, // Hardware fingerprint (เสถียรข้าม browser)
        deviceFingerprint // Advanced fingerprint (สำหรับ fallback)
      }

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        let errorMessage = errorData.error || `HTTP error! status: ${response.status}`
        
        // แสดงข้อความที่เหมาะสมตาม status code
        if (response.status === 404) {
          errorMessage = 'รหัสพนักงานไม่พบในระบบ กรุณาตรวจสอบรหัสพนักงานอีกครั้ง'
          // แสดง error ที่ field staffid ด้วย
          setErrors(prev => ({
            ...prev,
            staffid: 'รหัสพนักงานไม่พบในระบบ',
            submit: errorMessage
          }))
          setIsSubmitting(false)
          return
        } else if (response.status === 409) {
          // 409 Conflict - รหัสพนักงานเช็คอินไปแล้ว
          errorMessage = errorData.error || errorData.message || 'รหัสพนักงานนี้ได้ทำการเช็คอินไปแล้ว'
          setErrors(prev => ({
            ...prev,
            staffid: 'รหัสพนักงานนี้ได้ทำการเช็คอินไปแล้ว',
            submit: errorMessage
          }))
          setIsSubmitting(false)
          return
        } else if (response.status === 429) {
          // 429 Too Many Requests - Rate limit
          errorMessage = errorData.error || errorData.message || 'มีการส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
          setErrors(prev => ({
            ...prev,
            submit: errorMessage
          }))
          setIsSubmitting(false)
          return
        } else if (response.status === 400) {
          errorMessage = errorData.error || 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลอีกครั้ง'
        } else if (response.status === 500) {
          errorMessage = errorData.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Check-in submitted successfully:', data)
      
      // ตรวจสอบอีกครั้งก่อนเรียก onSubmit
      if (isDeviceCheckedIn()) {
        setDeviceAlreadyCheckedIn(true)
        setErrors(prev => ({
          ...prev,
          submit: 'เครื่องมือถือนี้ได้ทำการเช็คอินไปแล้ว กรุณาใช้เครื่องมือถืออื่น'
        }))
        setIsSubmitting(false)
        return
      }
      
      setSubmitSuccess(true)
      
      // เรียก onSubmit หลังจากส่งข้อมูลสำเร็จ พร้อม reward, group และ rewardid จาก API
      setTimeout(() => {
        onSubmit({
          staffid: formData.staffid.trim(),
          name: formData.name.trim(),
          reward: data.reward ? {
            name: data.reward.name || undefined,
            addon: data.reward.addon || undefined
          } : undefined,
          group: data.group || undefined,
          rewardid: data.rewardid !== undefined ? data.rewardid : undefined, // ส่ง rewardid ไปด้วย
          deviceId
        })
      // Reset form
        setFormData({ staffid: '', name: '' })
      }, 500)

    } catch (error) {
      console.error('Error submitting check-in:', error)
      let errorMessage = 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง'
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ'
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      }
      
      setErrors(prev => ({
        ...prev,
        submit: errorMessage
      }))
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // ถ้าเป็น staffid ให้กรองให้เหลือเฉพาะตัวเลข
    if (name === 'staffid') {
      const numericValue = value.replace(/\D/g, '')
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    }
    
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // ถ้าเป็น incognito mode แสดงข้อความเตือน
  if (isIncognito) {
    return (
      <div className="card-cream border-copper-400/50 rounded-2xl p-8 relative overflow-hidden">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-copper-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif-thai font-bold text-copper-600 mb-2">
            ไม่สามารถใช้งานได้
          </h2>
          <p className="text-ink/80 mb-2">
            ตรวจพบว่าคุณกำลังใช้โหมดไม่ระบุตัวตน (Incognito/Private Mode)
          </p>
          <p className="text-sm text-ink/60 mb-4">
            เพื่อป้องกันการเช็คอินซ้ำ กรุณาปิดโหมดไม่ระบุตัวตนและใช้โหมดปกติ
          </p>
          <div className="bg-copper-300/10 border border-copper-400/40 rounded-lg p-4 text-left">
            <p className="text-copper-700 text-sm font-semibold mb-2">วิธีแก้ไข:</p>
            <ul className="text-ink/75 text-xs space-y-1 list-disc list-inside">
              <li>ปิดแท็บ/หน้าต่างโหมดไม่ระบุตัวตน</li>
              <li>เปิดเบราว์เซอร์ในโหมดปกติ</li>
              <li>สแกน QR code อีกครั้ง</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ถ้า device เช็คอินแล้ว แสดงข้อความเตือน
  if (deviceAlreadyCheckedIn) {
    return (
      <div className="card-cream border-copper-400/50 rounded-2xl p-8 relative overflow-hidden">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-copper-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif-thai font-bold text-copper-600 mb-2">
            ไม่สามารถเช็คอินได้
          </h2>
          <p className="text-ink/80 mb-4">
            เครื่องมือถือนี้ได้ทำการเช็คอินไปแล้ว
          </p>
          <p className="text-sm text-ink/60">
            กรุณาใช้เครื่องมือถืออื่นหรือติดต่อเจ้าหน้าที่
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-cream rounded-2xl p-8 relative overflow-hidden">
      {/* Glowing border effect */}
      <div className="absolute top-0 left-0 right-0 h-[2px] brass-rule"></div>
      
      <div className="relative z-10">
      <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-brass-500" />
            <h2 className="text-2xl font-serif-thai font-bold text-brass">
          เช็คอินเข้างาน
        </h2>
          </div>
          <p className="text-ink/60">
          กรุณากรอกข้อมูลของคุณเพื่อเช็คอินเข้างานปีใหม่
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Staff ID Field */}
        <div>
            <label htmlFor="staffid" className="block text-sm font-semibold text-ink/80 mb-2">
              รหัสพนักงาน <span className="text-copper-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Hash className="h-5 w-5 text-brass-500" />
            </div>
            <input
              type="text"
                id="staffid"
                name="staffid"
                value={formData.staffid}
              onChange={handleChange}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                className={`block w-full pl-10 pr-10 py-3 input-cream ${
                  errors.staffid 
                    ? '!border-copper-400' 
                    : ''
                } rounded-lg focus:outline-none transition-all`}
                placeholder="กรอกรหัสพนักงาน 5-6 หลัก #64005"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Loader2 className="w-4 h-4 text-brass-500 animate-spin" />
                </div>
              )}
              {formData.staffid && !errors.staffid && !isSearching && formData.staffid.length >= 5 && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <CheckCircle2 className="w-4 h-4 text-patina-500" />
                </div>
              )}
          </div>
            {errors.staffid && (
              <p className="mt-1 text-sm text-copper-600 flex items-center gap-1">
                <span>⚠️</span>
                {errors.staffid}
              </p>
          )}
        </div>

        {/* Name Field */}
        <div>
            <label htmlFor="name" className="block text-sm font-semibold text-ink/80 mb-2">
              ชื่อ-นามสกุล <span className="text-copper-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-patina-500" />
            </div>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
                className={`block w-full pl-10 pr-3 py-3 input-cream ${
                  errors.name 
                    ? '!border-copper-400' 
                    : ''
                } rounded-lg focus:outline-none transition-all`}
              placeholder="เช่น สมชาย ใจดี"
            />
              {formData.name && !errors.name && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="w-2 h-2 bg-patina-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-copper-600 flex items-center gap-1">
                <span>⚠️</span>
                {errors.name}
              </p>
            )}
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-copper-300/10 border border-copper-400/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-copper-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-copper-600 font-medium">เกิดข้อผิดพลาด</p>
                <p className="text-xs text-ink/70 mt-1">{errors.submit}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-patina-50 border border-patina-300 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-patina-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-patina-700 font-medium">เช็คอินสำเร็จ!</p>
                <p className="text-xs text-patina-600 mt-1">กำลังบันทึกข้อมูล...</p>
              </div>
        </div>
          )}

        {/* Submit Button */}
        <button
          type="submit"
            disabled={isSubmitting || submitSuccess}
            className="w-full btn-brass disabled:cursor-not-allowed font-semibold text-lg py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden group"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 relative z-10 animate-spin" />
                <span className="relative z-10">กำลังเช็คอิน...</span>
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle2 className="w-5 h-5 relative z-10" />
                <span className="relative z-10">เช็คอินสำเร็จ</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 relative z-10" />
                <span className="relative z-10">เช็คอินเข้างาน</span>
              </>
            )}
        </button>
      </form>

        <div className="mt-6 pt-6 border-t border-brass-400/25">
          <p className="text-xs text-ink/50 text-center flex items-center justify-center gap-2">
            <span className="w-1 h-1 bg-brass-400 rounded-full"></span>
          ข้อมูลของคุณจะถูกบันทึกเพื่อการเข้างานเท่านั้น
            <span className="w-1 h-1 bg-brass-400 rounded-full"></span>
        </p>
        </div>
      </div>
    </div>
  )
}

