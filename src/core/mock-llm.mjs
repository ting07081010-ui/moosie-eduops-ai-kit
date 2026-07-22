/**
 * Deterministic local responses for the documented fake-data CLI path.
 * Mock mode never contacts an external model.
 */

function parsePayload(payload) {
  if (typeof payload !== 'string') return payload || {}

  try {
    return JSON.parse(payload)
  } catch {
    return { raw: payload }
  }
}

function studentCodeFrom(value) {
  const content = typeof value === 'string' ? value : JSON.stringify(value)
  return content.match(/S-\d{3}/)?.[0] || 'S-001'
}

function mockLessonRecord(payload) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const studentCode = studentCodeFrom(raw)

  return {
    studentCode,
    date: '2026-01-01',
    lessonType: 'speaking',
    topic: 'Past tense practice',
    learningObjective: 'Use three past-tense sentences to describe yesterday',
    skills: { speaking: 3, grammar: 3, participation: 4 },
    performance: 'Can form regular past tense and still mixes up some irregular verbs.',
    evidence: ['Can say three past-tense sentences with one self-correction.'],
    homeworkStatus: 'partial',
    parentAction: '每天用 3 分鐘請孩子說出三個 yesterday 句子。',
    teacherNextStep: '下次用短句口說活動練習 irregular verbs。',
    retentionSignal: 'green',
    attendance: 'present',
  }
}

function mockParentSummary(payload) {
  const lessonRecord = parsePayload(payload)
  const studentCode = lessonRecord.studentCode || 'S-001'
  const evidence = lessonRecord.evidence?.[0] || '能說出三個 past tense 句子'
  const topic = lessonRecord.topic || '本週的課堂重點'
  const parentAction = lessonRecord.parentAction || '每天用 3 分鐘請孩子說出三個句子'
  const teacherNextStep = lessonRecord.teacherNextStep || '下次用短句活動確認理解'

  return `${studentCode} 本次課堂中 ${evidence}。目前會持續練習 ${topic} 的關鍵句型；家長可 ${parentAction}。下次老師會 ${teacherNextStep}`
}

function mockRiskReport(payload) {
  const { draft = '' } = parsePayload(payload)
  const mentionsOtherStudent = /其他同學|別的小朋友|班上同學|其他學生/.test(draft)
  const overPromising = /一定|保證|guarantee|definitely/i.test(draft)
  const tone = /很差|態度有問題|不認真|太混|lazy/i.test(draft) ? 'blaming' : 'supportive'

  return {
    privacyRisk: mentionsOtherStudent ? 'high' : 'none',
    overPromising,
    tone,
    mentionsOtherStudent,
    hasObservableBehavior: /能|會|已|說出|寫出|完成|混淆/.test(draft),
    hasParentAction: /在家|每天|請孩子|分鐘|可以|練習|讀|聽|說|寫/.test(draft),
  }
}

function mockTasks(payload) {
  const lessonRecord = parsePayload(payload)
  const studentCode = lessonRecord.studentCode || 'S-001'

  return {
    tasks: [
      {
        title: 'Prepare a short irregular-verb speaking drill',
        owner: 'teacher',
        pool: 'teacher_task',
        due: 'next lesson',
        priority: 'med',
        studentCode,
      },
      {
        title: 'Send the approved home-practice reminder',
        owner: 'admin',
        pool: 'admin_task',
        due: 'this week',
        priority: 'low',
        studentCode,
      },
      {
        title: 'Practise three past-tense sentences for three minutes',
        owner: 'parent',
        pool: 'parent_action',
        due: 'this week',
        priority: 'med',
        studentCode,
      },
    ],
    summary: {
      teacher_tasks: 1,
      admin_tasks: 1,
      parent_actions: 1,
    },
  }
}

/**
 * Produce a response in the same shape as the local caller expects.
 *
 * @param {string} systemPrompt
 * @param {unknown} userPayload
 * @returns {string}
 */
export function createMockResponse(systemPrompt, userPayload) {
  if (systemPrompt.includes('Teacher After-Class Note Prompt')) {
    return JSON.stringify(mockLessonRecord(userPayload))
  }

  if (systemPrompt.includes('Parent Weekly Summary Prompt')) {
    return mockParentSummary(userPayload)
  }

  if (systemPrompt.includes('Parent Message Risk Check Prompt')) {
    return JSON.stringify(mockRiskReport(userPayload))
  }

  if (systemPrompt.includes('Admin Task Router Prompt')) {
    return JSON.stringify(mockTasks(userPayload))
  }

  return JSON.stringify({ mode: 'mock', studentCode: studentCodeFrom(userPayload) })
}
