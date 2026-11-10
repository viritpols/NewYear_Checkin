# 🗄️ Database Setup Guide

## การตั้งค่า Database

### 1. สร้าง Database และ Tables

รัน SQL script เพื่อสร้าง database และ tables:

```bash
mysql -h 192.168.40.15 -P 3800 -u root -p < schema.sql
```

หรือเข้า MySQL และรัน:

```sql
source schema.sql
```

### 2. ตั้งค่า Environment Variables

คัดลอกไฟล์ `.env.example` เป็น `.env.local`:

```bash
cp .env.example .env.local
```

แก้ไขค่าตามต้องการ:

```env
DB_HOST=192.168.40.15
DB_USER=root
DB_PASSWORD=gp25095
DB_NAME=NYCheckin
DB_PORT=3800
```

### 3. ตรวจสอบการเชื่อมต่อ

หลังจากตั้งค่าแล้ว รัน server:

```bash
npm run dev
```

ระบบจะเชื่อมต่อกับ database อัตโนมัติ

## 📊 Database Schema

### Table: `feedback`

เก็บข้อมูล feedback จากผู้ใช้

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key, auto increment |
| starrate | INT | คะแนน (0-5) |
| comment | TEXT | ความเห็น |
| created_at | TIMESTAMP | เวลาที่สร้าง |

### Table: `checkins`

เก็บข้อมูลการเช็คอิน

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key, auto increment |
| employee_id | VARCHAR(50) | รหัสพนักงาน |
| name | VARCHAR(255) | ชื่อ-นามสกุล |
| checkin_time | TIMESTAMP | เวลาเช็คอิน |

## 🔌 API Endpoints

### POST `/api/feedback`

ส่ง feedback ไปยัง database

**Request Body:**
```json
{
  "starrate": 5,
  "comment": "ความเห็น..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "id": 1
}
```

### POST `/api/checkin`

เช็คอินพนักงาน

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "name": "สมชาย ใจดี"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Check-in successful",
  "id": 1,
  "checkinTime": "2026-01-01T10:00:00.000Z"
}
```

### GET `/api/feedback`

ดึงข้อมูล feedback ทั้งหมด (สำหรับ admin)

### GET `/api/checkin`

ดึงข้อมูล check-in ทั้งหมด (สำหรับ admin)

## 🔧 Troubleshooting

### ไม่สามารถเชื่อมต่อ Database ได้

1. ตรวจสอบว่า MySQL server กำลังรันอยู่
2. ตรวจสอบว่า IP, Port, Username, Password ถูกต้อง
3. ตรวจสอบว่า database `NYCheckin` ถูกสร้างแล้ว
4. ตรวจสอบ firewall settings

### Error: "Access denied"

ตรวจสอบว่า user มีสิทธิ์เข้าถึง database:

```sql
GRANT ALL PRIVILEGES ON NYCheckin.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

### Error: "Table doesn't exist"

รัน schema.sql อีกครั้ง:

```bash
mysql -h 192.168.40.15 -P 3800 -u root -p NYCheckin < schema.sql
```

## 📝 Notes

- Database connection ใช้ connection pooling เพื่อประสิทธิภาพที่ดี
- ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อ submit form
- Environment variables จะถูกโหลดจาก `.env.local` ใน development mode

