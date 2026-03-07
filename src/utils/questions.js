// Generate questions for a given dan (multiplication table)
export function generateQuestions(dan, mode = 'sequential') {
  const questions = [];
  for (let i = 1; i <= 9; i++) {
    questions.push({ a: dan, b: i, answer: dan * i });
  }
  if (mode === 'random') {
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }
  return questions;
}

// Generate 4 choices for a question
export function generateChoices(dan, correctAnswer) {
  const allAnswers = [];
  for (let i = 1; i <= 9; i++) {
    const val = dan * i;
    if (val !== correctAnswer) {
      allAnswers.push(val);
    }
  }

  // If not enough wrong answers from same dan, add nearby values
  if (allAnswers.length < 3) {
    const offset = [-2, -1, 1, 2, -3, 3];
    for (const o of offset) {
      const val = correctAnswer + o * dan;
      if (val > 0 && val !== correctAnswer && !allAnswers.includes(val)) {
        allAnswers.push(val);
      }
      if (allAnswers.length >= 8) break;
    }
  }

  // Pick 3 random wrong answers
  const shuffled = allAnswers.sort(() => Math.random() - 0.5);
  const wrongAnswers = shuffled.slice(0, 3);

  // Combine and shuffle
  const choices = [correctAnswer, ...wrongAnswers];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
