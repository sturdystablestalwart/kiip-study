import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
`;

const Card = styled(Link)`
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  }

  h3 {
    margin-top: 0;
    font-size: 1.2rem;
    color: #333;
  }
  
  p {
    color: #888;
    font-size: 0.9rem;
  }
`;

const Header = styled.div`
  margin-bottom: 30px;
  h1 {
    font-size: 2rem;
    font-weight: 300;
    color: #333;
  }
`;

function Home() {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/tests');
        setTests(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTests();
  }, []);

  return (
    <div>
      <Header>
        <h1>Available Tests</h1>
      </Header>
      <Grid>
        {tests.map(test => (
          <Card key={test._id} to={`/test/${test._id}`}>
            <h3>{test.title}</h3>
            <p>{test.questions?.length || 0} Questions</p>
          </Card>
        ))}
      </Grid>
    </div>
  );
}

export default Home;
