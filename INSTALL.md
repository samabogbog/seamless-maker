# คู่มือการติดตั้งส่วนเสริม Seamless Maker (Installation Guide)

**Seamless Maker** เป็นส่วนเสริมแบบ CEP (Common Extensibility Platform) สำหรับ **Adobe Illustrator** บนระบบปฏิบัติการ Windows ออกแบบมาสำหรับสร้างและคำนวณลายต่อเนื่อง (Seamless Pattern & Tilted Lattice) ทั้งแบบ 4 ด้าน (All Sides) และบน-ล่าง (Top–Bottom) พร้อมระบบ Reverse Pattern Matcher

---

## 💻 ความต้องการของระบบ (System Requirements)

* **ระบบปฏิบัติการ:** Windows 10 / 11 (64-bit)
* **โปรแกรม:** Adobe Illustrator CC 2014 จนถึง Illustrator 2026 (CEP 5 – CEP 11+)
* **สิทธิ์การใช้งาน:** ไม่จำเป็นต้องใช้สิทธิ์ Administrator

---

## 🚀 วิธีการติดตั้ง (Installation Methods)

### วิธีที่ 1: ติดตั้งอัตโนมัติด้วย Install.cmd (แนะนำ)

1. **บันทึกงานและปิดโปรแกรม Adobe Illustrator ทั้งหมดก่อนติดตั้ง**
2. แตกไฟล์ ZIP หรือเปิดโฟลเดอร์โปรเจกต์ `seamless-maker-atv`
3. ดับเบิลคลิกไฟล์ **`Install.cmd`**
4. สคริปต์จะทำการ:
   * ตรวจสอบว่า Illustrator ปิดอยู่จริงหรือไม่
   * สำรองข้อมูลส่วนเสริมรุ่นเก่า (ถ้ามี) ไปไว้ที่โฟลเดอร์ `%TEMP%`
   * คัดลอกไฟล์ส่วนเสริมเวอร์ชันล่าสุดเข้าสู่โฟลเดอร์:
     `%APPDATA%\Adobe\CEP\extensions\com.seamlessmaker.panel`
5. หน้าต่าง Command Prompt จะแสดงข้อความ `Installed Seamless Maker files...` แสดงว่าติดตั้งเสร็จสมบูรณ์

---

### วิธีที่ 2: ติดตั้งด้วยตนเอง (Manual Installation)

หากต้องการคัดลอกไฟล์ด้วยตนเอง:
1. ปิดโปรแกรม Adobe Illustrator
2. กดปุ่ม `Win + R` บนคีย์บอร์ด พิมพ์ `%APPDATA%\Adobe\CEP\extensions` แล้วกด Enter
   *(หากโฟลเดอร์ `CEP` หรือ `extensions` ยังไม่มี ให้สร้างโฟลเดอร์ขึ้นมาใหม่)*
3. สร้างโฟลเดอร์ใหม่ชื่อ: `com.seamlessmaker.panel`
4. คัดลอกไฟล์และโฟลเดอร์ทั้งหมดที่อยู่ภายในโฟลเดอร์ `extension\` ของ Seamless Maker ไปวางลงใน:
   `%APPDATA%\Adobe\CEP\extensions\com.seamlessmaker.panel\`
   *(ตรวจสอบให้แน่ใจว่าไฟล์ `index.html` และโฟลเดอร์ `CSXS` อยู่ที่ระดับบนสุดของ `com.seamlessmaker.panel`)*

---

## 🔑 การเปิดโหมดทดสอบส่วนเสริม (PlayerDebugMode)

เนื่องจากส่วนเสริมเวอร์ชันสำหรับการพัฒนา (Development Build) ยังไม่ได้เซ็นรับรองด้วยใบรับรองเชิงพาณิชย์ของ Adobe Illustrator จึงจำเป็นต้องเปิดใช้งาน `PlayerDebugMode = "1"` ใน Windows Registry เพื่อให้ Illustrator ยอมรับการโหลดพาเนล CEP

สามารถเปิดได้ง่ายๆ โดยเปิด **PowerShell** หรือ **Command Prompt** แล้ววางคำสั่งต่อไปนี้ (กด Enter):

```cmd
reg add "HKCU\Software\Adobe\CSXS.5" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.6" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.7" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.8" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.13" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.14" /v PlayerDebugMode /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.15" /v PlayerDebugMode /t REG_SZ /d "1" /f
```

*(คำสั่งนี้จะเพิ่มค่าให้กับ CSXS ทุกเวอร์ชัน ทำให้รองรับ Illustrator ได้ตั้งแต่รุ่น CC 2014 จนถึงรุ่นล่าสุด)*

---

## 🎨 วิธีการเปิดใช้งานใน Illustrator

1. เปิดโปรแกรม Adobe Illustrator
2. ไปที่แถบเมนูด้านบน:
   * สำหรับ Illustrator รุ่นใหม่: **Window > Extensions > Seamless Maker**
   * สำหรับ Illustrator บางรุ่น: **Window > Extensions (Legacy) > Seamless Maker**
3. หน้าต่างพาเนล **Seamless Maker (เวอร์ชัน 1.1.10)** จะปรากฏขึ้นมาพร้อมใช้งาน

### ขั้นตอนการเริ่มสร้างลาย:
1. สร้างหรือเปิดเอกสาร Illustrator
2. เลือกวัตถุที่บันทึกเป็น **Symbol** ไว้แล้วบนอาร์ตบอร์ดเพียง 1 ชิ้น
3. กดปุ่ม **Use Selected Symbol** ในพาเนล
4. ปรับขนาดไทล์ (Tile Size) และรูปแบบการเรียง (Repeat Mode / Layout)
5. สลับดูตัวอย่างลายแบบ 1 ไทล์ หรือแบบ 9 ไทล์ (Repeat Preview)
6. กดปุ่ม **Create** เพื่อสร้างลายต่อเนื่องลงบนเลเยอร์ใหม่ทันที

---

## 🗑️ วิธีการถอนการติดตั้ง (Uninstall)

1. ปิดโปรแกรม Adobe Illustrator
2. ดับเบิลคลิกไฟล์ **`Uninstall.cmd`** ในโฟลเดอร์โปรเจกต์
   *(หรือลบโฟลเดอร์ `%APPDATA%\Adobe\CEP\extensions\com.seamlessmaker.panel` ด้วยตนเอง)*

---

## ❓ การแก้ไขปัญหาที่พบบ่อย (Troubleshooting)

| ปัญหา | สาเหตุที่อาจเกิดขึ้น | วิธีแก้ไข |
| --- | --- | --- |
| **รัน Install.cmd แล้วขึ้นเตือนให้ปิด Illustrator** | ยังมีโปรเซส Illustrator ค้างอยู่ในระบบ | ตรวจสอบใน Task Manager แล้วปิด `Illustrator.exe` ก่อนรันอีกครั้ง |
| **เปิด Illustrator แล้วไม่พบเมนู Seamless Maker** | ไม่ได้เปิด `PlayerDebugMode` หรือโฟลเดอร์ปลายทางไม่ถูกต้อง | รันคำสั่งเปิด `PlayerDebugMode` ใน Registry และตรวจสอบว่าโฟลเดอร์ใน `%APPDATA%\Adobe\CEP\extensions\com.seamlessmaker.panel` มีไฟล์ครบถ้วน |
| **พาเนลขึ้นหน้าจอว่างเปล่า (Blank Screen)** | สิทธิ์การเข้าถึงไฟล์ หรือ Host script โหลดไม่สมบูรณ์ | คลิกขวาบนพื้นที่ว่างในพาเนลแล้วเลือก **Reload** |
| **ปุ่ม Create กดไม่ได้ (Disabled)** | ยังไม่ได้เลือก Symbol หรือยังไม่ได้กด Use Selected Symbol | เลือก Symbol instance บนอาร์ตบอร์ดแล้วกดปุ่ม **Use Selected Symbol** ให้ขึ้นภาพพรีวิวสมบูรณ์ก่อน |
| **ต้องการรีเฟรชหน้าพาเนลหลังอัปเดตไฟล์** | เบราว์เซอร์ CEP จำแคชเดิมไว้ | คลิกขวาที่พาเนลใน Illustrator แล้วเลือก **Reload** หรือปิดพาเนลแล้วเปิดใหม่จากเมนู Window > Extensions |
