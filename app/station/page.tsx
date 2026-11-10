'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, Sparkles, AlertCircle, User } from 'lucide-react'
import { formatThaiDateTime } from '@/utils/date'
import RewardAnimation from '@/components/RewardAnimation'
import StationCheckInForm from '@/components/StationCheckInForm'

// 6 สีที่กำหนดไว้สำหรับที่รัดข้อมือ (ใช้ rgba สำหรับ opacity)
const colorPalette = [
  { name: 'เขียว', rgb: 'rgba(34, 197, 94, 1)' },      // Group 1
  { name: 'ส้ม', rgb: 'rgba(249, 115, 22, 1)' },      // Group 2
  { name: 'เหลือง', rgb: 'rgba(250, 204, 21, 1)' },   // Group 3
  { name: 'ชมพู', rgb: 'rgba(236, 72, 153, 1)' },     // Group 4
  { name: 'ม่วง', rgb: 'rgba(168, 85, 247, 1)' },     // Group 5
  { name: 'ฟ้า', rgb: 'rgba(14, 165, 233, 1)' }        // Group 6
]

const getColorFromGroup = (group: number | null): { rgb: string; name: string } | null => {
  if (!group || group < 1 || group > 6) {
    return null
  }
  return colorPalette[group - 1]
}

export default function StationPage() {
  const [checkedIn, setCheckedIn] = useState(false)
  const [employeeData, setEmployeeData] = useState({ staffid: '', name: '', reward: '', addon: '', checkinTime: '' })
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedColorName, setSelectedColorName] = useState<string | null>(null)
  const [userGroup, setUserGroup] = useState<number | null>(null)
  const [allRewards, setAllRewards] = useState<any[]>([])
  const [showRewardAnimation, setShowRewardAnimation] = useState(false)
  const [hasShownAnimation, setHasShownAnimation] = useState(false)
  const [hasRemainingRewards, setHasRemainingRewards] = useState<boolean | null>(null)
  const [rewardError, setRewardError] = useState<string | null>(null)
  const [hasSpun, setHasSpun] = useState(false) // เช็คว่าเคยสุ่มแล้วหรือยัง

  // ตรวจสอบว่าเป็น mobile device หรือไม่
  useEffect(() => {
    const checkMobile = () => {
      // ตรวจสอบจาก user agent
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
      const isMobileDevice = mobileRegex.test(userAgent)
      
      // ตรวจสอบจาก screen width (เพิ่มความแน่นอน)
      const isSmallScreen = window.innerWidth < 768
      
      setIsMobile(isMobileDevice || isSmallScreen)
      setIsLoaded(true)
    }

    checkMobile()
    
    // ตรวจสอบอีกครั้งเมื่อ resize window
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ตั้งค่าสีจาก group
  useEffect(() => {
    if (checkedIn && userGroup && !selectedColor) {
      const colorInfo = getColorFromGroup(userGroup)
      if (colorInfo) {
        setSelectedColor(colorInfo.rgb)
        setSelectedColorName(colorInfo.name)
      }
    }
  }, [checkedIn, userGroup, selectedColor])

  // ไม่ต้องเช็ครางวัลก่อน - ให้สุ่มได้ทุกคน

  const handleCheckIn = (data: { staffid: string; name: string; group?: number; rewardid?: number | null; reward?: { name: string; addon?: string | null } | null }) => {
    // เช็คอินสำเร็จ หรือเคยเช็คอินแล้ว
    setCheckedIn(true)
    
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
    }
    
    setEmployeeData({
      staffid: data.staffid,
      name: data.name,
      reward: rewardName,
      addon: rewardAddon,
      checkinTime: new Date().toISOString()
    })
    setUserGroup(data.group || null)
    
    // ถ้ามี rewardid (ไม่ว่าจะเป็น 0 หรือ >0) แสดงว่าเคยสุ่มแล้ว ไม่ต้องแสดง animation
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
  }

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
      
      // เรียก API สุ่มรางวัล (ไม่ต้องเช็ครางวัลก่อน)
      const spinRes = await fetch('/api/reward/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffid: employeeData.staffid,
          source: 'station' // บอกว่ามาจาก station
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
    } catch (error: any) {
      console.error('Error spinning reward:', error)
      setRewardError('เกิดข้อผิดพลาดในการสุ่มรางวัล')
      setTimeout(() => {
        setShowRewardAnimation(false)
      }, 2000)
    }
  }

  const handleReset = () => {
    setCheckedIn(false)
    setEmployeeData({ staffid: '', name: '', reward: '', addon: '', checkinTime: '' })
    setSelectedColor(null)
    setSelectedColorName(null)
    setUserGroup(null)
    setAllRewards([])
    setShowRewardAnimation(false)
    setHasSpun(false) // Reset เพื่อให้คนใหม่สามารถสุ่มได้
    setHasShownAnimation(false)
    setRewardError(null)
    setHasShownAnimation(false)
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 flex items-center justify-center">
        <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // แสดง error page ถ้าเป็น mobile device
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 relative overflow-hidden flex items-center justify-center px-4">
        {/* AI-themed animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e3a8a_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10"></div>

        <div className="max-w-md w-full bg-gray-900/80 border border-red-500/30 rounded-2xl p-8 text-center space-y-6 relative z-10 backdrop-blur-xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-900/30 border-2 border-red-500/50 rounded-full mb-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-red-400 mb-2">
            ไม่สามารถเข้าถึงได้
          </h1>
          <p className="text-gray-300 text-lg mb-4">
            หน้านี้สามารถเข้าถึงได้เฉพาะจากคอมพิวเตอร์เท่านั้น
          </p>
          <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
            <p className="text-sm text-red-200">
              กรุณาใช้คอมพิวเตอร์หรือแล็ปท็อปเพื่อเข้าถึงหน้า Station
            </p>
          </div>
          <div className="pt-4">
            <p className="text-gray-400 text-sm">
              สำหรับการเช็คอินด้วยมือถือ กรุณาใช้ QR Code
            </p>
          </div>
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
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-full mb-6 shadow-2xl shadow-blue-500/50 relative">
              <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
              <User className="w-12 h-12 text-white relative z-10" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
                ลงทะเบียนที่ Station
              </h1>
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-blue-500"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-blue-500"></div>
            </div>
          </div>

        {/* Check-in Form */}
        {!checkedIn && (
          <StationCheckInForm onSubmit={handleCheckIn} />
        )}

        {/* Success State */}
        {checkedIn && (
          <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-blue-500/30 relative overflow-hidden">
            {/* Glowing border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 opacity-50 blur-xl"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-6">
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
              </div>

              {/* Employee Info */}
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
                      return found || (employeeData.reward ? {
                        running: 0,
                        name: employeeData.reward,
                        addon: employeeData.addon || null
                      } : null)
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
                  employeeData.reward.includes('ขออภัย') || employeeData.reward.includes('อุ๊ย') ? (
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
                    // ได้รางวัล
                    <div className="reward-container reward-glow bg-gradient-to-r from-yellow-900/40 via-orange-900/40 to-yellow-900/40 rounded-xl p-8 mb-6 border-2 border-yellow-500/50 backdrop-blur-sm relative overflow-hidden">
                      {/* Animated background shimmer */}
                      <div className="absolute inset-0 reward-shimmer rounded-xl"></div>
                      
                      {/* Glowing border effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 animate-pulse"></div>
                      
                      <div className="relative z-10">
                        {/* Header with animated gift */}
                        <div className="flex items-center justify-center gap-4 mb-4">
                          <div className="text-5xl">🎁</div>
                          <h3 className="text-3xl font-bold text-transparent bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 bg-clip-text">
                            ยินดีด้วย!
                          </h3>
                        </div>
                        
                        {/* Reward message */}
                        <p className="text-yellow-200 text-xl font-semibold mb-4 text-center">
                          คุณได้รับรางวัล
                        </p>
                        
                        {/* Reward display */}
                        <div className="bg-gradient-to-r from-yellow-900/50 via-orange-900/50 to-yellow-900/50 rounded-xl p-6 border-2 border-yellow-400/50 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-pulse"></div>
                          <div className="relative z-10">
                            <div className="flex flex-col items-center justify-center gap-3">
                              {/* รางวัลหลัก */}
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl">🏆</span>
                                <p className="text-yellow-200 text-2xl font-bold">
                                  {employeeData.reward}
                                </p>
                                <span className="text-2xl">🎉</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )
              ) : (
                // ปุ่มสุ่มรางวัล (ถ้ายังไม่ได้สุ่ม)
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

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="w-full py-3 px-6 bg-gray-800/60 border border-gray-700/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700/60 hover:text-white transition-all"
              >
                ลงทะเบียนคนต่อไป
              </button>
            </div>
          </div>
        )}

        {/* Info Card - ข้อมูลงานปีใหม่ 2026 */}
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
        </div>
      </main>
    </div>
  )
}

