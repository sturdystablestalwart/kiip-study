import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

function AdminFlags() {
    return <Container>Flags Queue — coming soon</Container>;
}

export default AdminFlags;
