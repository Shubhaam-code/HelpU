export const SAMPLE_COURSES = [
  {
    id: 'course-1',
    code: 'CSE2003',
    title: 'Computer Architecture and Organization',
    credits: 4,
    category: 'Programme Core',
    faculties: [
      {
        id: 'f-2003-1',
        name: 'KOMARASAMY G - SCAI',
        slot: 'B14+B23+D21',
        roomNo: 'AB02-423',
        classNo: 'BL2026270501056'
      },
      {
        id: 'f-2003-2',
        name: 'BUBAI MANNA - SCOPE',
        slot: 'B21+E14+E22',
        roomNo: 'AB02-317',
        classNo: 'BL2026270501057'
      },
      {
        id: 'f-2003-3',
        name: 'MITHUN SINGH AHIRWAR - SCAI',
        slot: 'A21+A22+A23',
        roomNo: 'AB02-217',
        classNo: 'BL2026270501058'
      },
      {
        id: 'f-2003-4',
        name: 'AMIT ABHISHEK - SCOPE',
        slot: 'B22+B24+F21',
        roomNo: 'AB02-017',
        classNo: 'BL2026270501059'
      }
    ]
  },
  {
    id: 'course-2',
    code: 'CSE3004',
    title: 'Design and Analysis of Algorithms',
    credits: 4,
    category: 'Programme Core',
    faculties: [
      {
        id: 'f-3004-1',
        name: 'BUBAI MANNA - SCOPE',
        slot: 'B21+E14+E22',
        roomNo: 'AB02-317',
        classNo: 'BL2026270501126'
      },
      {
        id: 'f-3004-2',
        name: 'KOMARASAMY G - SCAI',
        slot: 'B14+B23+D21',
        roomNo: 'AB02-423',
        classNo: 'BL2026270501127'
      },
      {
        id: 'f-3004-3',
        name: 'SARAVANAN S - SCOPE',
        slot: 'C11+C12+C13',
        roomNo: 'AB01-305',
        classNo: 'BL2026270501128'
      },
      {
        id: 'f-3004-4',
        name: 'PRIYA K - SENSE',
        slot: 'D11+D12+D21',
        roomNo: 'AB02-114',
        classNo: 'BL2026270501129'
      }
    ]
  },
  {
    id: 'course-3',
    code: 'CSE3005',
    title: 'Software Engineering',
    credits: 4,
    category: 'Programme Core',
    faculties: [
      {
        id: 'f-3005-1',
        name: 'MITHUN SINGH AHIRWAR - SCAI',
        slot: 'A21+A22+A23',
        roomNo: 'AB02-217',
        classNo: 'BL2026270500979'
      },
      {
        id: 'f-3005-2',
        name: 'DEEPAK MEHTA - SCOPE',
        slot: 'C21+C22+C23',
        roomNo: 'AB01-204',
        classNo: 'BL2026270500980'
      },
      {
        id: 'f-3005-3',
        name: 'ANITA YADAV - SASL',
        slot: 'D11+D12+D13',
        roomNo: 'AB02-413',
        classNo: 'BL2026270500981'
      },
      {
        id: 'f-3005-4',
        name: 'SWATI CHOUHAN - SCAI',
        slot: 'B11+B12+B13',
        roomNo: 'AB02-108',
        classNo: 'BL2026270500982'
      }
    ]
  },
  {
    id: 'course-4',
    code: 'CSE3006',
    title: 'Computer Networks',
    credits: 4,
    category: 'Programme Core',
    faculties: [
      {
        id: 'f-3006-1',
        name: 'AMIT ABHISHEK - SCOPE',
        slot: 'B22+B24+F21',
        roomNo: 'AB02-017',
        classNo: 'BL2026270501049'
      },
      {
        id: 'f-3006-2',
        name: 'RAJESH KUMAR - SCOPE',
        slot: 'A11+A12+A13',
        roomNo: 'AB01-412',
        classNo: 'BL2026270501050'
      },
      {
        id: 'f-3006-3',
        name: 'SURESH PATIL - SCAI',
        slot: 'D21+D22+D23',
        roomNo: 'AB02-511',
        classNo: 'BL2026270501051'
      },
      {
        id: 'f-3006-4',
        name: 'NEHA VERMA - SCOPE',
        slot: 'E21+E22+E23',
        roomNo: 'AB02-302',
        classNo: 'BL2026270501052'
      }
    ]
  },
  {
    id: 'course-5',
    code: 'CSE3015',
    title: 'AWS Cloud Practitioner',
    credits: 4,
    category: 'Programme Elective',
    faculties: [
      {
        id: 'f-3015-1',
        name: 'ETHNUS TRAINER 6 - ACAD',
        slot: 'C14+E11+E12',
        roomNo: 'AB02-224',
        classNo: 'BL2026270500847'
      },
      {
        id: 'f-3015-2',
        name: 'AWS CLOUD TRAINER 2',
        slot: 'B14+B21+B22',
        roomNo: 'AB02-225',
        classNo: 'BL2026270500848'
      },
      {
        id: 'f-3015-3',
        name: 'VIRTUSA LEAD TRAINER',
        slot: 'A14+A21+A22',
        roomNo: 'AB01-102',
        classNo: 'BL2026270500849'
      },
      {
        id: 'f-3015-4',
        name: 'CAMPUS TRAINER 4',
        slot: 'F11+F12+F14',
        roomNo: 'AB01-104',
        classNo: 'BL2026270500850'
      }
    ]
  }
];

// Helper to get all slots for VIT timetable matrix
export const VIT_TIME_COLUMNS = [
  { id: 't1', label: '08:30 - 10:00', start: '08:30', end: '10:00' },
  { id: 't2', label: '10:05 - 11:35', start: '10:05', end: '11:35' },
  { id: 't3', label: '11:40 - 13:10', start: '11:40', end: '13:10' },
  { id: 'lunch', label: 'Lunch', isLunch: true },
  { id: 't4', label: '13:15 - 14:45', start: '13:15', end: '14:45' },
  { id: 't5', label: '14:50 - 16:20', start: '14:50', end: '16:20' },
  { id: 't6', label: '16:25 - 17:55', start: '16:25', end: '17:55' },
  { id: 't7', label: '18:00 - 19:30', start: '18:00', end: '19:30' }
];

export const VIT_TIMETABLE_DAYS = [
  {
    day: 'MON',
    slots: {
      t1: 'A11',
      t2: 'B11',
      t3: 'C11',
      lunch: 'Lunch',
      t4: 'A21',
      t5: 'A14',
      t6: 'B21',
      t7: 'C21'
    }
  },
  {
    day: 'TUE',
    slots: {
      t1: 'D11',
      t2: 'E11',
      t3: 'F11',
      lunch: 'Lunch',
      t4: 'D21',
      t5: 'E14',
      t6: 'E21',
      t7: 'F21'
    }
  },
  {
    day: 'WED',
    slots: {
      t1: 'A12',
      t2: 'B12',
      t3: 'C12',
      lunch: 'Lunch',
      t4: 'A22',
      t5: 'B14',
      t6: 'B22',
      t7: 'A24'
    }
  },
  {
    day: 'THU',
    slots: {
      t1: 'D12',
      t2: 'E12',
      t3: 'F12',
      lunch: 'Lunch',
      t4: 'D22',
      t5: 'F14',
      t6: 'E22',
      t7: 'F22'
    }
  },
  {
    day: 'FRI',
    slots: {
      t1: 'A13',
      t2: 'B13',
      t3: 'C13',
      lunch: 'Lunch',
      t4: 'A23',
      t5: 'C14',
      t6: 'B23',
      t7: 'B24'
    }
  },
  {
    day: 'SAT',
    slots: {
      t1: 'D13',
      t2: 'E13',
      t3: 'F13',
      lunch: 'Lunch',
      t4: 'D23',
      t5: 'D14',
      t6: 'D24',
      t7: 'E23'
    }
  }
];
