## สรุป


## Impact ผลกระทบ


| ด้าน | รายละเอียด |
|------|------------|
| ผู้ใช้ / หน้าจอ | เช่น หน้าไหนเห็นผล / ไม่กระทบ UI |
| API / Backend | เช่น endpoint ที่เกี่ยว / ไม่เปลี่ยน contract |
| Deploy / Env | เช่น ต้อง rebuild image, แก้ `.env`, migrate |
| ความเสี่ยง | Low / Medium / High — อธิบายสั้นๆ |

- [ ] Breaking change
- [ ] ต้อง deploy พร้อม backend
- [ ] ต้องแก้ env / config บน server

## Action steps ขั้นตอนดำเนินการ


## รูป / Evidence



## Checklist
- [ ] ทดสอบบน local แล้ว
- [ ] ไม่มี secret ใน diff (`.env`, key, token)
- [ ] ถ้าแก้ API route — ตรวจ async `params` / env แล้ว
- [ ] แนบรูปหรือหลักฐานประกอบ (ถ้าเกี่ยวกับ UI / bugfix)
