function computeCredits(lectureHours, tutorialHours, practicalHours) {
  const l = Number(lectureHours) || 0;
  const t = Number(tutorialHours) || 0;
  const p = Number(practicalHours) || 0;
  return l + t + p / 2;
}

function computeTotalMarks(caMarks, eseMarks) {
  const ca = Number(caMarks) || 0;
  const ese = Number(eseMarks) || 0;
  return ca + ese;
}

module.exports = { computeCredits, computeTotalMarks };
