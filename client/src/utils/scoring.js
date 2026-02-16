export function scoreQuestion(question, answer) {
  const type = question.type || 'mcq-single';

  switch (type) {
    case 'mcq-single':
    case 'multiple-choice': {
      const selected = answer.selectedOptions?.[0];
      if (selected == null) return false;
      return question.options[selected]?.isCorrect === true;
    }
    case 'mcq-multiple': {
      const selected = new Set(answer.selectedOptions || []);
      const correct = new Set(
        question.options
          .map((opt, i) => opt.isCorrect ? i : -1)
          .filter(i => i >= 0)
      );
      if (selected.size !== correct.size) return false;
      for (const idx of selected) {
        if (!correct.has(idx)) return false;
      }
      return true;
    }
    case 'short-answer': {
      const text = (answer.textAnswer || '').trim().toLowerCase();
      if (!text) return false;
      return (question.acceptedAnswers || []).some(
        a => a.trim().toLowerCase() === text
      );
    }
    case 'ordering': {
      const submitted = answer.orderedItems || [];
      const correct = question.correctOrder || [];
      if (submitted.length !== correct.length) return false;
      return submitted.every((val, i) => val === correct[i]);
    }
    case 'fill-in-the-blank': {
      const submitted = answer.blankAnswers || [];
      const blanks = question.blanks || [];
      if (submitted.length !== blanks.length) return false;
      return blanks.every((blank, i) => {
        const userAnswer = (submitted[i] || '').trim().toLowerCase();
        return (blank.acceptedAnswers || []).some(
          a => a.trim().toLowerCase() === userAnswer
        );
      });
    }
    default:
      return false;
  }
}
