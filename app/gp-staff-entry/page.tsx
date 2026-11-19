'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lock, UserPlus, LogOut, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import StaffExcelImport from '@/components/StaffExcelImport'

// หน้าเพิ่มรายชื่อพนักงานด้วยมือ (ซ่อนไว้ ใช้ได้เฉพาะคนที่รู้ path + ADMIN_KEY)

const STORAGE_KEY = 'staff-entry-admin-key'

type StaffRow = {
  recordid: number
  group: number | null
  staffid: number | null
  stafftitle: string | null
  staffname: string | null
  staffnickname: string | null
  jobtitle: string | null
  position: string | null
  department: string | null
  branch: string | null
  startdate: string | null
  rewardid: number | null
}

const emptyForm = {
  group: '',
  staffid: '',
  stafftitle: '',
  staffname: '',
  staffnickname: '',
  jobtitle: '',
  position: '',
  department: '',
  branch: '',
  startdate: '',
  rewardid: '',
}

type FormState = typeof emptyForm

const FIELDS: { key: keyof FormState; label: string; required?: boolean; type?: string; placeholder?: string; maxLength?: number }[] = [
  { key: 'staffid', label: 'รหัสพนักงาน', required: true, type: 'number', placeholder: 'เช่น 47' },
  { key: 'group', label: 'กลุ่ม (GROUP)', type: 'number', placeholder: 'เลขกลุ่ม / สีสายรัดข้อมือ' },
  { key: 'stafftitle', label: 'คำนำหน้า', placeholder: 'นาย / นาง / นางสาว', maxLength: 100 },
  { key: 'staffname', label: 'ชื่อ-นามสกุล', required: true, maxLength: 100 },
  { key: 'staffnickname', label: 'ชื่อเล่น', maxLength: 50 },
  { key: 'jobtitle', label: 'Job title' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'department', label: 'แผนก' },
  { key: 'branch', label: 'สาขา', maxLength: 10 },
  { key: 'startdate', label: 'วันที่เริ่มงาน', type: 'date' },
  { key: 'rewardid', label: 'rewardid', type: 'number', placeholder: 'เว้นว่าง = ยังไม่มีรางวัล' },
]

function readStoredKey(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeKey(value: string | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore (private mode)
  }
}

export default function StaffEntryPage() {
  const [adminKey, setAdminKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const [rows, setRows] = useState<StaffRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)

  const loadRows = useCallback(async (key: string) => {
    setLoadingRows(true)
    try {
      const res = await fetch('/api/staff-manual', { headers: { 'x-admin-key': key }, cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setRows(data.data || [])
        return { ok: true as const }
      }
      return { ok: false as const, status: res.status, error: data.error || 'เกิดข้อผิดพลาด' }
    } catch {
      return { ok: false as const, status: 0, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }
    } finally {
      setLoadingRows(false)
    }
  }, [])

  const tryLogin = useCallback(async (key: string) => {
    setChecking(true)
    setAuthError(null)
    const result = await loadRows(key)
    setChecking(false)
    // 500 = รหัสถูกแต่ฐานข้อมูลมีปัญหา -> ให้เข้าได้ แต่แสดง error
    if (result.ok || result.status === 500) {
      setAdminKey(key)
      setAuthed(true)
      storeKey(key)
      if (!result.ok) setMessage({ type: 'error', text: result.error })
    } else {
      setAuthed(false)
      storeKey(null)
      setAuthError(result.error)
    }
  }, [loadRows])

  useEffect(() => {
    const saved = readStoredKey()
    if (saved) tryLogin(saved)
  }, [tryLogin])

  const handleLogout = () => {
    storeKey(null)
    setAuthed(false)
    setAdminKey('')
    setKeyInput('')
    setRows([])
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const res = await fetch('/api/staff-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setMessage({ type: 'ok', text: `บันทึกแล้ว: ${form.staffid} ${form.staffname}` })
        setForm(emptyForm)
        loadRows(adminKey)
      } else {
        if (res.status === 401) handleLogout()
        setMessage({ type: 'error', text: data.error || 'บันทึกไม่สำเร็จ' })
      }
    } catch {
      setMessage({ type: 'error', text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' })
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg bg-gray-800/70 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (keyInput.trim()) tryLogin(keyInput.trim())
          }}
          className="w-full max-w-sm bg-gray-900/80 border border-blue-500/30 rounded-2xl p-8 space-y-5 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">สำหรับผู้ดูแลระบบ</h1>
          </div>
          <input
            type="password"
            autoComplete="off"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="รหัสผู้ดูแล (ADMIN_KEY)"
            className={inputClass}
            autoFocus
          />
          {authError && (
            <p className="text-sm text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={checking || !keyInput.trim()}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2.5 font-semibold text-white transition-colors"
          >
            {checking ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-950 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <UserPlus className="w-7 h-7 text-blue-400" />
            เพิ่มรายชื่อพนักงาน
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900/80 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-xl space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="block text-sm text-gray-300 mb-1">
                  {f.label}
                  {f.required && <span className="text-red-400"> *</span>}
                </span>
                <input
                  type={f.type || 'text'}
                  inputMode={f.type === 'number' ? 'numeric' : undefined}
                  min={f.type === 'number' ? 0 : undefined}
                  required={f.required}
                  maxLength={f.maxLength}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">วันที่เริ่มงานเว้นว่างได้ ระบบจะใช้เวลาปัจจุบัน</p>

          {message && (
            <div
              className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                message.type === 'ok'
                  ? 'bg-green-900/30 border border-green-500/40 text-green-200'
                  : 'bg-red-900/30 border border-red-500/40 text-red-200'
              }`}
            >
              {message.type === 'ok' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-2.5 font-semibold text-white transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm)
                setMessage(null)
              }}
              className="rounded-lg border border-gray-700 px-6 py-2.5 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              ล้างฟอร์ม
            </button>
          </div>
        </form>

        <StaffExcelImport adminKey={adminKey} onDone={() => loadRows(adminKey)} />

        <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">รายชื่อล่าสุด (50 คน)</h2>
            <button
              onClick={() => loadRows(adminKey)}
              disabled={loadingRows}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRows ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase text-gray-500 border-b border-gray-700">
                <tr>
                  <th className="py-2 pr-4">รหัส</th>
                  <th className="py-2 pr-4">ชื่อ</th>
                  <th className="py-2 pr-4">ชื่อเล่น</th>
                  <th className="py-2 pr-4">กลุ่ม</th>
                  <th className="py-2 pr-4">แผนก</th>
                  <th className="py-2 pr-4">สาขา</th>
                  <th className="py-2 pr-4">rewardid</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-gray-500">
                      {loadingRows ? 'กำลังโหลด...' : 'ยังไม่มีข้อมูล'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.recordid} className="border-b border-gray-800">
                      <td className="py-2 pr-4 whitespace-nowrap">{r.staffid}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {[r.stafftitle, r.staffname].filter(Boolean).join(' ')}
                      </td>
                      <td className="py-2 pr-4">{r.staffnickname}</td>
                      <td className="py-2 pr-4">{r.group}</td>
                      <td className="py-2 pr-4">{r.department}</td>
                      <td className="py-2 pr-4">{r.branch}</td>
                      <td className="py-2 pr-4">{r.rewardid ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
