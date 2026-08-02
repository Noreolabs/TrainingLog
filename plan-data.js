// Default training plan — parsed from the coach-provided PDF.
// This is the seed data loaded the first time the app runs.
// Editing this file has no effect after first load; use the in-app
// PDF import or manual editor to change the plan going forward.

const DEFAULT_PLAN = {
  id: "phase-1-restructure",
  name: "Phase 1 — Restructure Phase",
  importedAt: null,
  notes: {
    training: "All sets listed are WORKING SETS ONLY. Warm-up and feeder sets are still performed prior. Working sets should be pushing your limit. TRACK AND LOG ALL WORKING SETS for compound movements. ALL TOP + BACK-OFF SETS ARE TO FAILURE, unless noted otherwise.",
    warmup: "Perform as many warm-up sets as needed, increasing weight until the first working set is reached. A cold muscle typically needs 3–4 warm-up sets. Moving to another exercise for a trained muscle: 1–2 feeder sets. New muscle group: 3–4 warm-up sets. As weight increases, reps should decrease. Never closer than 3–5 RIR on warm-ups.",
    rest: "Rest between sets: heart rate should return to baseline before the next work set.",
    cardio: "STAIRMASTER — 15 min immediately post-lift, all 5 training days. Heart rate above 130.",
    steps: "STEPS — 8,000 daily, every day including rest days. Spaced through the day, not banked in one session."
  },
  days: [
    {
      day: "Monday",
      title: "Legs (quad + adductor dominant)",
      type: "lift",
      exercises: [
        { name: "Leg Extension", scheme: "2 working · 12–15", notes: "Pre-fatigue. Controlled negatives." },
        { name: "Hack Squat", scheme: "Top set 6–8 · 2 back-off 10–12", notes: "" },
        { name: "Pendulum Squat", scheme: "2 working · 8–10", notes: "" },
        { name: "Leg Press — low, slightly wide stance", scheme: "3 working · 10–12", notes: "Stance biases quads + adductors." },
        { name: "Adductor Machine", scheme: "3 working · 12–15", notes: "Full stretch, pause at bottom." },
        { name: "Walking DB Lunge", scheme: "2 working · 10–12 steps/leg", notes: "" },
        { name: "Standing Calf Raise", scheme: "4 working · 10–12", notes: "Pause hard at the stretch." }
      ]
    },
    {
      day: "Tuesday",
      title: "Push A",
      type: "lift",
      exercises: [
        { name: "Pec Dec Flys", scheme: "3 working · 12–15", notes: "First set leave 1–2 RIR. Last set to failure." },
        { name: "Low Incline Smith OR Incline DB Press", scheme: "Top set 8–10 · back-off 10–15", notes: "" },
        { name: "Seated Flat Machine Press", scheme: "See scheme", notes: "Set 1: 6–8 (feeder / weight assessor). Top set: 8–12 — do this 2x. Back-off: 10–15." },
        { name: "SA Cable or Machine Lateral Raise", scheme: "4 working · 12–15", notes: "First 2 sets leave 1–2 RIR. Last 2 to failure." },
        { name: "Standing or Seated Cable Chest Press", scheme: "2 working · 10–15", notes: "" },
        { name: "Triceps Straight Bar or EZ Bar Pushdown", scheme: "2 working · 8–15", notes: "" }
      ]
    },
    { day: "Wednesday", title: "Rest", type: "rest", exercises: [] },
    {
      day: "Thursday",
      title: "Pull A",
      type: "lift",
      exercises: [
        { name: "Straight-Arm Cable/Rope Pulldown", scheme: "3–4 straight sets · 12–15", notes: "Nothing to failure. Get lats firing, pump blood in." },
        { name: "Single-Arm Plate-Loaded Pulldown", scheme: "Top set 10–12 · back-off 12–15", notes: "" },
        { name: "Chest-Supported T-Bar Row Machine", scheme: "Top set 8–12 · back-off 10–15", notes: "Upper back bias." },
        { name: "Chest-Supported Horizontal Row Machine", scheme: "Top set 8–12 (2x) · back-off 12–15", notes: "Upper back bias." },
        { name: "Single-Arm Low Row (machine or cable)", scheme: "Top set 10–12 · back-off 12–15 (2x)", notes: "Lat bias." },
        { name: "Lower Back Hyperextension", scheme: "3 working · to failure", notes: "Add weight if needed." }
      ]
    },
    {
      day: "Friday",
      title: "Push B (delts + upper chest)",
      type: "lift",
      exercises: [
        { name: "Reverse Pec Dec (single or double arm)", scheme: "3 working · 12–15", notes: "First 2 sets leave 1–2 RIR. Last set to failure." },
        { name: "Seated Plate-Loaded Shoulder Press", scheme: "Top set 8–12 · back-off 10–15", notes: "" },
        { name: "DB Lateral Raise", scheme: "4 working + drop set", notes: "Sets 1–2: 15 reps, moderate weight, 2–3 RIR. Sets 3–4: 10–12, heaviest weight, blast these & go to failure. Immediately 1 drop set (cut weight in half) to failure again. Arms 90% straight. Chest up. Shoulders back. No traps." },
        { name: "Incline Chest Press Machine", scheme: "Top set 10–12 · back-off 12–15", notes: "" },
        { name: "Cable or Machine Lateral Raise", scheme: "3 working · 15–18", notes: "Pick the one you connect with best. 1 feeder prior to establish working weight." }
      ]
    },
    {
      day: "Saturday",
      title: "Arms + Adductors/Hams",
      type: "lift",
      exercises: [
        { name: "EZ Bar Curl", scheme: "3 working · 8–10", notes: "" },
        { name: "Close Grip Bench Press", scheme: "Top set 6–8 · 2 back-off 10–12", notes: "" },
        { name: "Machine Preacher Curl", scheme: "3 working · 10–12", notes: "" },
        { name: "Overhead Triceps Machine Press", scheme: "3 working · 10–12", notes: "" },
        { name: "DB Curl", scheme: "2 working · 12–15", notes: "" },
        { name: "SA Cable Triceps Pushdown", scheme: "2 working · 12–15", notes: "" },
        { name: "Seated Leg Curl", scheme: "3 working · 10–12", notes: "" },
        { name: "Adductor Machine", scheme: "3 working · 12–15", notes: "Second weekly hit. Same standard — full stretch, pause." },
        { name: "Lying Leg Curl", scheme: "2 working · 12–15", notes: "" }
      ]
    },
    { day: "Sunday", title: "Rest", type: "rest", exercises: [] }
  ]
};
