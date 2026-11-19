'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, Download, Upload, AlertCircle, CheckCircle, X } from 'lucide-react'
import {
  FIELD_LABELS,
  HEADER_ALIASES,
  STAFF_FIELDS,
  StaffField,
  StaffRecord,
  cleanStaffRow,
  dbRowToRecord,
  diffFields,
  mapHeaders,
} from '@/lib/staffFields'

// อัปโหลด Excel -> พรีวิว -> บันทึก (ใช้ในหน้าเพิ่มรายชื่อด้วยมือ)

type NewRow = { line: number; record: StaffRecord }
type SameRow = { line: number; record: StaffRecord }
type ConflictRow = { line: number; record: StaffRecord; old: StaffRecord; diff: StaffField[]; dbCount: number }
type InvalidRow = { line: number; record: StaffRecord; errors: string[] }

type Preview = {
  fileName: string
  sheetName: string
  mappedFields: StaffField[]
  unknownHeaders: string[]
  newRows: NewRow[]
  sameRows: SameRow[]
  conflicts: ConflictRow[]
  invalid: InvalidRow[]
}

const CHUNK = 500

export default function StaffExcelImport({ adminKey, onDone }: { adminKey: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const reset = () => {
    setPreview(null)
    setSelectedUpdates(new Set())
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      STAFF_FIELDS,
      [47, 47, 'นาย', 'ตัวอย่าง ทดสอบ', 'เทส', 'Secret', 'Secret', 'IT', 'HQ', '2026-01-05', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'user')
    XLSX.writeFile(wb, 'staff-template.xlsx')
  }

  const handleFile = async (file: File) => {
    setError(null)
    setResult(null)
    setPreview(null)
    setSelectedUpdates(new Set())
    setReading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('ไม่พบชีตในไฟล์')
      const ws = wb.Sheets[sheetName]

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true, blankrows: false })
      if (matrix.length < 2) throw new Error('ไฟล์ไม่มีข้อมูล (ต้องมีแถวหัวคอลัมน์ + ข้อมูลอย่างน้อย 1 แถว)')

      const headers = (matrix[0] as unknown[]).map(h => String(h ?? '').trim())
      const { mapping, unknown } = mapHeaders(headers)
      const mappedFields = Object.values(mapping)
      if (!mappedFields.includes('staffid') || !mappedFields.includes('staffname')) {
        throw new Error(
          `ไม่พบคอลัมน์ ${!mappedFields.includes('staffid') ? '"รหัสพนักงาน" ' : ''}${
            !mappedFields.includes('staffname') ? '"ชื่อ-นามสกุล"' : ''
          } ในแถวแรกของชีต "${sheetName}" — หัวคอลัมน์ที่เจอ: ${headers.filter(Boolean).join(', ') || '(ว่าง)'}`
        )
      }

      // แปลงทุกแถว
      const parsed: { line: number; record: StaffRecord; errors: string[] }[] = []
      for (let i = 1; i < matrix.length; i++) {
        const cells = matrix[i] as unknown[]
        const raw: Record<string, unknown> = {}
        headers.forEach((h, col) => {
          const field = mapping[h]
          if (field) raw[field] = cells[col]
        })
        const isEmpty = Object.values(raw).every(v => v === '' || v === null || v === undefined)
        if (isEmpty) continue
        const { record, errors } = cleanStaffRow(raw)
        parsed.push({ line: i + 1, record, errors })
      }

      // รหัสซ้ำกันเองในไฟล์
      const countById = new Map<number, number>()
      for (const p of parsed) {
        if (typeof p.record.staffid === 'number') countById.set(p.record.staffid, (countById.get(p.record.staffid) || 0) + 1)
      }
      for (const p of parsed) {
        if (typeof p.record.staffid === 'number' && (countById.get(p.record.staffid) || 0) > 1) {
          p.errors.push('รหัสพนักงานซ้ำกันในไฟล์')
        }
      }

      const valid = parsed.filter(p => p.errors.length === 0)
      const invalid: InvalidRow[] = parsed.filter(p => p.errors.length > 0)

      // เทียบกับ DB
      const res = await fetch('/api/staff-manual/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ action: 'check', staffids: valid.map(v => v.record.staffid) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'ตรวจข้อมูลกับฐานข้อมูลไม่สำเร็จ')

      const dbById = new Map<number, any[]>()
      for (const row of data.existing as any[]) {
        const id = Number(row.staffid)
        dbById.set(id, [...(dbById.get(id) || []), row])
      }

      const newRows: NewRow[] = []
      const sameRows: SameRow[] = []
      const conflicts: ConflictRow[] = []
      for (const v of valid) {
        const dbRows = dbById.get(v.record.staffid as number)
        if (!dbRows || dbRows.length === 0) {
          newRows.push(v)
          continue
        }
        const old = dbRowToRecord(dbRows[0])
        const diff = diffFields(v.record, old)
        if (diff.length === 0 && dbRows.length === 1) sameRows.push(v)
        else conflicts.push({ ...v, old, diff, dbCount: dbRows.length })
      }

      setPreview({
        fileName: file.name,
        sheetName,
        mappedFields,
        unknownHeaders: unknown,
        newRows,
        sameRows,
        conflicts,
        invalid,
      })
    } catch (e: any) {
      setError(e?.message || 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setReading(false)
    }
  }

  const toggleUpdate = (line: number) => {
    setSelectedUpdates(prev => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  const handleCommit = async () => {
    if (!preview) return
    const insert = preview.newRows.map(r => r.record)
    const update = preview.conflicts.filter(c => selectedUpdates.has(c.line)).map(c => c.record)
    if (insert.length + update.length === 0) return

    setSaving(true)
    setResult(null)
    let inserted = 0
    let updated = 0
    const skipped: { staffid: number; reason: string }[] = []
    const all = [...insert.map(r => ({ kind: 'insert' as const, r })), ...update.map(r => ({ kind: 'update' as const, r }))]
    try {
      for (let i = 0; i < all.length; i += CHUNK) {
        const chunk = all.slice(i, i + CHUNK)
        setProgress(`กำลังบันทึก ${Math.min(i + CHUNK, all.length)} / ${all.length}`)
        const res = await fetch('/api/staff-manual/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
          body: JSON.stringify({
            action: 'commit',
            insert: chunk.filter(c => c.kind === 'insert').map(c => c.r),
            update: chunk.filter(c => c.kind === 'update').map(c => c.r),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) {
          throw new Error(
            `${data.error || 'บันทึกไม่สำเร็จ'}${i > 0 ? ` (ชุดก่อนหน้าบันทึกไปแล้ว: เพิ่ม ${inserted}, อัปเดต ${updated})` : ''}`
          )
        }
        inserted += data.inserted
        updated += data.updated
        skipped.push(...(data.skipped || []))
      }
      setResult({
        type: 'ok',
        text:
          `เพิ่มใหม่ ${inserted} คน, อัปเดต ${updated} คน` +
          (skipped.length ? `, ข้าม ${skipped.length} คน (${skipped.map(s => `${s.staffid}: ${s.reason}`).join('; ')})` : ''),
      })
      reset()
      onDone()
    } catch (e: any) {
      setResult({ type: 'error', text: e?.message || 'บันทึกไม่สำเร็จ' })
      onDone()
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  const cell = (v: unknown) => (v === undefined || v === null || v === '' ? <span className="text-gray-600">-</span> : String(v))

  return (
    <div className="bg-gray-900/80 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          นำเข้าจาก Excel
        </h2>
        <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
          <Download className="w-4 h-4" />
          ดาวน์โหลดไฟล์ตัวอย่าง
        </button>
      </div>

      <p className="text-xs text-gray-400">
        รองรับ .xlsx .xls .csv — อ่านชีตแรก แถวแรกเป็นหัวคอลัมน์ ต้องมีอย่างน้อย <b>รหัสพนักงาน</b> กับ <b>ชื่อ-นามสกุล</b>{' '}
        (หัวคอลัมน์ใช้ชื่อเดียวกับใน DB เช่น {HEADER_ALIASES.staffid[0]}, {HEADER_ALIASES.staffname[0]} หรือภาษาไทยก็ได้)
      </p>

      <label className="flex items-center justify-center gap-3 border-2 border-dashed border-gray-700 hover:border-emerald-500/60 rounded-xl py-6 cursor-pointer text-gray-300 transition-colors">
        <Upload className="w-5 h-5" />
        {reading ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ Excel'}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={reading || saving}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg px-4 py-3 text-sm bg-red-900/30 border border-red-500/40 text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
            result.type === 'ok'
              ? 'bg-green-900/30 border border-green-500/40 text-green-200'
              : 'bg-red-900/30 border border-red-500/40 text-red-200'
          }`}
        >
          {result.type === 'ok' ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {result.text}
        </div>
      )}

      {preview && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-300">
            <span>
              ไฟล์ <b className="text-white">{preview.fileName}</b> (ชีต {preview.sheetName}) — คอลัมน์ที่ใช้:{' '}
              {preview.mappedFields.map(f => FIELD_LABELS[f]).join(', ')}
            </span>
            <button onClick={reset} className="flex items-center gap-1 text-gray-400 hover:text-white">
              <X className="w-4 h-4" /> ยกเลิก
            </button>
          </div>
          {preview.unknownHeaders.length > 0 && (
            <p className="text-xs text-yellow-300/80">
              ⚠ คอลัมน์ที่ไม่รู้จัก (จะไม่ถูกนำเข้า): {preview.unknownHeaders.join(', ')}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Stat label="เพิ่มใหม่" value={preview.newRows.length} color="text-green-400" />
            <Stat label="เหมือนเดิม (ข้าม)" value={preview.sameRows.length} color="text-gray-400" />
            <Stat label="รหัสซ้ำ ข้อมูลต่าง" value={preview.conflicts.length} color="text-yellow-400" />
            <Stat label="ข้อมูลผิด (ข้าม)" value={preview.invalid.length} color="text-red-400" />
          </div>

          {preview.invalid.length > 0 && (
            <Section title={`ข้อมูลผิด — จะไม่ถูกนำเข้า (${preview.invalid.length})`} color="text-red-400">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="py-2 pr-3">แถว</th>
                    <th className="py-2 pr-3">รหัส</th>
                    <th className="py-2 pr-3">ชื่อ</th>
                    <th className="py-2 pr-3">ปัญหา</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.invalid.map(r => (
                    <tr key={r.line} className="border-b border-gray-800">
                      <td className="py-1.5 pr-3">{r.line}</td>
                      <td className="py-1.5 pr-3">{cell(r.record.staffid)}</td>
                      <td className="py-1.5 pr-3">{cell(r.record.staffname)}</td>
                      <td className="py-1.5 pr-3 text-red-300">{r.errors.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {preview.conflicts.length > 0 && (
            <Section title={`รหัสซ้ำแต่ข้อมูลต่าง — ติ๊กแถวที่จะอัปเดตทับ (${preview.conflicts.length})`} color="text-yellow-400">
              <div className="flex gap-4 text-xs mb-2">
                <button
                  className="text-yellow-300 hover:text-yellow-200"
                  onClick={() => setSelectedUpdates(new Set(preview.conflicts.map(c => c.line)))}
                >
                  เลือกทั้งหมด
                </button>
                <button className="text-gray-400 hover:text-white" onClick={() => setSelectedUpdates(new Set())}>
                  ไม่เลือกเลย
                </button>
              </div>
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="py-2 pr-3">อัปเดต</th>
                    <th className="py-2 pr-3">แถว</th>
                    <th className="py-2 pr-3">รหัส</th>
                    <th className="py-2 pr-3">สิ่งที่ต่าง (ในระบบ → ในไฟล์)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.conflicts.map(c => (
                    <tr key={c.line} className="border-b border-gray-800 align-top">
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-yellow-500"
                          checked={selectedUpdates.has(c.line)}
                          onChange={() => toggleUpdate(c.line)}
                        />
                      </td>
                      <td className="py-1.5 pr-3">{c.line}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{c.record.staffid}</td>
                      <td className="py-1.5 pr-3 space-y-0.5">
                        {c.dbCount > 1 && (
                          <div className="text-xs text-orange-300">⚠ ในระบบมีรหัสนี้ {c.dbCount} แถว จะถูกอัปเดตทั้งหมด</div>
                        )}
                        {c.diff.length === 0 && <div className="text-xs text-gray-400">ข้อมูลตรงกับแถวแรกในระบบ</div>}
                        {c.diff.map(f => (
                          <div key={f}>
                            <span className="text-gray-500">{FIELD_LABELS[f]}:</span>{' '}
                            <span className="text-red-300 line-through">{cell(c.old[f])}</span> →{' '}
                            <span className="text-green-300">{cell(c.record[f])}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {preview.newRows.length > 0 && (
            <Section title={`เพิ่มใหม่ (${preview.newRows.length})`} color="text-green-400">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-500 border-b border-gray-700">
                  <tr>
                    <th className="py-2 pr-3">แถว</th>
                    {preview.mappedFields.map(f => (
                      <th key={f} className="py-2 pr-3 whitespace-nowrap">
                        {FIELD_LABELS[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.newRows.map(r => (
                    <tr key={r.line} className="border-b border-gray-800">
                      <td className="py-1.5 pr-3">{r.line}</td>
                      {preview.mappedFields.map(f => (
                        <td key={f} className="py-1.5 pr-3 whitespace-nowrap">
                          {cell(r.record[f])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleCommit}
              disabled={saving || preview.newRows.length + selectedUpdates.size === 0}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2.5 font-semibold text-white transition-colors"
            >
              {saving ? progress || 'กำลังบันทึก...' : `บันทึก (เพิ่ม ${preview.newRows.length}, อัปเดต ${selectedUpdates.size})`}
            </button>
            <span className="text-xs text-gray-500">ช่องว่างในไฟล์ = ไม่แก้ค่าเดิม, วันที่เริ่มงานว่าง = ใช้เวลาปัจจุบัน (เฉพาะคนใหม่)</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-gray-800/60 border border-gray-700/60 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-2 ${color}`}>{title}</h3>
      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-gray-800 px-3">{children}</div>
    </div>
  )
}
