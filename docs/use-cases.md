# Use Cases

## 1. Weekly Parent Summary

**Who:** Teacher  
**Input:** Short after-class note (topic, performance, homework)  
**Output:** 120-180 character zh-TW message for parents  

**Example flow:**
```
Teacher writes: "S-001, past tense, good speaking, weak irregular verbs"
→ AI generates: 本週專注過去式口語表達，學生在規則動詞變化表現良好。
  不規則動詞仍需加強，建議在家練習 go→went, eat→ate 等常見變化。
```

## 2. Teacher After-Class Note

**Who:** Teacher  
**Input:** Rough, informal lesson notes  
**Output:** Structured JSON record  

Cleans up messy teacher notes into a consistent format for record-keeping.

## 3. Parent Message Risk Check

**Who:** Admin / Teacher  
**Input:** Draft parent message  
**Output:** Risk report (privacy, over-promising, tone)  

Catches problems before sending:
- References to other students
- Grade guarantees
- Cold or blaming tone

## 4. Admin Task Extraction

**Who:** School admin  
**Input:** Teacher's lesson notes  
**Output:** List of action items with owner, due date, priority  

Automatically pulls out follow-ups like "send worksheet" or "notify parent about missing homework."

## 5. Student Progress Diagnosis

**Who:** Tutor / Teacher  
**Input:** Multiple lesson records for one student  
**Output:** Strengths, gaps, recommended focus areas  

For internal planning — identifies trends across weeks of lessons.
