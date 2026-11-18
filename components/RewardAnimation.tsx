

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Gift } from 'lucide-react'

interface Reward {
  running: number
  name: string
  addon?: string | null
}

interface RewardAnimationProps {
  rewards: Reward[]
  selectedReward: Reward | null
  onAnimationComplete: () => void
}

export default function RewardAnimation({ rewards, selectedReward, onAnimationComplete }: RewardAnimationProps) {
  const [displayedReward, setDisplayedReward] = useState<Reward | null>(null)
  const [isSpinning, setIsSpinning] = useState(true)
  const [spinCount, setSpinCount] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const spinDuration = 3000 // 3 seconds
  const spinInterval = 100 // Change reward every 100ms
  const minSpins = 20 // Minimum number of spins

  useEffect(() => {
    if (!selectedReward || rewards.length === 0) {
      console.log('RewardAnimation: Missing selectedReward or rewards', { selectedReward, rewardsLength: rewards.length })
      setIsSpinning(false)
      return
    }

    console.log('RewardAnimation: Starting animation', { selectedReward, rewardsCount: rewards.length })
    setIsSpinning(true)
    setSpinCount(0)
    setDisplayedReward(null)

    // Start spinning
    const startTime = Date.now()
    let currentSpin = 0

    intervalRef.current = setInterval(() => {
      currentSpin++
      setSpinCount(currentSpin)

      // Random reward during spinning
      const randomIndex = Math.floor(Math.random() * rewards.length)
      setDisplayedReward(rewards[randomIndex])

      const elapsed = Date.now() - startTime
      const shouldStop = elapsed >= spinDuration && currentSpin >= minSpins

      if (shouldStop) {
        // Slow down before stopping
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }

        // Final spin to selected reward
        setTimeout(() => {
          setDisplayedReward(selectedReward)
          setIsSpinning(false)
          onAnimationComplete()
        }, 200)
      }
    }, spinInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [selectedReward, rewards, onAnimationComplete])

  if (!selectedReward || rewards.length === 0) {
    return null
  }

  const currentReward = displayedReward || selectedReward
  // ใช้ name + addon (ถ้า addon ไม่เป็นค่าว่าง) แทน description
  const displayName = currentReward.addon && currentReward.addon.trim()
    ? `${currentReward.name} + ${currentReward.addon}`
    : currentReward.name

  return (
    <div className="relative">
      {/* Glowing background effect */}
      {isSpinning && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 rounded-2xl blur-xl animate-pulse"></div>
      )}
      
      <div className={`relative bg-gradient-to-br from-yellow-900/90 via-orange-900/90 to-yellow-900/90 rounded-2xl p-6 border-2 ${
        isSpinning 
          ? 'border-yellow-500/50 shadow-2xl shadow-yellow-500/50 animate-pulse' 
          : 'border-yellow-400/30 shadow-lg'
      } transition-all duration-500`}>
        {/* Sparkle effects */}
        {isSpinning && (
          <>
            <Sparkles className="absolute top-2 left-2 w-4 h-4 text-yellow-400 animate-ping" />
            <Sparkles className="absolute top-2 right-2 w-4 h-4 text-orange-400 animate-ping" style={{ animationDelay: '0.5s' }} />
            <Sparkles className="absolute bottom-2 left-2 w-4 h-4 text-yellow-400 animate-ping" style={{ animationDelay: '1s' }} />
            <Sparkles className="absolute bottom-2 right-2 w-4 h-4 text-orange-400 animate-ping" style={{ animationDelay: '1.5s' }} />
          </>
        )}

        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gift className={`w-8 h-8 text-yellow-400 ${isSpinning ? 'animate-bounce' : ''}`} />
            <h3 className="text-xl font-bold text-transparent bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text">
              {isSpinning ? 'กำลังสุ่มรางวัล...' : 'รางวัลของคุณ'}
            </h3>
          </div>

          {/* Reward display with slot machine effect */}
          <div className={`bg-black/40 rounded-xl p-6 border border-yellow-500/30 mb-4 min-h-[120px] flex items-center justify-center ${
            isSpinning ? 'animate-pulse' : ''
          }`}>
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 transition-all duration-200 ${
                isSpinning 
                  ? 'text-yellow-300 animate-pulse' 
                  : 'text-transparent bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300 bg-clip-text'
              }`}>
                {displayName}
              </div>
            </div>
          </div>

          {/* Spinning indicator */}
          {isSpinning && (
            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}

          {/* Success message */}
          {!isSpinning && (
            <div className="text-green-400 text-sm font-semibold animate-fade-in">
              🎉 ยินดีด้วย! 🎉
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}

