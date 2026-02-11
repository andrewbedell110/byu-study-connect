// ============================================
// BYU CLASS LIST
// Organized by department for easy browsing
// ============================================

const BYU_CLASSES = [
  // Accounting
  { id: "ACC200", name: "ACC 200 - Principles of Accounting" },
  { id: "ACC201", name: "ACC 201 - Intro to Financial Accounting" },
  { id: "ACC310", name: "ACC 310 - Intermediate Financial Accounting I" },
  { id: "ACC410", name: "ACC 410 - Intermediate Financial Accounting II" },

  // Biology
  { id: "BIO100", name: "BIO 100 - Principles of Biology" },
  { id: "BIO130", name: "BIO 130 - Intro to Human Anatomy" },
  { id: "BIO220", name: "BIO 220 - Principles of Cell Biology" },
  { id: "BIO350", name: "BIO 350 - Genetics" },
  { id: "BIO420", name: "BIO 420 - Molecular Biology" },

  // Business Management
  { id: "BUS100", name: "BUS M 100 - Intro to Business Management" },
  { id: "BUS201", name: "BUS M 201 - Principles of Management" },
  { id: "BUS301", name: "BUS M 301 - Organizational Behavior" },
  { id: "BUS340", name: "BUS M 340 - Business Finance" },

  // Chemistry
  { id: "CHEM105", name: "CHEM 105 - General College Chemistry I" },
  { id: "CHEM106", name: "CHEM 106 - General College Chemistry II" },
  { id: "CHEM221", name: "CHEM 221 - Organic Chemistry I" },
  { id: "CHEM222", name: "CHEM 222 - Organic Chemistry II" },
  { id: "CHEM351", name: "CHEM 351 - Biochemistry" },

  // Communications
  { id: "COMMS101", name: "COMMS 101 - Intro to Communications" },
  { id: "COMMS210", name: "COMMS 210 - Media Literacy" },
  { id: "COMMS320", name: "COMMS 320 - Public Relations" },

  // Computer Science
  { id: "CS111", name: "CS 111 - Intro to Computer Science" },
  { id: "CS142", name: "CS 142 - Intro to Computer Programming" },
  { id: "CS235", name: "CS 235 - Data Structures" },
  { id: "CS240", name: "CS 240 - Advanced Software Construction" },
  { id: "CS312", name: "CS 312 - Algorithm Design & Analysis" },
  { id: "CS340", name: "CS 340 - Software Design" },

  // Economics
  { id: "ECON110", name: "ECON 110 - Economic Principles and Problems" },
  { id: "ECON230", name: "ECON 230 - Principles of Microeconomics" },
  { id: "ECON231", name: "ECON 231 - Principles of Macroeconomics" },
  { id: "ECON380", name: "ECON 380 - Intermediate Microeconomics" },
  { id: "ECON381", name: "ECON 381 - Intermediate Macroeconomics" },

  // English
  { id: "ENG150", name: "ENGL 150 - Intro to Literary Analysis" },
  { id: "ENG210", name: "ENGL 210 - English Language" },
  { id: "ENG251", name: "ENGL 251 - American Literary History I" },
  { id: "ENG292", name: "ENGL 292 - World Literature" },
  { id: "ENG316", name: "ENGL 316 - Technical Communication" },

  // Exercise Science
  { id: "EXSC305", name: "EXSC 305 - Physiology of Exercise" },
  { id: "EXSC410", name: "EXSC 410 - Biomechanics" },

  // History
  { id: "HIST200", name: "HIST 200 - Intro to Historical Methods" },
  { id: "HIST201", name: "HIST 201 - US History to 1877" },
  { id: "HIST202", name: "HIST 202 - US History Since 1877" },
  { id: "HIST310", name: "HIST 310 - European History" },

  // Information Systems
  { id: "IS201", name: "IS 201 - Intro to Management Information Systems" },
  { id: "IS303", name: "IS 303 - Database Design" },
  { id: "IS401", name: "IS 401 - Enterprise Architecture" },

  // Marketing
  { id: "MKTG201", name: "MKTG 201 - Principles of Marketing" },
  { id: "MKTG301", name: "MKTG 301 - Consumer Behavior" },
  { id: "MKTG380", name: "MKTG 380 - Marketing Research" },
  { id: "MKTG410", name: "MKTG 410 - Digital Marketing" },

  // Math
  { id: "MATH110", name: "MATH 110 - College Algebra" },
  { id: "MATH112", name: "MATH 112 - Calculus I" },
  { id: "MATH113", name: "MATH 113 - Calculus II" },
  { id: "MATH213", name: "MATH 213 - Calculus III" },
  { id: "MATH215", name: "MATH 215 - Linear Algebra" },
  { id: "MATH313", name: "MATH 313 - Intro to Real Analysis" },

  // Music
  { id: "MUSIC101", name: "MUSIC 101 - Intro to Music" },
  { id: "MUSIC160", name: "MUSIC 160 - Music Theory I" },
  { id: "MUSIC260", name: "MUSIC 260 - Music Theory II" },

  // Nursing
  { id: "NURS200", name: "NURS 200 - Intro to Nursing" },
  { id: "NURS310", name: "NURS 310 - Health Assessment" },
  { id: "NURS350", name: "NURS 350 - Pathophysiology" },

  // Philosophy
  { id: "PHIL110", name: "PHIL 110 - Intro to Philosophy" },
  { id: "PHIL201", name: "PHIL 201 - History of Philosophy" },
  { id: "PHIL305", name: "PHIL 305 - Ethics" },

  // Physics
  { id: "PHYS105", name: "PHYS 105 - General Physics I" },
  { id: "PHYS106", name: "PHYS 106 - General Physics II" },
  { id: "PHYS121", name: "PHYS 121 - Intro to Newtonian Mechanics" },
  { id: "PHYS220", name: "PHYS 220 - Intro to Modern Physics" },

  // Political Science
  { id: "POLI110", name: "POLI 110 - American Heritage" },
  { id: "POLI200", name: "POLI 200 - Intro to Political Science" },
  { id: "POLI310", name: "POLI 310 - International Relations" },

  // Psychology
  { id: "PSYCH111", name: "PSYCH 111 - General Psychology" },
  { id: "PSYCH307", name: "PSYCH 307 - Developmental Psychology" },
  { id: "PSYCH310", name: "PSYCH 310 - Abnormal Psychology" },
  { id: "PSYCH340", name: "PSYCH 340 - Social Psychology" },
  { id: "PSYCH381", name: "PSYCH 381 - Research Methods" },

  // Religion
  { id: "REL121", name: "REL A 121 - Book of Mormon I" },
  { id: "REL122", name: "REL A 122 - Book of Mormon II" },
  { id: "REL211", name: "REL A 211 - New Testament I" },
  { id: "REL275", name: "REL A 275 - Teachings of the Living Prophets" },
  { id: "REL324", name: "REL C 324 - Doctrine & Covenants I" },

  // Sociology
  { id: "SOC111", name: "SOC 111 - Intro to Sociology" },
  { id: "SOC301", name: "SOC 301 - Social Research Methods" },
  { id: "SOC310", name: "SOC 310 - Sociology of the Family" },

  // Statistics
  { id: "STAT121", name: "STAT 121 - Principles of Statistics" },
  { id: "STAT230", name: "STAT 230 - Applied Regression Analysis" },
  { id: "STAT340", name: "STAT 340 - Probability & Statistics" },

  // Writing
  { id: "WRTG150", name: "WRTG 150 - Writing and Rhetoric" },
  { id: "WRTG316", name: "WRTG 316 - Technical Communication" }
];

export default BYU_CLASSES;
