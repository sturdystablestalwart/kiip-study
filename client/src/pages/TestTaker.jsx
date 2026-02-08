import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;

const TimerDisplay = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: #D4A373;
`;

const QuestionCard = styled.div`
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
`;

const QuestionText = styled.h2`
  font-size: 1.3rem;
  margin-bottom: 30px;
  line-height: 1.5;
`;

const QuestionImage = styled.img`
  max-width: 100%;
  max-height: 300px;
  display: block;
  margin: 0 auto 30px;
  border-radius: 8px;
`;

const OptionsGrid = styled.div`
  display: grid;
  gap: 15px;
`;

const OptionButton = styled.button`
  background: ${props => {
    if (props.isCorrect && props.submitted) return '#E8F5E9';
    if (props.selected && props.submitted && !props.isCorrect) return '#FFEBEE';
    return props.selected ? '#F0EBE5' : 'white';
  }};
  border: 1px solid ${props => {
    if (props.isCorrect && props.submitted) return '#4CAF50';
    if (props.selected && props.submitted && !props.isCorrect) return '#F44336';
    return props.selected ? '#8B7E74' : '#E0E0E0'};
  }};
  padding: 15px 20px;
  border-radius: 8px;
  text-align: left;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8B7E74;
    background: #FAF9F6;
  }
`;

const Explanation = styled.div`
  margin-top: 30px;
  padding: 20px;
  background: #F9F7F2;
  border-left: 4px solid #D4A373;
  border-radius: 4px;
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
`;

const Button = styled.button`
  background: ${props => props.primary ? '#8B7E74' : 'transparent'};
  color: ${props => props.primary ? 'white' : '#8B7E74'};
  border: ${props => props.primary ? 'none' : '1px solid #8B7E74'};
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
`;

const ResultCard = styled.div`
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

function TestTaker() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/tests/${id}`);
        setTest(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTest();
  }, [id]);

  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelect = (idx) => {
    if (isSubmitted) return;
    setAnswers({ ...answers, [currentQ]: idx });
  };

  const handleSubmit = () => {
    if (window.confirm('Submit test?')) {
      let correctCount = 0;
      test.questions.forEach((q, idx) => {
          const selectedIdx = answers[idx];
          if (selectedIdx !== undefined && q.options[selectedIdx].isCorrect) {
              correctCount++;
          }
      });
      setScore(correctCount);
      setIsSubmitted(true);
    }
  };

  if (!test) return <div>Loading...</div>;

  const currentQuestion = test.questions[currentQ];

  return (
    <Container>
      <Header>
        <div>
          <h3>{test.title}</h3>
          <small>Mode: {isSubmitted ? 'Result' : 'Practice'}</small>
        </div>
        <TimerDisplay>{formatTime(timeLeft)}</TimerDisplay>
      </Header>

      {isSubmitted && currentQ === 0 && (
          <ResultCard>
              <h2>Your Score: {score} / {test.questions.length}</h2>
              <p>{Math.round((score / test.questions.length) * 100)}%</p>
          </ResultCard>
      )}

      <QuestionCard>
        {currentQuestion.image && (
            <QuestionImage src={`http://localhost:5000${currentQuestion.image}`} alt="Question visual" />
        )}
        <QuestionText>{currentQ + 1}. {currentQuestion.text}</QuestionText>
        <OptionsGrid>
          {currentQuestion.options.map((opt, idx) => (
            <OptionButton 
              key={idx} 
              selected={answers[currentQ] === idx}
              isCorrect={opt.isCorrect}
              submitted={isSubmitted}
              onClick={() => handleSelect(idx)}
            >
              {idx + 1}. {opt.text}
            </OptionButton>
          ))}
        </OptionsGrid>

        {isSubmitted && currentQuestion.explanation && (
            <Explanation>
                <strong>Explanation:</strong> {currentQuestion.explanation}
            </Explanation>
        )}

        <Controls>
          <Button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>Previous</Button>
          {currentQ < test.questions.length - 1 ? (
            <Button primary onClick={() => setCurrentQ(currentQ + 1)}>Next</Button>
          ) : (
            <Button primary onClick={handleSubmit} disabled={isSubmitted}>Submit Test</Button>
          )}
        </Controls>
      </QuestionCard>
    </Container>
  );
}

export default TestTaker;
