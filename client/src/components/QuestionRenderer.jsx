import React from 'react';
import MCQSingle from './question-types/MCQSingle';
import MCQMultiple from './question-types/MCQMultiple';
import ShortAnswer from './question-types/ShortAnswer';
import Ordering from './question-types/Ordering';
import FillInTheBlank from './question-types/FillInTheBlank';

function QuestionRenderer({ question, answer, onAnswer, showFeedback, disabled }) {
  const type = question.type || 'mcq-single';
  const props = { question, answer, onAnswer, showFeedback, disabled };

  switch (type) {
    case 'mcq-single':
    case 'multiple-choice':
      return <MCQSingle {...props} />;
    case 'mcq-multiple':
      return <MCQMultiple {...props} />;
    case 'short-answer':
      return <ShortAnswer {...props} />;
    case 'ordering':
      return <Ordering {...props} />;
    case 'fill-in-the-blank':
      return <FillInTheBlank {...props} />;
    default:
      return <MCQSingle {...props} />;
  }
}

export default QuestionRenderer;
