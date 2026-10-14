const storageKey='lhf.admin.language.v1';
let language='en';try{language=localStorage.getItem(storageKey)==='th'?'th':'en';}catch{}
export const getLanguage=()=>language;
export const locale=()=>language==='th'?'th-TH':'en-GB';
export function setLanguage(value){language=value==='th'?'th':'en';try{localStorage.setItem(storageKey,language);}catch{}document.documentElement.lang=language;return language;}
document.documentElement.lang=language;
// Thai copy is written for a florist team; keep order and customer data unchanged.
const dictionary=Object.fromEntries(`Today	วันนี้
Orders	ออเดอร์
Calendar	ปฏิทิน
Earnings	รายรับ
Settings	ตั้งค่า
Workspace	ระบบจัดการร้าน
THE STUDIO	ระบบจัดการร้าน
Studio account	บัญชีผู้ใช้
Open as app	เปิดเป็นแอป
App information	ข้อมูลแอป
Sign out	ออกจากระบบ
View website ↗	ดูเว็บไซต์ ↗
Little House Flower	Little House Flower
CLIENT DEMO · SYNTHETIC DATA	ระบบตัวอย่างสำหรับลูกค้า · ข้อมูลจำลอง
Welcome to the studio	ยินดีต้อนรับสู่ระบบจัดการร้าน
A quiet place to care for every order. Choose a demo role to explore the hosted client demo.	จัดการทุกออเดอร์ได้ในที่เดียว เลือกบทบาทเพื่อทดลองใช้ระบบตัวอย่างสำหรับลูกค้า
Staff role	บทบาทผู้ใช้งาน
Owner · full access	เจ้าของร้าน · จัดการได้ทุกส่วน
Staff · orders and payments	พนักงาน · จัดการออเดอร์และการชำระเงิน
Read-only · view only	ผู้ดูข้อมูล · ดูได้อย่างเดียว
Open the studio →	เข้าสู่ระบบจัดการร้าน →
Enter demo workspace	เข้าสู่ระบบตัวอย่าง
This hosted client demo uses synthetic records. Google Sheets, shop notifications and customer messages are disconnected.	ระบบตัวอย่างสำหรับลูกค้านี้ใช้ข้อมูลจำลอง และยังไม่ได้เชื่อมต่อ Google Sheets การแจ้งเตือนร้าน หรือการส่งข้อความหาลูกค้า
A little care, every day.	ดูแลทุกรายละเอียดของออเดอร์วันนี้
Your flowers, handovers and little things to follow up.	เช็กงานจัดดอกไม้ นัดรับและจัดส่ง พร้อมติดตามเรื่องที่ต้องคุยกับลูกค้า
Refresh	รีเฟรช
NEW REQUESTS	ออเดอร์ใหม่
DUE TODAY · OPEN ORDERS	ออเดอร์ที่ต้องส่งมอบวันนี้
OUTSTANDING · ACTIVE QUOTES	ยอดค้างชำระ · ออเดอร์ที่ยังไม่เสร็จ
FILTERED · AWAITING CONFIRMATION	รอยืนยัน · เฉพาะรายการที่เลือก
FILTERED · DUE TODAY	ส่งมอบวันนี้ · เฉพาะรายการที่เลือก
FILTERED · OUTSTANDING ACTIVE QUOTES	ยอดค้างชำระ · เฉพาะรายการที่เลือก
Outstanding includes recorded delivery fees; unpriced requests are excluded.	ยอดค้างชำระรวมค่าจัดส่งที่บันทึกไว้แล้ว โดยไม่รวมออเดอร์ที่ยังไม่ได้เสนอราคา
A little room to prepare for what’s next.	วันนี้ไม่มีออเดอร์รอส่งมอบ เตรียมงานถัดไปได้เลย
Your next arrangements are gathered here.	ดูออเดอร์ที่ต้องเตรียมต่อได้ที่นี่
TODAY’S HANDOVERS	ออเดอร์ที่ต้องส่งมอบวันนี้
UPCOMING ARRANGEMENTS	ออเดอร์ที่ใกล้ถึงกำหนด
On the flower bench	งานที่ต้องเตรียม
All orders →	ดูออเดอร์ทั้งหมด →
No open arrangements to prepare.	ยังไม่มีออเดอร์ที่รอจัดเตรียม
A CONVERSATION TO BEGIN	รอติดต่อยืนยันกับลูกค้า
Awaiting your care	ออเดอร์รอยืนยัน
All new requests have been reviewed.	ตรวจสอบออเดอร์ใหม่ครบแล้ว
Review all new requests →	ดูออเดอร์ใหม่ทั้งหมด →
THE SMALL DETAILS	รายละเอียดเล็ก ๆ ที่สำคัญ
A card. A ribbon. A thoughtful handover.	เช็กการ์ด ริบบิ้น และรายละเอียดก่อนส่งมอบ
Open an order to review its design, prepare a message card and confirm the details with your customer.	เปิดดูแบบดอกไม้และข้อความบนการ์ดในแต่ละออเดอร์ แล้วตรวจสอบรายละเอียดกับลูกค้าก่อนจัดเตรียม
Plan the week →	ดูตารางงานสัปดาห์นี้ →
Little House Flower · The Studio	Little House Flower · ระบบจัดการร้าน
Read-only access · you can inspect orders but cannot save changes.	ดูข้อมูลได้อย่างเดียว · เปิดดูออเดอร์ได้ แต่แก้ไขหรือบันทึกไม่ได้
Updated orders are available.	มีข้อมูลออเดอร์ใหม่เข้ามา
Show updates	แสดงข้อมูลล่าสุด
Every little detail.	ทุกออเดอร์ ทุกรายละเอียด
The orders that need your care, all in one place.	รวมออเดอร์ที่ต้องจัดการไว้ในที่เดียว
All orders	ออเดอร์ทั้งหมด
Not started	ยังไม่เริ่มจัด
Due today	ส่งมอบวันนี้
Shipped	กำลังจัดส่ง
Awaiting payment	รอชำระเงิน
Needs attention	ต้องตรวจสอบ
New requests	ออเดอร์ใหม่
Today’s reservations	ออเดอร์วันนี้
Search orders	ค้นหาออเดอร์
Reference, name or phone	เลขออเดอร์ ชื่อ หรือเบอร์โทร
Status	สถานะ
All statuses	ทุกสถานะ
Fulfilment	วิธีรับสินค้า
All fulfilment	ทุกวิธีรับสินค้า
Pick-up	รับที่ร้าน
Delivery	จัดส่ง
pickup	รับที่ร้าน
delivery	จัดส่ง
Needed date	วันที่ต้องการรับ
Order type	ประเภทออเดอร์
All designs	ทุกประเภท
Catalogue	แบบสำเร็จของร้าน
Custom	ออกแบบตามสั่ง
Made to order	ออกแบบตามสั่ง
Payment state	สถานะการชำระเงิน
All payments	ทุกสถานะการชำระเงิน
Unpaid	ยังไม่ชำระ
Deposit / part paid	มัดจำ / ชำระบางส่วน
Paid	ชำระครบแล้ว
Part refunded	คืนเงินบางส่วน
Refunded	คืนเงินแล้ว
unpaid	ยังไม่ชำระ
part-paid	ชำระบางส่วน
paid	ชำระครบแล้ว
part-refunded	คืนเงินบางส่วน
refunded	คืนเงินแล้ว
From date	ตั้งแต่วันที่
To date	ถึงวันที่
Sort orders	เรียงออเดอร์
Needs care first	งานที่ต้องจัดการก่อน
Newest first	ใหม่สุดก่อน
Oldest first	เก่าสุดก่อน
Needed date first	วันรับสินค้าใกล้สุดก่อน
No orders match these filters.	ไม่พบออเดอร์ที่ตรงกับตัวกรอง
Clear filters	ล้างตัวกรอง
Order / design	ออเดอร์ / แบบดอกไม้
Needed	วันที่ต้องการรับ
Payment	การชำระเงิน
Confirmed quote	ราคาที่ตกลงแล้ว
Quote pending	รอเสนอราคา
Time to confirm	รอยืนยันเวลา
Date to confirm	รอยืนยันวันที่
New / awaiting confirmation	ใหม่ / รอยืนยัน
Confirmed / not started	ยืนยันแล้ว / ยังไม่เริ่มจัด
In progress	กำลังจัดเตรียม
Ready	พร้อมส่งมอบ
Out for delivery	กำลังจัดส่ง
Completed	เสร็จสิ้น
Cancelled	ยกเลิก
Needs review	ต้องตรวจสอบ
Details requested	รอรายละเอียดจากลูกค้า
Delivery issue	มีปัญหาการจัดส่ง
Saved	บันทึกแล้ว
Sync pending	รอบันทึกข้อมูล
Close ×	ปิด ×
Close	ปิด
Save changes	บันทึกการแก้ไข
Save and close	บันทึกแล้วปิด
Save order changes	บันทึกการแก้ไขออเดอร์
Keep editing	แก้ไขต่อ
Discard changes	ไม่บันทึกการแก้ไข
Discard drafts	ไม่เก็บข้อมูลที่ร่างไว้
Discard all changes	ไม่บันทึกทั้งหมด
You have unsaved changes.	มีการแก้ไขที่ยังไม่ได้บันทึก
You have unsaved order changes and payment or reply drafts.	มีรายละเอียดออเดอร์ที่แก้ไข รวมถึงรายการชำระเงินหรือข้อความตอบลูกค้าที่ยังไม่ได้บันทึก
You have an unrecorded payment or a reply draft that has not been copied.	มีรายการชำระเงินที่ยังไม่ได้บันทึก หรือข้อความตอบลูกค้าที่ยังไม่ได้คัดลอก
Payments are recorded only with Record payment. Saving an order will keep these drafts open.	หากต้องการบันทึกรายการชำระเงิน ให้กด “บันทึกการชำระเงิน” การบันทึกออเดอร์จะไม่บันทึกรายการนี้หรือปิดข้อความที่ร่างไว้
A payment is being recorded. Please wait for the result before closing.	กำลังบันทึกรายการชำระเงิน กรุณารอให้เสร็จก่อนปิด
Please wait for the payment result before saving order changes.	กรุณารอให้บันทึกรายการชำระเงินเสร็จก่อนบันทึกออเดอร์
Save or discard your order changes before recording a payment. Your payment draft will stay here.	กรุณาบันทึกหรือยกเลิกการแก้ไขออเดอร์ก่อนบันทึกการชำระเงิน รายการชำระเงินที่กรอกไว้จะยังอยู่
The handover	รายละเอียดการส่งมอบ
Requested	วันและเวลาที่ต้องการรับ
Unscheduled	ยังไม่กำหนดวันรับ
Customer	ลูกค้า
Not recorded	ยังไม่ได้บันทึก
LINE contact	ช่องทางติดต่อทาง LINE
Recipient	ผู้รับ
Address	ที่อยู่
Card	การ์ดข้อความ
No message	ไม่มีข้อความ
Anonymous	ไม่เปิดเผยชื่อผู้ส่ง
Yes	ใช่
No	ไม่ใช่
Collect from the shop	รับสินค้าที่ร้าน
Copy reference	คัดลอกเลขอ้างอิง
Copy address	คัดลอกที่อยู่
Copy LINE contact	คัดลอก LINE
Print work ticket	พิมพ์ใบงาน
Print free message card	พิมพ์การ์ดให้ลูกค้า
Customer reply draft	ร่างข้อความตอบลูกค้า
Editable customer reply draft	ข้อความตอบลูกค้า (แก้ไขได้)
Copy reply draft	คัดลอกข้อความ
Edit and copy this draft for your chosen contact channel. This workspace never sends customer messages.	แก้ไขและคัดลอกข้อความไปส่งผ่านช่องทางที่ต้องการ ระบบนี้จะไม่ส่งข้อความหาลูกค้าอัตโนมัติ
Prepare & confirm	จัดเตรียมออเดอร์และยืนยันรายละเอียด
Completed/cancelled record · changes need an owner correction and a reason. Payments remain a separate ledger.	ออเดอร์นี้เสร็จสิ้นหรือยกเลิกแล้ว หากต้องการแก้ไข เจ้าของร้านต้องระบุเหตุผล รายการชำระเงินยังบันทึกแยกต่างหาก
Owner correction / reopen (reason required)	แก้ไขหรือเปิดออเดอร์อีกครั้งในสิทธิ์เจ้าของร้าน (ต้องระบุเหตุผล)
Needs customer details	รอรายละเอียดเพิ่มเติมจากลูกค้า
Delivery issue needs attention	ต้องตรวจสอบปัญหาการจัดส่ง
Confirmed arrangement quote (THB)	ราคาดอกไม้ที่ตกลงแล้ว (บาท)
Delivery fee (THB, blank means unconfirmed)	ค่าจัดส่ง (บาท · เว้นว่างถ้ายังไม่ตกลงราคา)
Arrangement quote and delivery fee are separate. Outstanding includes the confirmed delivery fee; cash receipts record actual payments only.	ราคาดอกไม้และค่าจัดส่งบันทึกแยกกัน ยอดค้างชำระรวมค่าจัดส่งที่ตกลงแล้ว ส่วนรายรับนับเฉพาะเงินที่ได้รับจริง
Staff notes	หมายเหตุภายในร้าน
Reason for change	เหตุผลในการแก้ไข
Required for quote changes, cancellation or corrections	ระบุเหตุผลเมื่อเปลี่ยนราคา ยกเลิก หรือแก้ไขออเดอร์
Saving…	กำลังบันทึก…
Order changes saved	บันทึกการแก้ไขออเดอร์แล้ว
Compare changes before merging	ตรวจสอบข้อมูลก่อนบันทึกทับ
Field	รายการ
Current server value	ข้อมูลล่าสุดในระบบ
Your proposed value	ข้อมูลที่คุณแก้ไข
Keep my draft and use current revision	เก็บสิ่งที่แก้ไขไว้และโหลดข้อมูลล่าสุด
Discard my edits and reload	ยกเลิกสิ่งที่แก้ไขแล้วโหลดใหม่
Not set	ยังไม่ระบุ
Payments	การชำระเงิน
Net receipts	ยอดรับเงินสุทธิ
Outstanding	ยอดค้างชำระ
Legacy paid label has no reliable payment date. Excluded from period receipts until an audited correction supplies evidence.	ข้อมูลเดิมระบุว่าชำระแล้ว แต่ไม่มีหลักฐานยืนยันวันที่รับเงิน จึงยังไม่นับเป็นรายรับของช่วงเวลานี้จนกว่าจะตรวจสอบและแก้ไขข้อมูล
Receipt / deposit	รับชำระเงิน / รับมัดจำ
Refund	คืนเงิน
Bank transfer	โอนเงิน
Cash	เงินสด
Other	อื่น ๆ
Event type	ประเภทรายการ
Amount (THB)	จำนวนเงิน (บาท)
Received / refunded at (Bangkok)	วันที่และเวลารับเงิน / คืนเงิน (เวลาไทย)
Payment method	วิธีชำระเงิน
Payment reference	เลขอ้างอิงการชำระเงิน
Payment reason	หมายเหตุการรับเงิน / คืนเงิน
Required for refunds	ต้องระบุเหตุผลในการคืนเงิน
Optional bank or receipt reference	เลขอ้างอิงธนาคารหรือใบเสร็จ (ถ้ามี)
Record payment	บันทึกการชำระเงิน
Payment recorded	บันทึกการชำระเงินแล้ว
Activity	ประวัติการดำเนินการ
A week in flowers.	ตารางงานประจำสัปดาห์
Plan around requested handover dates. Times are requests, not guaranteed slots.	วางแผนงานตามวันรับสินค้าที่ลูกค้าเลือก โดยวันและเวลารับต้องยืนยันกับลูกค้าอีกครั้ง
← Previous	← ก่อนหน้า
Next →	ถัดไป →
Starting date	วันเริ่มต้น
Week view	รายสัปดาห์
Day view	รายวัน
↑ Pick-up	↑ รับที่ร้าน
→ Delivery	→ จัดส่ง
No reservations	ยังไม่มีคำจอง
Overdue / needs attention	เลยกำหนด / ต้องตรวจสอบ
Money, clearly.	สรุปรายรับของร้าน
The studio settings.	ตั้งค่าร้าน
Month	เดือน
Year	ปี
Week	สัปดาห์
Apply	แสดงข้อมูล
Period	ช่วงเวลา
Gross receipts	ยอดรับเงินรวม
Refunds	ยอดคืนเงิน
Verified zero	ตรวจสอบแล้วว่าไม่มีรายการ
Unknown history	ยังไม่มีข้อมูลยืนยัน
Partial data	ข้อมูลยังไม่ครบ
Complete data	ข้อมูลครบถ้วน
Revenue	รายรับ
Coverage	ความครบถ้วนของข้อมูล
No data	ไม่มีข้อมูล
Request failed	ดำเนินการไม่สำเร็จ
Unable to load	โหลดข้อมูลไม่ได้
Retry	ลองใหม่
Connection unavailable	เชื่อมต่อไม่ได้
Connecting…	กำลังเชื่อมต่อ…
Connection needs attention	การเชื่อมต่อมีปัญหา
Refresh failed · keeping current on-screen records	รีเฟรชไม่สำเร็จ · ยังคงแสดงข้อมูลที่เปิดอยู่ตอนนี้
Offline · keeping current on-screen records	ออฟไลน์ · ยังคงแสดงข้อมูลที่เปิดอยู่ตอนนี้
Session expired · sign in again to refresh	หมดเวลาใช้งาน · กรุณาเข้าสู่ระบบอีกครั้งเพื่อดูข้อมูลล่าสุด
Reconnecting · keeping current records	กำลังเชื่อมต่อใหม่ · ระหว่างนี้ยังแสดงข้อมูลเดิม
Reference copied	คัดลอกเลขอ้างอิงแล้ว
Address copied	คัดลอกที่อยู่แล้ว
LINE contact copied	คัดลอก LINE แล้ว
Draft copied · no message was sent	คัดลอกข้อความแล้ว · ยังไม่ได้ส่งให้ลูกค้า
Style	รูปแบบ
Flowers	ชนิดดอกไม้
Palette	โทนสีดอกไม้
Container	ภาชนะ
Finish	สีวัสดุห่อ / ภาชนะ
Ribbon	ริบบิ้น
Size	ขนาด
Based on	แบบสินค้าที่ใช้อ้างอิง
Bouquet	ช่อดอกไม้
Basket	กระเช้า
Basket or vase	กระเช้าหรือแจกัน
Box	กล่องดอกไม้
Flower box	กล่องดอกไม้
Money	ช่อธนบัตร
Money bouquet	ช่อธนบัตร
Wreath	พวงหรีด
Wedding	งานแต่งงาน
Bridal / wedding	ช่อเจ้าสาว / งานแต่งงาน
Garland	พวงมาลัย
Paper	กระดาษห่อ
Layered foam	โฟมซ้อนชั้น
Wicker basket	ตะกร้าหวาย
Vase	แจกัน
Hat box	กล่องดอกไม้
Wreath frame	โครงพวงหรีด
Hand-tied	มัดก้านเป็นช่อ
Hand-threaded	ร้อยเป็นพวงมาลัย
White	ขาว
Cream	ครีม
Pink	ชมพู
Black	ดำ
Blue	ฟ้า
Natural	สีวัสดุธรรมชาติ
Burgundy	แดงไวน์
Red	แดง
Yellow	เหลือง
Green	เขียว
Pastel	พาสเทล
Mixed	หลากสี
White & green	ขาวและเขียว
Pink & white	ชมพูและขาว
Yellow & white	เหลืองและขาว
Blue & white	ฟ้าและขาว
Florist’s choice	ให้ทางร้านเลือกให้
Similar to reference	ใกล้เคียงแบบอ้างอิง
Smaller	เล็กกว่าแบบอ้างอิง
Larger	ใหญ่กว่าแบบอ้างอิง
White Rose	กุหลาบขาว
Red Rose	กุหลาบแดง
Pink Rose	กุหลาบชมพู
Lily	ลิลลี่
Lisianthus	ลิเซียนทัส
Carnation	คาร์เนชั่น
Stock	ดอกสต็อก
Gerbera	เยอบีร่า
Baby's Breath	ยิปโซ
Babys Breath	ยิปโซ
Eucalyptus	ยูคาลิปตัส
Sunflower	ทานตะวัน
Chamomile	คาโมมายล์
Wax Flower	ดอกแว็กซ์
Jasmine	มะลิ
Hydrangea	ไฮเดรนเยีย
Pompon	ปอมปอม
Soap Rose	กุหลาบสบู่
Forget Me Not	ฟอร์เก็ตมีน็อต
Banknotes	ธนบัตร
Actual shop product	ภาพสินค้าจริงของร้าน
AI concept	ภาพตัวอย่างจาก AI
AI generated concept	ภาพตัวอย่างจาก AI
Live composition	ภาพจำลองตามแบบที่เลือก
Live composition preview	ภาพจำลองตามแบบที่เลือก
Live composition preview — illustrative	ภาพจำลองตามแบบที่เลือก · ใช้ประกอบการออกแบบ
Custom design snapshot	แบบดอกไม้ที่ลูกค้าเลือก
No final florist photo	ยังไม่มีภาพดอกไม้ที่จัดเสร็จจริง
Price confirmation needed	รอยืนยันราคา
Not specified	ยังไม่ระบุ
Order at a glance	สรุปออเดอร์
Requested date	วันที่ต้องการรับ
Requested time	เวลาที่ต้องการรับ
Delivery / collection	วิธีรับสินค้า
Flower colours	สีดอกไม้
Wrapping / container	วัสดุห่อ / ภาชนะ
Wrapping colour	สีวัสดุห่อ / ภาชนะ
Product details	รายละเอียดสินค้า
Quantity	จำนวน
Customer colour request	สีที่ลูกค้าระบุ
Customer instructions	คำขอและรายละเอียดเพิ่มเติม
No additional instructions	ไม่มีคำขอเพิ่มเติม
Not specified — confirm with customer	ยังไม่ระบุ · ต้องยืนยันกับลูกค้า
Catalogue reference	แบบสินค้าที่ใช้อ้างอิง
These are catalogue details. Confirm any requested changes with the customer.	นี่คือรายละเอียดของแบบสินค้าจากทางร้าน หากลูกค้าขอปรับเปลี่ยน ให้ยืนยันรายละเอียดกับลูกค้าอีกครั้ง
Saved order design	แบบดอกไม้ที่บันทึกไว้ในออเดอร์
Customer’s selected design	แบบที่ลูกค้าเลือก
Enlarge product image	ขยายภาพสินค้า
Close image	ปิดภาพ
Enlarged product image	ภาพสินค้าขนาดใหญ่
Zoom in	ขยายภาพ
Zoom out	ย่อภาพ
Reference photo	ภาพอ้างอิง
Message card	ข้อความบนการ์ด
Estimated price	ราคาโดยประมาณ
Requested budget	งบประมาณที่ลูกค้าระบุ
Banknote face value	มูลค่าเงินในช่อธนบัตร
Image unavailable	แสดงภาพไม่ได้
No preview available	ยังไม่มีภาพตัวอย่าง
Product description	คำอธิบายสินค้า
cm	ซม.
Image unavailable · configuration and notes are preserved.	แสดงภาพไม่ได้ แต่รายละเอียดแบบและหมายเหตุยังอยู่ครบ
Private customer reference · never sent to a provider by default	ภาพอ้างอิงส่วนตัวของลูกค้า · ไม่ส่งให้บริการภายนอกโดยอัตโนมัติ
Private customer reference	ภาพอ้างอิงส่วนตัวของลูกค้า
Florist consultation requested	ลูกค้าต้องการปรึกษาเรื่องแบบดอกไม้
A little space of your own.	แอปจัดการร้าน Little House Flower
Open Little House Flower Studio in its own window, with a dedicated app icon and no browser tabs.	เปิดระบบจัดการร้าน Little House Flower ในหน้าต่างแยก พร้อมไอคอนแอปโดยไม่มีแถบเบราว์เซอร์
Use your browser’s Install app or Add to Home Screen option. Safari on macOS can use File → Add to Dock.	ใช้เมนู Install app หรือ Add to Home Screen ของเบราว์เซอร์ หากใช้ Safari บน macOS ให้เลือก File → Add to Dock
Manage orders, handover dates and payments in one place.	ดูแลออเดอร์ นัดรับหรือจัดส่ง และบันทึกการชำระเงินได้ในที่เดียว
Got it	เข้าใจแล้ว
Skip to workspace	ข้ามไปยังเนื้อหาหลัก
Receipts minus refunds, by payment date in Asia/Bangkok. This is cash received, not profit.	คำนวณจากเงินที่รับจริงหักเงินคืน โดยยึดวันที่ทำรายการตามเวลาไทย ยอดนี้เป็นรายรับ ไม่ใช่กำไร
No recorded data	ยังไม่มีข้อมูลที่บันทึก
Complete ledger	ข้อมูลการชำระเงินครบถ้วน
Complete ledger · verified zero	ข้อมูลครบถ้วน · ยืนยันว่าไม่มีรายการ
Partial history	ข้อมูลย้อนหลังยังไม่ครบ
NET RECEIPTS	ยอดรับเงินสุทธิ
RECORDED NET · PARTIAL	ยอดรับเงินสุทธิที่บันทึกไว้ · ข้อมูลยังไม่ครบ
RECORDED NET · UNKNOWN	ยอดรับเงินสุทธิที่บันทึกไว้ · ยังยืนยันข้อมูลย้อนหลังไม่ได้
CONFIRMED VALUE · HANDOVER DATE	มูลค่าออเดอร์ที่ยืนยันแล้ว · ตามวันส่งมอบ
OUTSTANDING · CONFIRMED ORDERS	ยอดค้างชำระ · ออเดอร์ที่ยืนยันแล้ว
COMPLETED · HANDOVER DATE	ออเดอร์เสร็จสิ้น · ตามวันส่งมอบ
Week starting	สัปดาห์ที่เริ่มวันที่
No percentage available	ข้อมูลไม่เพียงพอสำหรับคำนวณเปอร์เซ็นต์
Gross receipts and refunds in Thai baht; complete data, partial data and unknown history are labelled. Use the data table below for values.	แสดงยอดรับเงินและยอดคืนเงินเป็นบาท พร้อมระบุว่าข้อมูลแต่ละช่วงครบถ้วนหรือไม่ ดูตัวเลขได้ในตารางด้านล่าง
Focus or point at a bar to inspect its values.	ชี้ที่แท่งกราฟ หรือใช้แป้น Tab เลือกแท่งกราฟเพื่อดูตัวเลข
Contributing orders	ออเดอร์ที่เกี่ยวข้อง
Solid green: complete receipts · Hatched green: partial history · Rose: refunds · Gray: unknown · A short solid bar can mean verified zero.	เขียวทึบ: ข้อมูลครบ · เขียวลาย: ข้อมูลบางส่วน · ชมพู: คืนเงิน · เทา: ไม่ทราบข้อมูล · แท่งสั้นอาจหมายถึงยอดศูนย์ที่ตรวจสอบแล้ว
Pass-through amounts & order context	ค่าจัดส่งและเงินในช่อธนบัตร
These values are shown separately where recorded. They are not extra cash receipts and do not establish florist service income.	แสดงเฉพาะยอดที่บันทึกไว้เพื่อประกอบการตรวจสอบ ไม่ได้นำมาบวกเป็นรายรับซ้ำ และไม่ถือว่าทั้งหมดเป็นรายได้ค่าจัดดอกไม้
Production in this handover period	งานที่ต้องส่งมอบในช่วงนี้
No matching orders	ไม่พบออเดอร์ที่ตรงกับเงื่อนไข
Current period is partial; no percentage comparison	ช่วงปัจจุบันยังไม่สิ้นสุด จึงไม่เปรียบเทียบเป็นเปอร์เซ็นต์
Previous complete period of equal length	เทียบกับช่วงก่อนหน้าที่มีจำนวนวันเท่ากันและข้อมูลครบถ้วน
Comparison unavailable: incomplete ledger coverage	เปรียบเทียบไม่ได้ เนื่องจากข้อมูลการชำระเงินไม่ครบ
Connection and storage settings.	การเชื่อมต่อและการจัดเก็บข้อมูล
Connections	การเชื่อมต่อ
Google Sheets: disconnected	Google Sheets: ยังไม่เชื่อมต่อ
Order records: saved online	ข้อมูลออเดอร์: บันทึกออนไลน์
Automatic notifications: not connected	การแจ้งเตือนอัตโนมัติ: ยังไม่ได้เชื่อมต่อ
Image previews: available	ภาพตัวอย่าง: พร้อมใช้งาน
Google Sheets is not connected.	ยังไม่ได้เชื่อมต่อ Google Sheets
Online storage	การจัดเก็บข้อมูล
Persisted online	บันทึกในระบบออนไลน์
Storage checked {time}	ตรวจสอบที่เก็บข้อมูลเมื่อ {time}
Changes are saved online. Google Sheets and automatic notifications are not connected.	บันทึกการแก้ไขออนไลน์แล้ว ยังไม่ได้เชื่อมต่อ Google Sheets และการแจ้งเตือนอัตโนมัติ
The website and Studio share the same saved order records.	เว็บไซต์และระบบจัดการร้านใช้ข้อมูลออเดอร์ชุดเดียวกัน
Sync & recovery	อัปเดตข้อมูลและกู้คืน
Not synced	ยังไม่ซิงค์
Simulate Sheet service	จำลองบริการชีต
Healthy	เชื่อมต่อปกติ
Rate limit (429)	เกินจำนวนคำขอ (429)
Server error (500)	เซิร์ฟเวอร์ขัดข้อง (500)
Offline	ออฟไลน์
Lose acknowledgment after save	จำลองบันทึกสำเร็จแต่ไม่ได้รับการตอบกลับ
Retry pending operations	ลองรายการที่ค้างอยู่อีกครั้ง
Demo simulator updated	อัปเดตการตั้งค่าระบบจำลองแล้ว
Demo writes queued for retry	เพิ่มรายการในระบบตัวอย่างที่บันทึกไม่สำเร็จเข้าคิวเพื่อลองใหม่แล้ว
Conflicts requiring review	ข้อมูลไม่ตรงกัน · ต้องตรวจสอบ
Review required	ต้องตรวจสอบ
Open affected order	เปิดออเดอร์ที่เกี่ยวข้อง
Resolve conflict	ตรวจสอบและเลือกข้อมูลที่ถูกต้อง
Append a demo Sheet StaffUpdates request	เพิ่มคำขอแก้ไขออเดอร์ผ่านชีตจำลอง
Demo Sheet → staff workspace	ชีตจำลอง → ระบบจัดการร้าน
This simulates a staff change request in the demo Sheet fixture. The shared worker validates the revision and updates every staff view.	จำลองคำขอแก้ไขของพนักงานในชีตตัวอย่าง ระบบจะตรวจสอบรุ่นข้อมูลและอัปเดตหน้าจอของพนักงานทุกคน
Order	ออเดอร์
Staff note	หมายเหตุภายในร้าน
Append StaffUpdates request	เพิ่มคำขอแก้ไขจากพนักงาน
Queued in the demo Sheet fixture	เพิ่มเข้าคิวในชีตจำลองแล้ว
Coverage, retention & identity	ความครบถ้วนของข้อมูล อายุการเก็บ และบัญชีผู้ใช้
not seeded	ยังไม่มีข้อมูลตั้งต้น
Retention status unavailable in this demo.	ระบบตัวอย่างยังไม่มีข้อมูลสถานะการเก็บรักษาข้อมูล
Before any future live use	ก่อนเชื่อมต่อระบบจริง
Connect server-verified staff identity, approve option and pricing rules, authorize a sandbox Sheet and map headers, and review image/privacy/retention policies. This preview does not enable these services.	ต้องยืนยันบัญชีพนักงาน อนุมัติตัวเลือกและกฎราคา เชื่อมต่อชีตทดลองพร้อมจับคู่คอลัมน์ และตรวจสอบนโยบายภาพ ความเป็นส่วนตัว และอายุข้อมูลก่อน ตัวอย่างนี้ยังไม่ได้เปิดใช้บริการเหล่านี้
Private reference assets use authenticated routes. Payment entries are separate from estimates and confirmed order values.	ภาพอ้างอิงส่วนตัวต้องผ่านการตรวจสอบสิทธิ์ รายการชำระเงินแยกจากราคาประมาณการและมูลค่าออเดอร์ที่ยืนยัน
Resolve Sheet conflict	ตรวจสอบข้อมูลที่ไม่ตรงกับชีต
Resolution reason	เหตุผลในการเลือกข้อมูล
Saving resolution…	กำลังบันทึกผลการตรวจสอบ…
Resolution saved	บันทึกผลการตรวจสอบแล้ว
Choose which reviewed values to keep. Every resolution records your reason and a new revision. No customer message is sent.	ตรวจสอบแล้วเลือกข้อมูลที่ต้องการใช้ ระบบจะบันทึกเหตุผลและเก็บเป็นข้อมูลรุ่นใหม่ โดยไม่ส่งข้อความถึงลูกค้า
Studio record	ข้อมูลในระบบร้าน
Detected Sheet change	การแก้ไขที่พบในชีต
Rejected request	คำขอถูกปฏิเสธ
Keep studio values	ใช้ข้อมูลในระบบร้าน
Apply reviewed Sheet values	ใช้ข้อมูลชีตที่ตรวจสอบแล้ว
Google Sheets cannot make arbitrary human edits transactional. Protect system fields before any future authorized connection.	การแก้ไขชีตโดยตรงไม่สามารถรับประกันความสอดคล้องทุกครั้งได้ ต้องป้องกันคอลัมน์ของระบบก่อนเชื่อมต่อจริง
Demo Sheet simulator · Google disconnected	ชีตจำลอง · ยังไม่เชื่อมต่อ Google
January	มกราคม
February	กุมภาพันธ์
March	มีนาคม
April	เมษายน
May	พฤษภาคม
June	มิถุนายน
July	กรกฎาคม
August	สิงหาคม
September	กันยายน
October	ตุลาคม
November	พฤศจิกายน
December	ธันวาคม
receipt	รับเงิน
refund	คืนเงิน
bank_transfer	โอนเงิน
cash	เงินสด
card	บัตร
other	อื่น ๆ
Revision	รุ่นข้อมูล
Notes	หมายเหตุ
ConfirmedTotal	ราคาที่ตกลงแล้ว
DeliveryFee	ค่าจัดส่ง
NeedsDetails	รอรายละเอียดจากลูกค้า
DeliveryIssue	ปัญหาการจัดส่ง
synced	ซิงค์แล้ว
pending	รอดำเนินการ
failed	ไม่สำเร็จ
owner	เจ้าของร้าน
staff	พนักงาน
read-only	ผู้ดูข้อมูล
Owner workspace	บัญชีเจ้าของร้าน
Staff workspace	บัญชีพนักงาน
Read Only workspace	บัญชีผู้ดูข้อมูล
New requests · {count}	ออเดอร์ใหม่ · {count}
Today’s reservations · {count}	ออเดอร์วันนี้ · {count}
Needs attention · {count}	ต้องตรวจสอบ · {count}
{count} reservations	{count} ออเดอร์
{count} handover to care for today.	มี {count} ออเดอร์ที่ต้องส่งมอบวันนี้
{count} handovers to care for today.	มี {count} ออเดอร์ที่ต้องส่งมอบวันนี้
{count} new request is waiting for your confirmation.	มีออเดอร์ใหม่รอยืนยัน {count} รายการ
{count} new requests are waiting for your confirmation.	มีออเดอร์ใหม่รอยืนยัน {count} รายการ
Payments · {status}	การชำระเงิน · {status}
Net receipts {net} · Outstanding {outstanding}	ยอดรับเงินสุทธิ {net} · ค้างชำระ {outstanding}
ORDER DETAILS · REVISION {revision}	รายละเอียดออเดอร์ · รุ่นที่ {revision}
Synthetic demo record · {state}	ข้อมูลจำลองในระบบตัวอย่าง · {state}
Connected · updated {time}	เชื่อมต่อแล้ว · อัปเดต {time}
Hosted demo storage updated {time} · {pending} pending · {retry} need retry	ที่เก็บข้อมูลระบบตัวอย่างอัปเดต {time} · รอดำเนินการ {pending} · ต้องลองใหม่ {retry}
Configuration: {version}	รุ่นการตั้งค่า: {version}
Pending writes: {pending} · Dead letters: {retry}	รอบันทึก: {pending} · ต้องลองใหม่: {retry}
Conflicts: {conflicts} · Quarantined: {quarantine}	ข้อมูลขัดแย้ง: {conflicts} · รอตรวจสอบ: {quarantine}
Verified-zero demo month: {zero} · Missing-history example: {missing}	เดือนจำลองที่ยืนยันยอดศูนย์: {zero} · ตัวอย่างเดือนที่ประวัติไม่ครบ: {missing}
Last retention run {date} · {count} records · reconciled {reconciled}	ตรวจสอบอายุข้อมูลล่าสุด {date} · {count} รายการ · ตรวจสอบตรงกัน {reconciled}
Resolve {reference}	ตรวจสอบ {reference}
{coverage}. Blank history is never shown as zero. {count} paid records lack a dated receipt.	{coverage} ประวัติที่ยังไม่มีข้อมูลจะไม่แสดงเป็นยอดศูนย์ มีออเดอร์ที่ระบุว่าชำระแล้ว {count} รายการที่ยังไม่มีหลักฐานวันรับเงิน
{pending} unpriced requests remain pending. {confirmed} confirmed orders · Average {average}.	รอเสนอราคา {pending} ออเดอร์ · ยืนยันแล้ว {confirmed} ออเดอร์ · ราคาเฉลี่ย {average}
Gross {gross} · Refunds {refunds}	ยอดรับเงินรวม {gross} · คืนเงิน {refunds}
Recorded delivery fees: {delivery} · Banknotes requested: {banknotes}	ค่าจัดส่งที่บันทึกไว้: {delivery} · เงินในช่อธนบัตรที่ลูกค้าระบุ: {banknotes}
{status} · {count}	{status} · {count}
{role} workspace	บัญชี{role}
Owner	เจ้าของร้าน
Staff	พนักงาน
Read Only	ผู้ดูข้อมูล
Offline / stale · {reason}	ออฟไลน์ / ข้อมูลยังไม่อัปเดต · {reason}
Saved online · {state} · {pending} pending · {retry} need retry	บันทึกออนไลน์ · {state} · รอดำเนินการ {pending} · ต้องลองใหม่ {retry}
updated {time}	อัปเดต {time}
waiting	รออัปเดต
last update over 30 seconds ago	อัปเดตล่าสุดเกิน 30 วินาทีแล้ว
Order record · {status}	ข้อมูลออเดอร์ · {status}
Current revision {revision} loaded. Your inputs remain. Review the comparison and save deliberately.	โหลดข้อมูลล่าสุด (รุ่นที่ {revision}) แล้ว โดยเก็บสิ่งที่คุณแก้ไขไว้ กรุณาตรวจสอบความแตกต่างก่อนกดบันทึก
; gross {gross}, refunds {refunds}, net {net}	; รับเงินรวม {gross}, คืนเงิน {refunds}, รับเงินสุทธิ {net}
There are unsaved order or payment/reply drafts. Sign out and discard them?	มีการแก้ไขออเดอร์ รายการชำระเงิน หรือข้อความตอบลูกค้าที่ยังไม่ได้บันทึก ต้องการออกจากระบบโดยไม่เก็บข้อมูลเหล่านี้หรือไม่?
Little House Flower · Today	Little House Flower · วันนี้
LITTLE HOUSE FLOWER / STUDIO	LITTLE HOUSE FLOWER / ระบบจัดการร้าน
View {id}	ดู {id}
Occasion	โอกาสที่ใช้ดอกไม้
Design preferences	รูปแบบและรายละเอียดที่ต้องการ
Month view	รายเดือน
Complete synthetic ledger coverage	ข้อมูลการชำระเงินจำลองครบถ้วน
Partial history · recorded events only	ข้อมูลย้อนหลังยังไม่ครบ · แสดงเฉพาะรายการที่บันทึกไว้
Cash: payment event date. Confirmed value and outstanding: requested handover date. Cancelled/new/review excluded from confirmed metrics.	รายรับอิงวันที่รับเงินจริง ส่วนมูลค่าออเดอร์และยอดค้างชำระอิงวันส่งมอบที่ลูกค้าระบุ ยอดที่ยืนยันแล้วจะไม่รวมออเดอร์ใหม่ ออเดอร์ยกเลิก และออเดอร์ที่รอตรวจสอบ
From {name}	จาก {name}
Order {reference}	ออเดอร์ {reference}
Order 	ออเดอร์\u0020
View {reference}	ดูออเดอร์ {reference}
With love.	ด้วยรักและความปรารถนาดี
Newest reservation	ออเดอร์ใหม่สุดก่อน
Credit / debit card	บัตรเครดิต / เดบิต
Choose language	เลือกภาษา
Language	ภาษา
Natural green	เขียวธรรมชาติ
Seasonal colour — florist confirmation	สีตามฤดูกาล · ให้ทางร้านยืนยันอีกครั้ง
Smaller than reference — confirm with florist	เล็กกว่าแบบอ้างอิง · ให้ทางร้านยืนยันอีกครั้ง
Larger than reference — confirm with florist	ใหญ่กว่าแบบอ้างอิง · ให้ทางร้านยืนยันอีกครั้ง
Staff sign-in required	กรุณาเข้าสู่ระบบพนักงานก่อนใช้งาน
Read-only role cannot make changes	บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่สามารถแก้ไขได้
Use the separate admin app	กรุณาเปิดผ่านแอปจัดการร้าน
Choose a demo role	กรุณาเลือกบทบาทที่ต้องการทดลองใช้งาน
Owner role required	เฉพาะเจ้าของร้านเท่านั้นที่ดำเนินการนี้ได้
Order not found	ไม่พบออเดอร์นี้
Demo service error	ระบบตัวอย่างขัดข้อง กรุณาลองใหม่
Use a valid report range of at most ten years	กรุณาเลือกช่วงวันที่ให้ถูกต้อง โดยมีระยะเวลาไม่เกิน 10 ปี
Unsupported report grouping	ไม่รองรับการจัดกลุ่มรายงานแบบนี้
Transition not allowed; owner correction required	เปลี่ยนเป็นสถานะนี้ไม่ได้ ต้องให้เจ้าของร้านแก้ไขออเดอร์
Cancellation, review resolution or correction requires a reason	กรุณาระบุเหตุผลก่อนยกเลิกออเดอร์ ยืนยันผลการตรวจสอบ หรือแก้ไขข้อมูล
This order changed in another view. Review server values before saving your draft.	ออเดอร์นี้มีการแก้ไขจากหน้าจออื่น กรุณาเทียบกับข้อมูลล่าสุดก่อนบันทึก
Owner role required to resolve a Sheet conflict	ต้องให้เจ้าของร้านตรวจสอบและเลือกข้อมูลที่ถูกต้องเมื่อข้อมูลในชีตไม่ตรงกัน
Conflict resolution requires a reason	กรุณาระบุเหตุผลในการเลือกข้อมูล
Conflict is no longer available; refresh Settings	ไม่พบรายการข้อมูลที่ไม่ตรงกันนี้แล้ว กรุณารีเฟรชหน้าตั้งค่า
Choose a conflict resolution	กรุณาเลือกข้อมูลที่ต้องการใช้
The Sheet conflict changed. Reopen it to review current values.	ข้อมูลในชีตเปลี่ยนไปแล้ว กรุณาเปิดรายการนี้อีกครั้งเพื่อตรวจสอบข้อมูลล่าสุด
This rejected change has no validated external values to apply	คำขอนี้ถูกปฏิเสธ จึงไม่มีข้อมูลจากชีตที่ผ่านการตรวจสอบให้นำมาใช้
Completed or cancelled records require an owner correction with a reason	ออเดอร์ที่เสร็จสิ้นหรือยกเลิกแล้ว แก้ไขได้เฉพาะเจ้าของร้านและต้องระบุเหตุผล
Notes must be at most 4000 characters	หมายเหตุยาวได้ไม่เกิน 4,000 ตัวอักษร
Attention flags must be true or false	กรุณาเลือกหรือยกเลิกเครื่องหมายในรายการที่ต้องตรวจสอบ
Use a non-negative amount of at most THB 1,000,000	กรุณาระบุจำนวนเงินตั้งแต่ 0 ถึง 1,000,000 บาท
Quote or delivery fee changes require a reason	กรุณาระบุเหตุผลที่เปลี่ยนราคาดอกไม้หรือค่าจัดส่ง
The confirmed quote cannot be below recorded net receipts; record an audited refund first	ลดราคาต่ำกว่ายอดรับเงินสุทธิที่บันทึกไว้ไม่ได้ กรุณาตรวจสอบและบันทึกการคืนเงินก่อน
The external revision is invalid; repair the protected Sheet revision before resolution	เลขรุ่นข้อมูลในชีตไม่ถูกต้อง กรุณาแก้ไขคอลัมน์รุ่นข้อมูลของระบบก่อนเลือกข้อมูลที่จะใช้
Invalid payment event	ข้อมูลการชำระเงินไม่ถูกต้อง กรุณาตรวจสอบรายการและจำนวนเงิน
This idempotency key belongs to a different payment	เลขอ้างอิงการบันทึกนี้ถูกใช้กับรายการชำระเงินอื่นแล้ว กรุณาตรวจสอบก่อนบันทึกใหม่
Use a valid payment date no later than now	กรุณาระบุวันและเวลาที่รับเงินหรือคืนเงินจริง โดยต้องไม่เป็นเวลาในอนาคต
Refund exceeds recorded receipts	ยอดคืนเงินเกินยอดรับเงินสุทธิที่บันทึกไว้
Refund requires a reason	กรุณาระบุเหตุผลในการคืนเงิน
Confirm a quote first; receipts cannot exceed the outstanding balance	ต้องยืนยันราคาออเดอร์ก่อนรับชำระเงิน และยอดรับต้องไม่เกินยอดค้างชำระ
A reversal must name a receipt on this order	รายการคืนเงินต้องอ้างอิงรายการรับเงินของออเดอร์นี้
Your session has expired. Sign in again to open this order.	หมดเวลาใช้งานแล้ว กรุณาเข้าสู่ระบบอีกครั้งเพื่อเปิดดูออเดอร์นี้
We could not load this order. Please check the connection and try again.	เปิดดูออเดอร์นี้ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง
Try again	ลองอีกครั้ง
Sign in again	เข้าสู่ระบบอีกครั้ง
Your session has expired. Sign in again to continue. Your unsaved entries will stay here.	หมดเวลาใช้งานแล้ว กรุณาเข้าสู่ระบบอีกครั้งเพื่อทำรายการต่อ ข้อมูลที่กรอกไว้จะยังอยู่ครบ
You are signed in again. Your unsaved entries are still here.	เข้าสู่ระบบแล้ว ทำรายการต่อได้เลย ข้อมูลที่กรอกไว้ยังอยู่ครบ
Hello {name}, here is an update on order {reference}: {status}. Requested handover: {date} {time}. Please contact the shop to confirm the details.	สวัสดีคุณ {name} ทางร้านขออัปเดตออเดอร์ {reference} ขณะนี้มีสถานะ: {status} วันและเวลารับสินค้าที่แจ้งไว้: {date} {time} รบกวนติดต่อทางร้านเพื่อยืนยันรายละเอียดอีกครั้ง
Sign in →	เข้าสู่ระบบ →
Workspace password	รหัสผ่านระบบจัดการร้าน
PASSWORD-PROTECTED DEMO	ระบบตัวอย่าง · เข้าด้วยรหัสผ่าน
Enter your workspace password to view the client demo.	กรอกรหัสผ่านเพื่อเข้าชมระบบตัวอย่างได้เลยค่ะ
This is a shared demonstration workspace. Orders and payments are test data; nothing is sent to the shop.	ระบบนี้จัดไว้ให้ทดลองใช้งาน ออเดอร์และยอดชำระเงินเป็นข้อมูลตัวอย่าง ไม่ได้ส่งรายการไปที่ร้าน
Unable to check sign-in settings. Please try again.	ตรวจสอบการเข้าสู่ระบบไม่ได้ในขณะนี้ กรุณาลองอีกครั้ง
Checking sign-in settings…	กำลังตรวจสอบการเข้าสู่ระบบ…
Password protection	รหัสผ่านเข้าใช้งาน
A password is required to enter this workspace.	ระบบนี้ตั้งรหัสผ่านไว้แล้ว ต้องกรอกรหัสผ่านก่อนเข้าใช้งาน
Set a password before sharing this workspace.	ตั้งรหัสผ่านก่อนส่งลิงก์ให้ผู้อื่นเข้าชมระบบ
Use 12–128 characters. Anyone with this password can edit the workspace.	ใช้รหัสผ่าน 12–128 ตัวอักษร ผู้ที่มีรหัสผ่านนี้จะดูและแก้ไขข้อมูลได้
Changing this password also changes access to the shared preview. Your browser may ask you to sign in again.	รหัสผ่านนี้ใช้เข้าลิงก์ตัวอย่างที่แชร์ไว้ด้วย หลังเปลี่ยนรหัสผ่าน เบราว์เซอร์อาจให้เข้าสู่ระบบใหม่
Set password	ตั้งรหัสผ่าน
Change password	เปลี่ยนรหัสผ่าน
Current password	รหัสผ่านปัจจุบัน
New password	รหัสผ่านใหม่
Confirm new password	ยืนยันรหัสผ่านใหม่
The new passwords do not match.	รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน กรุณากรอกอีกครั้ง
Password saved. Other staff sessions have been signed out.	บันทึกรหัสผ่านแล้ว อุปกรณ์อื่นที่เข้าใช้งานอยู่จะต้องเข้าสู่ระบบใหม่
Use a password with 12 to 128 characters.	กรุณาตั้งรหัสผ่านให้ยาว 12–128 ตัวอักษร
Incorrect password. Please try again.	รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง
Incorrect current password. Please try again.	รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง
Too many attempts. Please wait a minute and try again.	ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอหนึ่งนาทีแล้วลองใหม่
Sign-in is busy. Please try again shortly.	มีผู้กำลังเข้าสู่ระบบหลายคน กรุณารอสักครู่แล้วลองอีกครั้ง
The password changed. Sign in again before trying again.	รหัสผ่านถูกเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการต่อ
The demo is busy. Please try again later.	มีผู้ใช้ระบบตัวอย่างอยู่หลายคน กรุณาลองใหม่อีกครั้งในภายหลัง
The demo password has not been configured.	ยังไม่ได้ตั้งรหัสผ่านสำหรับระบบตัวอย่าง
Demo password protection is unavailable.	ระบบรหัสผ่านของตัวอย่างยังไม่พร้อมใช้งาน
Demo storage is unavailable.	พื้นที่เก็บข้อมูลของระบบตัวอย่างใช้งานไม่ได้ในขณะนี้
The demo service is unavailable. Please try again.	ระบบตัวอย่างใช้งานไม่ได้ในขณะนี้ กรุณาลองใหม่
The demo has reached its storage limit. Please contact the demo administrator.	พื้นที่เก็บข้อมูลของระบบตัวอย่างเต็มแล้ว กรุณาติดต่อผู้ดูแลระบบตัวอย่าง
Another update was saved first. Please refresh and try again. Your entries have not been saved.	มีผู้อื่นบันทึกข้อมูลก่อน กรุณารีเฟรชแล้วลองใหม่ ข้อมูลที่กรอกยังไม่ได้ถูกบันทึก
Google Sheets is disconnected in this hosted demo. Demo changes are saved online.	ระบบตัวอย่างออนไลน์นี้ยังไม่ได้เชื่อมต่อ Google Sheets การแก้ไขจะถูกบันทึกไว้ในระบบตัวอย่างเท่านั้น
The studio is temporarily unavailable.	ระบบจัดการร้านยังไม่พร้อมใช้งานในขณะนี้
Please check your connection and try again.	กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง
A quiet place to care for every order.	ดูแลทุกออเดอร์ได้ครบในที่เดียว
Data & storage	ข้อมูลและการจัดเก็บ
Retention information is unavailable.	ยังไม่มีข้อมูลการจัดเก็บและลบข้อมูล
Reference images are available in order details. Payment records are separate from estimates and confirmed order values.	ดูรูปอ้างอิงได้ในรายละเอียดออเดอร์ รายการรับเงินแยกจากราคาประมาณการและราคาที่ยืนยันแล้ว
Complete payment history	ประวัติการชำระเงินครบถ้วน
`.trim().split('\n').map(line=>line.split('\t')));
export function t(key,params={}){let value=language==='th'?(dictionary[key]??key):key;return String(value).replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(params,name)?String(params[name]):match);}
export const hasTranslation=key=>Object.hasOwn(dictionary,key);
export function addTranslations(entries){Object.assign(dictionary,entries);}
