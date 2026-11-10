'use client'

import { useState, useEffect, Suspense } from 'react'
import CheckInForm from '@/components/CheckInForm'
import Header from '@/components/Header'
import { Calendar, CheckCircle, Sparkles, AlertCircle } from 'lucide-react'
import { loadState, saveState, clearState } from '@/utils/storage'
import { getDeviceId, isDeviceCheckedIn, setDeviceCheckedIn, getDeviceCheckInData, checkIncognitoModeSync } from '@/utils/device'
import { getDeviceFingerprint } from '@/utils/incognito'
import { getAdvancedFingerprint, getDeviceSignature } from '@/utils/browserFingerprint'
import { getHardwareFingerprint } from '@/utils/hardwareFingerprint'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatThaiDateTime } from '@/utils/date'
import RewardAnimation from '@/components/RewardAnimation'

// 6 สีที่กำหนดไว้สำหรับที่รัดข้อมือ (ใช้ rgba สำหรับ opacity)
// group 1-6 แมปกับสีตามลำดับ
const colorPalette = [
  { name: 'เขียว', rgb: 'rgba(34, 197, 94, 1)' },      // Group 1 - สีเขียวสด
  { name: 'ส้ม', rgb: 'rgba(249, 115, 22, 1)' },      // Group 2 - สีส้ม
  { name: 'เหลือง', rgb: 'rgba(250, 204, 21, 1)' },   // Group 3 - สีเหลือง
  { name: 'ชมพู', rgb: 'rgba(236, 72, 153, 1)' },     // Group 4 - สีชมพู
  { name: 'ม่วง', rgb: 'rgba(168, 85, 247, 1)' },     // Group 5 - สีม่วง
  { name: 'ฟ้า', rgb: 'rgba(14, 165, 233, 1)' }        // Group 6 - สีฟ้า
]

// ฟังก์ชันสำหรับแปลง group (1-6) เป็นสี
const getColorFromGroup = (group: number | null): { rgb: string; name: string } | null => {
  if (!group || group < 1 || group > 6) {
    return null
  }
  return colorPalette[group - 1] // group 1 = index 0, group 2 = index 1, ...
}

// Component ที่ใช้ useSearchParams (ต้อง wrap ด้วย Suspense)
function HomeContent() {
  const [checkedIn, setCheckedIn] = useState(false)
  const [employeeData, setEmployeeData] = useState({ staffid: '', name: '', reward: '', addon: '', checkinTime: '' })
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedColorName, setSelectedColorName] = useState<string | null>(null)
  const [userGroup, setUserGroup] = useState<number | null>(null)
  const [deviceAlreadyCheckedIn, setDeviceAlreadyCheckedIn] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [isIncognito, setIsIncognito] = useState(false)
  const [allRewards, setAllRewards] = useState<any[]>([])
  const [showRewardAnimation, setShowRewardAnimation] = useState(false)
  const [hasShownAnimation, setHasShownAnimation] = useState(false)
  const [hasRemainingRewards, setHasRemainingRewards] = useState<boolean | null>(null)
  const [rewardError, setRewardError] = useState<string | null>(null)
  const [hasSpun, setHasSpun] = useState(false) // เช็คว่าเคยสุ่มแล้วหรือยัง

  const searchParams = useSearchParams()
  const router = useRouter()

  // ตรวจสอบ token จาก QR
  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setTokenError('ไม่พบโทเค็นจาก QR')
      setTokenChecked(true)
      return
    }

    const verifyToken = async () => {
      try {
        const res = await fetch('/api/qr/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        const data = await res.json()
        if (data.valid) {
          setTokenValid(true)
          setTokenError(null)
        } else {
          setTokenValid(false)
          setTokenError('QR นี้หมดอายุแล้ว กรุณาสแกน QR ล่าสุด')
        }
      } catch (error) {
        console.error('Error verifying token', error)
        setTokenError('ไม่สามารถตรวจสอบโทเค็นได้')
      } finally {
        setTokenChecked(true)
      }
    }

    verifyToken()
  }, [searchParams])

  // ตั้งค่าสีจาก group เมื่อ check-in สำเร็จ
  useEffect(() => {
    if (checkedIn && userGroup && !selectedColor) {
      const colorInfo = getColorFromGroup(userGroup)
      if (colorInfo) {
        console.log('🎨 สีจาก group:', userGroup, colorInfo.name, colorInfo.rgb)
        setSelectedColor(colorInfo.rgb)
        setSelectedColorName(colorInfo.name)
      }
    }
  }, [checkedIn, userGroup, selectedColor])

  // รีเซ็ตสีเมื่อ check-in เป็น false
  useEffect(() => {
    if (!checkedIn && selectedColor) {
      setSelectedColor(null)
      setSelectedColorName(null)
      setUserGroup(null)
    }
  }, [checkedIn, selectedColor])

  // ตรวจสอบ device guard จากฝั่งเซิร์ฟเวอร์ก่อน (สำคัญที่สุด - ต้องทำก่อน useEffect อื่นๆ)
  useEffect(() => {
    const runGuard = async () => {
      try {
        // ตรวจสอบ incognito mode ก่อน
        const incognitoDetected = checkIncognitoModeSync()
        setIsIncognito(incognitoDetected)
        
        if (incognitoDetected) {
          console.error('🚫 ตรวจพบ incognito/private mode')
          setIsLoaded(true)
          return
        }

        // ใช้ hardware fingerprint ที่เสถียรข้าม browser
        // ส่ง deviceId ไปด้วยเพื่อเพิ่ม uniqueness
        let deviceId = ''
        try {
          deviceId = getDeviceId()
        } catch (error: any) {
          // ถ้า incognito จะไม่มี deviceId
        }
        const hardwareFingerprint = getHardwareFingerprint(deviceId)
        const advancedFingerprint = await getAdvancedFingerprint() || getDeviceFingerprint()

        const res = await fetch(`/api/checkin/device?hwFingerprint=${encodeURIComponent(hardwareFingerprint)}&fingerprint=${encodeURIComponent(advancedFingerprint)}&deviceId=${encodeURIComponent(deviceId || '')}`)
        if (!res.ok) {
          setIsLoaded(true)
          return
        }
        const data = await res.json()
        if (data.alreadyUsed) {
          setDeviceAlreadyCheckedIn(true)
          
          // ใช้ state จาก API เพื่อ redirect ไปขั้นตอนล่าสุด
          if (data.checkedIn !== undefined) {
            setCheckedIn(data.checkedIn)
          }
          
          // ถ้ามีข้อมูล check-in แล้ว ให้โหลดสถานะล่าสุด
          if (data.staffid) {
            // เช็ค rewardid: null = ยังไม่สุ่ม, 0 = สุ่มแล้วแต่ไม่ได้รับ, >0 = ได้รับรางวัล
            const rewardid = data.rewardid
            let rewardName = ''
            let rewardAddon = ''
            
            if (rewardid === 0) {
              // สุ่มแล้วแต่ไม่ได้รับรางวัล
              rewardName = 'อุ๊ย! รอบนี้ยังไม่ได้นะ 😄'
            } else if (rewardid && rewardid > 0) {
              // ได้รับรางวัล
              rewardName = data.reward?.name || ''
              rewardAddon = data.reward?.addon || ''
            } else if (data.reward?.name) {
              // Fallback: ใช้ reward จาก device_checkin (กรณีเก่า)
              rewardName = data.reward.name
              rewardAddon = data.reward.addon || ''
            }
            
            setEmployeeData({
              staffid: data.staffid,
              name: data.name || '',
              reward: rewardName,
              addon: rewardAddon,
              checkinTime: data.checkinTime || ''
            })
            // ถ้ามีรางวัลอยู่แล้ว (ไม่ว่าจะได้รับหรือไม่ได้รับ) แสดงว่าเคยเช็คอินแล้ว ไม่ต้องแสดง animation
            if (rewardid !== null && rewardid !== undefined) {
              setHasShownAnimation(true)
              setHasSpun(true) // เคยสุ่มแล้ว - จะแสดงรางวัลแทนปุ่ม
              
              // ถ้ายังไม่มี reward name แต่มี rewardid > 0 ให้ดึงข้อมูลรางวัล
              if (rewardid > 0 && !rewardName) {
                // ดึงข้อมูลรางวัลจาก API
                fetch(`/api/user?staffid=${data.staffid}`)
                  .then(res => res.json())
                  .then(userData => {
                    if (userData.success && userData.data && userData.data.reward) {
                      setEmployeeData(prev => ({
                        ...prev,
                        reward: userData.data.reward.name || '',
                        addon: userData.data.reward.addon || ''
                      }))
                    }
                  })
                  .catch(error => {
                    console.error('Error fetching reward:', error)
                  })
              }
            }
            if (data.group) {
              setUserGroup(data.group)
              const colorInfo = getColorFromGroup(data.group)
              if (colorInfo) {
                setSelectedColor(colorInfo.rgb)
                setSelectedColorName(colorInfo.name)
              }
            }
          }
          setIsLoaded(true)
          return
        }

        // ถ้า device ยังไม่เคยใช้ ให้โหลด state จาก localStorage
        try {
          const alreadyCheckedIn = isDeviceCheckedIn()
          setDeviceAlreadyCheckedIn(alreadyCheckedIn)
          
          if (alreadyCheckedIn) {
            // ถ้าเช็คอินแล้ว ให้โหลดข้อมูลเดิม
            const checkinData = getDeviceCheckInData()
            const savedState = loadState()
            
            if (savedState && savedState.checkedIn) {
              setCheckedIn(true)
              setEmployeeData({
                ...savedState.employeeData,
                addon: savedState.employeeData.addon || '',
                checkinTime: savedState.employeeData.checkinTime || ''
              })
              
              // ตั้งค่าสีจาก group ถ้า check-in แล้ว
              if (savedState.userGroup && !selectedColor) {
                const colorInfo = getColorFromGroup(savedState.userGroup)
                if (colorInfo) {
                  setSelectedColor(colorInfo.rgb)
                  setSelectedColorName(colorInfo.name)
                  setUserGroup(savedState.userGroup)
                }
              }
            }
          } else {
            // ถ้ายังไม่เช็คอิน ให้โหลด state ปกติ
            const savedState = loadState()
            if (savedState) {
              setCheckedIn(savedState.checkedIn)
              setEmployeeData({
                ...savedState.employeeData,
                addon: savedState.employeeData.addon || '',
                checkinTime: savedState.employeeData.checkinTime || ''
              })
              
              // ตั้งค่าสีจาก group ถ้า check-in แล้ว
              if (savedState.checkedIn && savedState.userGroup && !selectedColor) {
                const colorInfo = getColorFromGroup(savedState.userGroup)
                if (colorInfo) {
                  setSelectedColor(colorInfo.rgb)
                  setSelectedColorName(colorInfo.name)
                  setUserGroup(savedState.userGroup)
                }
              }
            }
          }
        } catch (error: any) {
          if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
            setIsIncognito(true)
            setDeviceAlreadyCheckedIn(false)
          }
        }
        
        setIsLoaded(true)
      } catch (error) {
        console.error('device guard error', error)
        setIsLoaded(true)
      }
    }
    runGuard()
  }, [])


  // บันทึก state ลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  useEffect(() => {
    if (isLoaded) {
      saveState({
        checkedIn,
        employeeData,
        userGroup: userGroup
      })
    }
  }, [checkedIn, employeeData, userGroup, isLoaded])

  // ไม่ต้องเช็ครางวัลก่อน - ให้สุ่มได้ทุกคน

  const handleCheckIn = async (data: { staffid: string; name: string; reward?: string | { name?: string; addon?: string }; group?: number; rewardid?: number | null; deviceId?: string }) => {
    // ตรวจสอบ incognito mode
    if (checkIncognitoModeSync()) {
      setIsIncognito(true)
      return
    }
    
    // ตรวจสอบว่า device นี้เคยเช็คอินแล้วหรือยัง
    try {
      if (isDeviceCheckedIn()) {
        setDeviceAlreadyCheckedIn(true)
        return
      }
    } catch (error: any) {
      if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
        setIsIncognito(true)
        return
      }
    }
    
    // เช็ค rewardid จาก API response: null = ยังไม่สุ่ม, 0 = สุ่มแล้วแต่ไม่ได้รับ, >0 = ได้รับรางวัล
    const rewardid = data.rewardid
    let rewardName = ''
    let rewardAddon = ''
    
    if (rewardid === 0) {
      // สุ่มแล้วแต่ไม่ได้รับรางวัล
      rewardName = 'อุ๊ย! รอบนี้ยังไม่ได้นะ 😄'
      setHasSpun(true) // เคยสุ่มแล้ว ไม่ให้สุ่มซ้ำ
    } else if (rewardid && rewardid > 0) {
      // ได้รับรางวัลแล้ว - ดึงข้อมูลรางวัลจาก API /api/user
      try {
        const userRes = await fetch(`/api/user?staffid=${data.staffid}`)
        if (userRes.ok) {
          const userData = await userRes.json()
          if (userData.success && userData.data && userData.data.reward) {
            rewardName = userData.data.reward.name || ''
            rewardAddon = userData.data.reward.addon || ''
          }
        }
      } catch (error) {
        console.error('Error fetching reward from user API:', error)
        // Fallback: ใช้ข้อมูลจาก data.reward ถ้ามี
        if (data.reward) {
          if (typeof data.reward === 'string') {
            rewardName = data.reward
          } else {
            rewardName = data.reward.name || ''
            rewardAddon = data.reward.addon || ''
          }
        }
      }
      setHasSpun(true) // เคยสุ่มแล้ว ไม่ให้สุ่มซ้ำ
      setHasShownAnimation(true) // แสดงรางวัลทันที ไม่ต้องแสดง animation
    }
    
    // ตั้งค่า employeeData
    setEmployeeData({
      staffid: data.staffid,
      name: data.name,
      reward: rewardName,
      addon: rewardAddon,
      checkinTime: new Date().toISOString()
    })
    
    // ตั้งค่า group และสี
    if (data.group) {
      setUserGroup(data.group)
      const colorInfo = getColorFromGroup(data.group)
      if (colorInfo) {
        setSelectedColor(colorInfo.rgb)
        setSelectedColorName(colorInfo.name)
      }
    }
    
    setCheckedIn(true)
    
    // บันทึกว่า device นี้เช็คอินแล้ว
    try {
      setDeviceCheckedIn()
      setDeviceAlreadyCheckedIn(true)
    } catch (error: any) {
      if (error.message === 'INCOGNITO_MODE_DETECTED' || error.message === 'STORAGE_UNAVAILABLE') {
        setIsIncognito(true)
        // ยังคงแสดงหน้า success แต่จะไม่สามารถบันทึก device check-in ได้
        console.warn('⚠️ ไม่สามารถบันทึก device check-in ได้เนื่องจาก incognito mode')
      }
    }
    
    // ข้อมูลถูกส่งไป database แล้วผ่าน API route
    console.log('Check-in data:', data)
    if (data.deviceId) {
      console.log('Device ID:', data.deviceId)
    } else {
      try {
        console.log('Device ID:', getDeviceId())
      } catch (error) {
        // ignore
      }
    }
  }
  
  // ฟังก์ชันสำหรับสุ่มรางวัล
  const handleSpinReward = async () => {
    setRewardError(null)
    
    try {
      // แสดง animation ทันทีเมื่อกดปุ่ม (ให้รู้สึกว่ากำลังสุ่ม)
      setShowRewardAnimation(true)
      setHasShownAnimation(true)
      
      // ดึงรางวัลทั้งหมดสำหรับ animation (ถ้ามี)
      const rewardsRes = await fetch('/api/reward?all=true')
      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json()
        const rewards = rewardsData.rewards || []
        console.log('Fetched rewards for animation:', rewards.length)
        setAllRewards(rewards)
      }
      
      // เรียก API สุ่มรางวัล (ไม่ต้องเช็ครางวัลก่อน - ให้สุ่มได้ทุกคน)
      let deviceId = ''
      try {
        deviceId = await getDeviceId()
      } catch (error: any) {
        // ถ้า incognito จะไม่มี deviceId
      }
      const hwFingerprint = getHardwareFingerprint(deviceId)
      const deviceFingerprint = await getDeviceFingerprint()
      
      const spinRes = await fetch('/api/reward/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffid: employeeData.staffid,
          deviceId,
          hwFingerprint,
          deviceFingerprint
        })
      })
      
      if (spinRes.ok) {
        const spinData = await spinRes.json()
        
        // เช็คว่าเคยสุ่มไปแล้วหรือยัง
        if (spinData.alreadyAssigned) {
          setHasSpun(true) // เคยสุ่มแล้ว ไม่ให้สุ่มซ้ำ
          setShowRewardAnimation(false)
          
          if (spinData.reward) {
            // ได้รับรางวัลไปแล้ว
            setEmployeeData(prev => ({
              ...prev,
              reward: spinData.reward.name || '',
              addon: spinData.reward.addon || ''
            }))
            setHasRemainingRewards(true)
          } else {
            // ไม่ได้รับรางวัล (รางวัลหมด)
            setEmployeeData(prev => ({
              ...prev,
              reward: 'อุ๊ย! รอบนี้ยังไม่ได้นะ 😄'
            }))
            setHasRemainingRewards(false)
          }
          return
        }
        
        if (spinData.reward) {
          // ได้รางวัล - animation จะหยุดที่รางวัลนี้
          setEmployeeData(prev => ({
            ...prev,
            reward: spinData.reward.name || '',
            addon: spinData.reward.addon || ''
          }))
          setHasRemainingRewards(true)
          setHasSpun(true) // เคยสุ่มแล้ว ไม่ให้สุ่มซ้ำ
        } else {
          // ไม่มีรางวัลเหลือแล้ว - แสดง animation สักพักแล้วค่อยแสดงข้อความ
          setTimeout(() => {
            setEmployeeData(prev => ({
              ...prev,
              reward: 'อุ๊ย! รอบนี้ยังไม่ได้นะ 😄'
            }))
            setHasRemainingRewards(false)
            setShowRewardAnimation(false)
            setHasSpun(true) // เคยสุ่มแล้ว ไม่ให้สุ่มซ้ำ
          }, 2000) // แสดง animation 2 วินาทีก่อนแสดงข้อความ
        }
      } else {
        const errorData = await spinRes.json()
        const errorMessage = errorData.error || 'ไม่สามารถสุ่มรางวัลได้'
        setRewardError(errorMessage)
        setTimeout(() => {
          setShowRewardAnimation(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Error spinning reward:', error)
      setRewardError('เกิดข้อผิดพลาดในการสุ่มรางวัล')
      setTimeout(() => {
        setShowRewardAnimation(false)
      }, 2000)
    }
  }

  const handleReset = () => {
    clearState()
    setCheckedIn(false)
    setEmployeeData({ staffid: '', name: '', reward: '', addon: '', checkinTime: '' })
    setSelectedColor(null)
    setSelectedColorName(null)
    setUserGroup(null)
    setHasSpun(false) // Reset เพื่อให้คนใหม่สามารถสุ่มได้
    setHasShownAnimation(false)
    setShowRewardAnimation(false)
    setRewardError(null)
  }

  // ถ้า token ไม่ผ่าน ให้แสดงหน้าจอบล็อก
  if (tokenChecked && !tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900/80 border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-red-400">QR หมดอายุ</h1>
          <p className="text-gray-300">
            QR นี้ไม่สามารถใช้งานได้แล้ว กรุณาสแกน QR ล่าสุดจากจุดลงทะเบียน
          </p>
          {/*<button
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-semibold"
            onClick={() => router.replace('/qrcode')}
          >
            ไปที่หน้าสร้าง QR
          </button>*/}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 relative overflow-hidden">
      {/* AI-themed animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e3a8a_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10"></div>
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Loading State */}
          {!isLoaded && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">กำลังโหลดข้อมูล...</p>
            </div>
          )}

          {/* Hero Section */}
          {isLoaded && (
            <>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-full mb-6 shadow-2xl shadow-blue-500/50 relative">
              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
              <Calendar className="w-12 h-12 text-white relative z-10" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
                งานปีใหม่ 2026
            </h1>
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <p className="text-lg text-gray-300 font-light">
              ระบบเช็คอินพนักงาน
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-blue-500"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-blue-500"></div>
            </div>
          </div>

          {/* Warning: Device Already Checked In */}
          {deviceAlreadyCheckedIn && !checkedIn && (
            <div className="bg-red-900/30 border-2 border-red-500/50 rounded-xl p-6 mb-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-400 mb-2">
                    เครื่องมือถือนี้เช็คอินแล้ว
                  </h3>
                  <p className="text-red-200 mb-4">
                    เครื่องมือถือนี้ได้ทำการเช็คอินไปแล้ว กรุณาใช้เครื่องมือถืออื่นหรือติดต่อเจ้าหน้าที่หากต้องการเช็คอินใหม่
                  </p>
                  <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
                    <p className="text-sm text-red-300">
                      <span className="font-semibold">หมายเหตุ:</span> ระบบจำเครื่องมือถือของคุณเพื่อป้องกันการเช็คอินซ้ำ
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Check-in Form or Success Message */}
          {!checkedIn ? (
            deviceAlreadyCheckedIn ? (
              <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-red-500/30">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-red-400 mb-2">
                    ไม่สามารถเช็คอินได้
                  </h2>
                  <p className="text-gray-300">
                    เครื่องมือถือนี้ได้ทำการเช็คอินไปแล้ว
                  </p>
                </div>
              </div>
            ) : (
              <CheckInForm onSubmit={handleCheckIn} />
            )
          ) : (
            <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-blue-500/30 relative overflow-hidden">
              {/* Glowing border effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 opacity-50 blur-xl"></div>
              
              <div className="text-center relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg shadow-green-500/50 relative">
                  <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-30"></div>
                  <CheckCircle className="w-12 h-12 text-white relative z-10" />
                </div>
                <h2 className="text-3xl font-bold text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text mb-2">
                  เช็คอินสำเร็จ!
                </h2>
                <p className="text-gray-400 mb-6 text-sm">
                  กรุณาแสดงหน้านี้ต่อเจ้าหน้าที่เพื่อยืนยันการเช็คอิน
                </p>
                
                {/* Check-in Information Card */}
                <div className="bg-gradient-to-r from-blue-900/50 via-cyan-900/50 to-blue-900/50 rounded-xl p-6 mb-6 border border-blue-500/30 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-blue-400 font-semibold text-lg">ข้อมูลการเช็คอิน</h3>
                    {/* สีที่รัดข้อมือ - แสดงข้างๆ หัวข้อ */}
                    {selectedColorName && selectedColor && (
                      <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50">
                        <div 
                          className="w-8 h-8 rounded-lg shadow-md border border-white/20"
                          style={{ backgroundColor: selectedColor }}
                        ></div>
                        <div>
                          <p className="text-xs text-gray-400">สีประจำตัว</p>
                          <p className="text-sm font-bold" style={{ color: selectedColor }}>
                            {selectedColorName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-blue-500/20">
                      <span className="text-gray-400 font-medium">รหัสพนักงาน:</span>
                      <span className="text-blue-400 font-bold text-lg font-mono">{employeeData.staffid}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-500/20">
                      <span className="text-gray-400 font-medium">ชื่อ:</span>
                      <span className="text-white font-bold text-lg">{employeeData.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 font-medium">เวลา:</span>
                      <span className="text-cyan-400 font-bold text-lg font-mono">
                        {employeeData.checkinTime 
                          ? formatThaiDateTime(employeeData.checkinTime)
                          : formatThaiDateTime(new Date())
                        }
                      </span>
                    </div>
                    {/* แสดงสีที่รัดข้อมือด้านล่างถ้ายังไม่มีข้างบน */}
                    {selectedColorName && selectedColor && (
                      <div className="pt-3 border-t border-blue-500/20">
                        <div className="flex items-center justify-center gap-3 bg-gray-800/40 rounded-lg p-3">
                          <div 
                            className="w-12 h-12 rounded-lg shadow-lg border-2 border-white/20"
                            style={{ backgroundColor: selectedColor }}
                          ></div>
                          <div className="text-left">
                            <p className="text-xs text-gray-400 mb-1">กำไลข้อมือของคุณ</p>
                            <p className="text-xl font-bold" style={{ color: selectedColor }}>
                              {selectedColorName}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-2">
                          📌 กรุณารับกำไลข้อมือที่จุดลงทะเบียน <span className="font-bold text-white">{selectedColorName}</span> ตามสีที่แสดงด้านบน
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reward Animation */}
                {showRewardAnimation && allRewards.length > 0 && (
                  <div className="mb-6">
                    <RewardAnimation
                      rewards={allRewards}
                      selectedReward={(() => {
                        // หารางวัลที่ตรงกับที่ได้รับ
                        const found = allRewards.find(r => 
                          r.name === employeeData.reward && 
                          (r.addon || '') === (employeeData.addon || '')
                        )
                        return found || {
                          running: 0,
                          name: employeeData.reward,
                          addon: employeeData.addon || null
                        }
                      })()}
                      onAnimationComplete={() => {
                        console.log('Animation completed')
                        setShowRewardAnimation(false)
                      }}
                    />
                  </div>
                )}

                {/* Reward Display หรือ Spin Button */}
                {(employeeData.reward || hasSpun) ? (
                  // แสดงรางวัลที่ได้รับ หรือข้อความรางวัลหมด
                  !showRewardAnimation && (
                    (employeeData.reward && (employeeData.reward.includes('ขออภัย') || employeeData.reward.includes('อุ๊ย'))) ? (
                      // รางวัลหมดแล้ว
                      <div className="bg-gradient-to-r from-gray-900/40 via-gray-800/40 to-gray-900/40 rounded-xl p-8 mb-6 border-2 border-gray-500/50 backdrop-blur-sm relative overflow-hidden">
                        <div className="relative z-10 text-center">
                          <div className="mb-4">
                            <div className="text-6xl mb-4">😄</div>
                            <h3 className="text-3xl font-bold text-transparent bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 bg-clip-text mb-4">
                              อุ๊ย! รอบนี้ยังไม่ได้นะ 😄
                            </h3>
                            <p className="text-gray-200 text-lg mb-2">
                              อย่าเพิ่งเสียใจ ไปลุ้นรางวัลใหญ่ต่อที่ห้องจัดเลี้ยงกันนะ! 🎉
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // ได้รางวัล - แสดงรางวัลที่ได้ไปแล้ว
                      <div className="reward-container reward-glow bg-gradient-to-r from-yellow-900/40 via-orange-900/40 to-yellow-900/40 rounded-xl p-8 mb-6 border-2 border-yellow-500/50 backdrop-blur-sm relative overflow-hidden">
                        {/* Animated background shimmer */}
                        <div className="absolute inset-0 reward-shimmer rounded-xl"></div>
                        
                        {/* Sparkle effects */}
                        <div className="absolute top-4 left-4 w-3 h-3 bg-yellow-400 rounded-full sparkle sparkle-delay-1"></div>
                        <div className="absolute top-8 right-8 w-2 h-2 bg-orange-400 rounded-full sparkle sparkle-delay-2"></div>
                        <div className="absolute bottom-6 left-8 w-2.5 h-2.5 bg-yellow-300 rounded-full sparkle sparkle-delay-3"></div>
                        <div className="absolute bottom-4 right-4 w-3 h-3 bg-orange-300 rounded-full sparkle"></div>
                        
                        {/* Glowing border effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 animate-pulse"></div>
                        
                        <div className="relative z-10">
                          {/* Header with animated gift */}
                          <div className="flex items-center justify-center gap-4 mb-4">
                            <div className="relative">
                              <div className="gift-icon text-5xl">🎁</div>
                              <div className="absolute -top-1 -right-1 text-2xl sparkle">✨</div>
                              <div className="absolute -bottom-1 -left-1 text-xl sparkle sparkle-delay-1">⭐</div>
                            </div>
                            <h3 className="text-3xl font-bold text-transparent bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 bg-clip-text float-animation">
                              ยินดีด้วย!
                            </h3>
                          </div>
                          
                          {/* Reward message */}
                          <p className="text-yellow-200 text-xl font-semibold mb-4 text-center">
                            คุณได้รับรางวัล
                          </p>
                          
                          {/* Reward display with animation */}
                          <div className="bg-gradient-to-r from-yellow-900/50 via-orange-900/50 to-yellow-900/50 rounded-xl p-6 border-2 border-yellow-400/50 relative overflow-hidden mb-4">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-pulse"></div>
                            <div className="relative z-10">
                              <div className="flex flex-col items-center justify-center gap-3">
                                {/* รางวัลหลัก */}
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-2xl sparkle">🏆</span>
                                  <p className="text-yellow-200 text-2xl font-bold">
                                    {employeeData.reward || 'กำลังโหลด...'}
                                  </p>
                                  <span className="text-2xl sparkle sparkle-delay-1">🎉</span>
                                </div>
                                {/* รางวัลเสริม (ถ้ามี) */}
                                {employeeData.addon && (
                                  <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className="text-xl">➕</span>
                                    <p className="text-yellow-300 text-xl font-semibold">
                                      {employeeData.addon}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Instruction text */}
                          {/*<div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-400/30">
                            <p className="text-yellow-300/90 text-sm text-center font-medium">
                              ✨ กรุณาแสดงหน้านี้ต่อเจ้าหน้าที่เพื่อรับรางวัล ✨
                            </p>
                          </div>*/}
                        </div>
                      </div>
                    )
                  )
                ) : (
                  // ปุ่มสุ่มรางวัล (แสดงได้ทุกคน ไม่ต้องเช็ครางวัลก่อน)
                    <div className="bg-gradient-to-r from-purple-900/40 via-pink-900/40 to-purple-900/40 rounded-xl p-8 mb-6 border-2 border-purple-500/50 backdrop-blur-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 animate-pulse"></div>
                      
                      <div className="relative z-10 text-center">
                        {/* Error Message */}
                        {rewardError && (
                          <div className="bg-red-900/30 border-2 border-red-500/50 rounded-xl p-4 mb-4 backdrop-blur-sm flex items-start">
                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-red-400" />
                            <span className="text-red-200 text-sm">{rewardError}</span>
                          </div>
                        )}
                        
                        <div className="mb-6">
                          <div className="text-6xl mb-4 animate-bounce">🎰</div>
                          <h3 className="text-3xl font-bold text-transparent bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text mb-2">
                            เช็คอินสำเร็จแล้ว!
                          </h3>
                          <p className="text-purple-200 text-lg">
                            กดปุ่มด้านล่างเพื่อสุ่มรางวัล
                          </p>
                        </div>
                        
                        <button
                          onClick={handleSpinReward}
                          disabled={showRewardAnimation}
                          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white font-bold text-xl rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <Sparkles className="w-6 h-6 relative z-10" />
                          <span className="relative z-10">สุ่มรางวัล</span>
                          <Sparkles className="w-6 h-6 relative z-10" />
                        </button>
                        
                        <p className="text-purple-300/70 text-sm mt-4">
                          ✨ คลิกเพียงครั้งเดียวเพื่อรับรางวัลของคุณ ✨
                        </p>
                      </div>
                    </div>
                )}

                <p className="text-gray-400 mt-4">
                  ขอให้สนุกกับงานปีใหม่นะครับ! 🎆
                </p>
                
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="mt-8 bg-gray-900/60 backdrop-blur-xl rounded-xl p-6 border border-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500"></div>
                <h3 className="font-semibold text-blue-400 mb-4 flex items-center text-lg">
                  <span className="mr-2">ℹ️</span>
                  ข้อมูลงานปีใหม่ 2026
                </h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start group">
                    <span className="mr-3 text-blue-400">📅</span>
                    <span className="group-hover:text-white transition-colors">วันที่: 20 ธันวาคม 2026</span>
                  </li>
                      <li className="flex items-start group">
                        <span className="mr-3 text-cyan-400">🕐</span>
                        <span className="group-hover:text-white transition-colors">เวลา: 17:00 - 23:00 น.</span>
                  </li>
                      <li className="flex items-start group">
                        <span className="mr-3 text-blue-400">📍</span>
                        <span className="group-hover:text-white transition-colors">สถานที่: Hall 3 BanQuet Hall At Nathong</span>
                  </li>
                </ul>
              </div>
            </>
          )}
          </div>
      </main>
    </div>
  )
}

// Main component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-black to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

