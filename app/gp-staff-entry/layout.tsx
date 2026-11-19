import type { Metadata } from 'next'

// หน้าลับ: ไม่ให้ search engine เก็บ และไม่มีลิงก์จากหน้าอื่น
export const metadata: Metadata = {
  title: 'เพิ่มรายชื่อพนักงาน',
  robots: { index: false, follow: false, nocache: true },
}

export default function StaffEntryLayout({ children }: { children: React.ReactNode }) {
  return children
}
