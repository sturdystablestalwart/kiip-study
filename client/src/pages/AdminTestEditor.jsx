import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

function AdminTestEditor() {
    return <Container>Test Editor — coming soon</Container>;
}

export default AdminTestEditor;
