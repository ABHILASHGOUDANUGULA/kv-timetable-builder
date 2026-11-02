
// KVS Subject Presets
// Based on the uploaded Revised Distribution of Periods PDF
// Academic Session: 2026-27

export const KVS_SUBJECT_PRESETS = {
  foundational: {
    name: "Foundational Stage",
    classes: ["I", "II"],
    subjects: [
      { name: "Hindi (R1)", shortName: "Hindi", periods: 10 },
      { name: "English (R2)", shortName: "English", periods: 10 },
      { name: "Mathematics", shortName: "Maths", periods: 10 },
      { name: "Gardening", shortName: "Grdn", periods: 4 },
      { name: "Arts", shortName: "Arts", periods: 6 },
      { name: "Physical Education", shortName: "PE", periods: 4 },
      { name: "Library", shortName: "Lib", periods: 2 },
      {
        name: "Creative Learning Activities",
        shortName: "CLA",
        periods: 2,
      },
    ],
    totalPeriods: 48,
  },

  preparatory: {
    name: "Preparatory Stage",
    classes: ["III", "IV", "V"],
    subjects: [
      { name: "Hindi (R1)", shortName: "Hindi", periods: 7 },
      { name: "English (R2)", shortName: "English", periods: 7 },
      { name: "Mathematics", shortName: "Maths", periods: 8 },
      {
        name: "Computational Thinking",
        shortName: "CPT",
        periods: 2,
      },
      {
        name: "The World Around Us",
        shortName: "TWAU",
        periods: 8,
      },
      { name: "Arts", shortName: "Arts", periods: 5 },
      { name: "Physical Education", shortName: "PE", periods: 5 },
      { name: "Library", shortName: "Lib", periods: 2 },
      { name: "Digital Literacy", shortName: "DL", periods: 2 },
      {
        name: "Creative Learning Activities",
        shortName: "CLA",
        periods: 2,
      },
    ],
    totalPeriods: 48,
  },

  middle: {
    name: "Middle Stage",
    classes: ["VI", "VII", "VIII"],
    subjects: [
      { name: "Hindi (R1)", shortName: "Hindi", periods: 5 },
      { name: "English (R2)", shortName: "English", periods: 5 },
      { name: "Sanskrit (R3)", shortName: "Sanskrit", periods: 3 },
      { name: "Mathematics", shortName: "Maths", periods: 5 },
      {
        name: "Computational Thinking",
        shortName: "CPT",
        periods: 2,
      },
      { name: "Science", shortName: "Sci", periods: 6 },
      { name: "Social Science", shortName: "SST", periods: 6 },
      { name: "Arts", shortName: "Arts", periods: 3 },
      { name: "Physical Education", shortName: "PE", periods: 3 },
      {
        name: "Vocational Education",
        shortName: "VE",
        periods: 4,
      },
      { name: "Library", shortName: "Lib", periods: 2 },
      { name: "Digital Literacy", shortName: "DL", periods: 2 },
      {
        name: "Creative Learning Activities",
        shortName: "CLA",
        periods: 2,
      },
    ],
    totalPeriods: 48,
  },

  secondary: {
    name: "Secondary Stage",
    classes: ["IX"],
    subjects: [
      { name: "Hindi / Sanskrit (R1)", shortName: "Hindi/Skt", periods: 5 },
      { name: "English (R2)", shortName: "English", periods: 5 },
      { name: "Mathematics", shortName: "Maths", periods: 7 },
      { name: "Science", shortName: "Sci", periods: 7 },
      { name: "Social Science", shortName: "SST", periods: 5 },
      {
        name: "Inter Disciplinary Area",
        shortName: "IDA",
        periods: 2,
      },
      {
        name: "Art Education",
        shortName: "AE",
        periods: 4,
      },
      { name: "Physical Education", shortName: "PE", periods: 4 },
      {
        name: "Vocational Education",
        shortName: "VE",
        periods: 4,
      },
      { name: "Library", shortName: "Lib", periods: 1 },
      { name: "Digital Literacy", shortName: "DL", periods: 2 },
      {
        name: "Creative Learning Activities",
        shortName: "CLA",
        periods: 2,
      },
    ],
    totalPeriods: 48,
  },
};

// Common subject catalogue for schools using manual configuration.
// These are selectable subjects, not prescribed period allocations.

export const COMMON_SUBJECT_CATALOGUE = [
  { name: "Hindi", shortName: "Hindi" },
  { name: "English", shortName: "English" },
  { name: "Mathematics", shortName: "Maths" },
  { name: "Computational Thinking", shortName: "CPT" },
  { name: "Sanskrit", shortName: "Sanskrit" },
  { name: "Science", shortName: "Sci" },
  { name: "Social Science", shortName: "SST" },
  { name: "Environmental Studies", shortName: "EVS" },
  { name: "The World Around Us", shortName: "TWAU" },
  { name: "Gardening", shortName: "Grdn" },
  { name: "Arts", shortName: "Arts" },
  { name: "Art Education", shortName: "AE" },
  { name: "Physical Education", shortName: "PE" },
  { name: "Yoga", shortName: "Yoga" },
  { name: "Music", shortName: "Music" },
  { name: "Dance", shortName: "Dance" },
  { name: "Work Education", shortName: "WE" },
  { name: "Vocational Education", shortName: "VE" },
  { name: "Library", shortName: "Lib" },
  { name: "Digital Literacy", shortName: "DL" },
  { name: "Computer Literacy", shortName: "Comp" },
  { name: "Artificial Intelligence", shortName: "AI" },
  { name: "Inter Disciplinary Area", shortName: "IDA" },
  {
    name: "Creative Learning Activities",
    shortName: "CLA",
  },
];

// Convert class names to the corresponding KVS stage.

export function getKVSStage(className) {
  const value = String(className || "")
    .trim()
    .toUpperCase()
    .replace(/^CLASS\s+/, "");

  const stageMap = {
    I: "foundational",
    II: "foundational",

    III: "preparatory",
    IV: "preparatory",
    V: "preparatory",

    VI: "middle",
    VII: "middle",
    VIII: "middle",

    IX: "secondary",
  };

  return stageMap[value] || null;
}

// Get preset subjects and periods for a particular class.

export function getKVSSubjectsForClass(className) {
  const stage = getKVSStage(className);

  if (!stage) {
    return null;
  }

  return {
    stage,
    ...KVS_SUBJECT_PRESETS[stage],
  };
}
