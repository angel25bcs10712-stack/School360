# School360 Voice — three-minute demo

## 0:00–0:25 — The need

“Parents should not need fluent English or a complicated form to ask about their
school. School360 Voice makes the conversation the interface. This is a Kanpur
pilot prototype; the sample school is explicitly marked as demo data.”

## 0:25–0:55 — Discover a school

Open the school search and search for “Kanpur”. Select the **DEMO DATA** school.
Show that it has no invented map point and that each infrastructure condition is
unknown/unverified rather than presented as a verified fact.

Tap **English** in the top bar to switch the interface and assistant to English,
then tap **हिंदी** to return to Hindi.

## 0:55–1:25 — Speak or type

Allow microphone access if the browser supports Hindi speech recognition. Say:
“इस स्कूल की पानी की टंकी खराब है।” Otherwise type the same sentence. The assistant
identifies an issue and asks which school, or confirms the already selected school.

## 1:25–1:55 — Submit a real report

Confirm the report. Show the confirmation only after the API returns successfully,
including the highlighted report ID card in chat. Its **Track status** button
opens the lookup; the same ID is also saved under **My reports** in this browser.
Explain that report details and status history are stored in PostgreSQL.

## 1:55–2:20 — Track progress

Open “मेरी रिपोर्ट” and look up the new ID. Show its submitted status. Explain that
citizen reports are unverified until an authorized person checks them.

## 2:20–2:50 — Admin view

Show live dashboard counts and the recent report. Enter the local demo admin
password, update the status to “Under review”, and refresh the report lookup.
The database status history records the change.

## 2:50–3:00 — Close

“Speak. Discover. Report. Improve. This prototype provides a no-key local fallback;
real launch needs verified school data, proper admin authentication, and a district
response workflow.”
