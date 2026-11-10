# 🎉 ระบบเช็คอินงานปีใหม่ 2026

ระบบเช็คอินเข้างานปีใหม่สำหรับพนักงาน พัฒนาด้วย Next.js 14 และ TypeScript

## ✨ คุณสมบัติ

- 📝 ฟอร์มเช็คอินที่ใช้งานง่าย
- 👤 กรอกรหัสพนักงานและชื่อ-นามสกุล
- ✅ ตรวจสอบความถูกต้องของข้อมูล (Form Validation)
- 🎨 UI/UX สวยงาม แบบ CRM สมัยใหม่
- 📱 Responsive Design รองรับทุกขนาดหน้าจอ
- 🌈 Gradient สีสันสวยงามในธีมปีใหม่

## 🚀 การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
npm install
# หรือ
yarn install
# หรือ
pnpm install
```

### 2. ตั้งค่า Database

**สร้าง Database และ Tables:**
```bash
mysql -h 192.168.40.15 -P 3800 -u root -p < schema.sql
```

**ตั้งค่า Environment Variables:**
```bash
cp .env.example .env.local
```

แก้ไข `.env.local` ตามการตั้งค่าของคุณ

📖 ดูรายละเอียดเพิ่มเติมที่ [DATABASE_SETUP.md](./DATABASE_SETUP.md)

### 3. รันโปรเจค (Development Mode)

```bash
npm run dev
# หรือ
yarn dev
# หรือ
pnpm dev
```

เมื่อรันคำสั่ง จะแสดง URL สำหรับเข้าถึง:
- **Local:** `http://localhost:4101`
- **Network:** `http://<IP_ADDRESS>:4101`

เปิดเบราว์เซอร์ที่ URL ที่แสดง หรือ [http://localhost:4101](http://localhost:4101)

### 🌐 การเข้าถึงผ่าน IP Address

โปรเจกต์นี้ถูกตั้งค่าให้สามารถเข้าถึงได้ผ่าน IP Address จากอุปกรณ์อื่นในเครือข่ายเดียวกัน

**ดู IP Address:**
```bash
npm run ip
```

**URL สำหรับเข้าถึงจากอุปกรณ์อื่น:**
```
http://<IP_ADDRESS>:4101
```

ตัวอย่าง: `http://192.168.40.15:4101`

📖 ดูรายละเอียดเพิ่มเติมที่ [NETWORK_SETUP.md](./NETWORK_SETUP.md)

### 4. Build สำหรับ Production

```bash
npm run build
npm start
```

## 📁 โครงสร้างโปรเจค

```
newyear2026/
├── app/
│   ├── page.tsx          # หน้าหลัก (Check-in Page)
│   ├── layout.tsx        # Layout หลัก
│   └── globals.css       # Global styles
├── components/
│   ├── CheckInForm.tsx   # คอมโพเนนต์ฟอร์มเช็คอิน
│   └── Header.tsx        # คอมโพเนนต์ Header
├── scripts/
│   ├── get-ip.js         # Script แสดง IP Address
│   └── dev-with-ip.js   # Script รัน dev server พร้อมแสดง IP
├── public/               # Static files
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── NETWORK_SETUP.md      # คู่มือการตั้งค่าเครือข่าย
```

## 🎯 ฟีเจอร์หลัก

### 1. ฟอร์มเช็คอิน
- รหัสพนักงาน (Employee ID)
- ชื่อ-นามสกุล (Full Name)
- Validation แบบ Real-time

### 2. หน้า Success
- แสดงข้อมูลการเช็คอิน
- แสดงวันเวลาที่เช็คอิน
- ปุ่มเช็คอินคนต่อไป

### 3. ข้อมูลงาน
- วันที่จัดงาน
- เวลา
- สถานที่

## 🛠 เทคโนโลยีที่ใช้

- **Next.js 14** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Hooks** - State Management

## 📜 Scripts ที่มีให้

- `npm run dev` - รัน development server พร้อมแสดง IP address
- `npm run dev:ip` - รัน development server แบบ alternative
- `npm run ip` - แสดง IP address เท่านั้น
- `npm run build` - Build สำหรับ production
- `npm start` - รัน production server พร้อมแสดง IP address
- `npm run lint` - ตรวจสอบ code quality

## 📝 การพัฒนาต่อ

### API Routes

โปรเจกต์นี้มี API Routes อยู่แล้ว:

- **POST `/api/feedback`** - บันทึก feedback
- **POST `/api/checkin`** - บันทึกการเช็คอิน
- **GET `/api/feedback`** - ดึงข้อมูล feedback (admin)
- **GET `/api/checkin`** - ดึงข้อมูล check-in (admin)

### Database

โปรเจกต์ใช้ **MySQL** กับ connection pooling

- Database: `NYCheckin`
- Tables: `feedback`, `checkins`
- Connection config: ดูใน `.env.local`

📖 ดูรายละเอียดเพิ่มเติมที่ [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## 🎨 การปรับแต่ง UI

แก้ไขสีและธีมได้ที่:
- `tailwind.config.js` - สำหรับ Tailwind colors
- `app/globals.css` - สำหรับ Global styles
- `components/` - แต่ละ component

## 📱 Preview

หน้าแรก:
- ฟอร์มเช็คอิน
- ข้อมูลงานปีใหม่

หลังเช็คอิน:
- แสดงข้อมูลการเช็คอินสำเร็จ
- วันเวลาที่เช็คอิน

## 📄 License

MIT License

## 👨‍💻 Developer

สร้างโดย AI Assistant สำหรับงานปีใหม่ 2026

---

**Happy New Year 2026! 🎊🎉**

