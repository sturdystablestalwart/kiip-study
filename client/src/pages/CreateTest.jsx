import React, { useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Wrapper = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 200px;
  padding: 20px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  background: #FFFFFF;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: #D4A373;
  }
`;

const UploadSection = styled.div`
  margin-top: 20px;
  padding: 20px;
  border: 2px dashed #D4A373;
  border-radius: 8px;
  text-align: center;
  background: #F9F7F2;
`;

const ImagePreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  margin-top: 10px;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
`;

function CreateTest() {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const uploadedUrls = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await axios.post('http://localhost:5000/api/tests/upload', formData);
        uploadedUrls.push(res.data.imageUrl);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
    setImages([...images, ...uploadedUrls]);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // We pass the image URLs in the text or as a separate field
      // For now, let's append them to the prompt text so the LLM knows about them
      const fullText = `${text}\n\n[Images available: ${images.join(', ')}]`;
      await axios.post('http://localhost:5000/api/tests/generate', { text: fullText });
      alert('Test Generated Successfully!');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Error generating test: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <h1>Create New Test</h1>
      <p>Paste your study material or raw text below. The AI will generate a test for you.</p>
      <TextArea 
        placeholder="Paste text here..." 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
      />
      
      <UploadSection>
        <p>Add images for visual questions</p>
        <input type="file" multiple onChange={handleImageUpload} accept="image/*" />
        <ImagePreviewGrid>
          {images.map((url, i) => (
            <PreviewImage key={i} src={`http://localhost:5000${url}`} alt="preview" />
          ))}
        </ImagePreviewGrid>
      </UploadSection>

      <Button onClick={handleGenerate} disabled={loading || !text}>
        {loading ? 'Generating...' : 'Generate Test'}
      </Button>
    </Wrapper>
  );
}

export default CreateTest;
