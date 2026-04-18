import styled from 'styled-components';

const Stack = styled.div`
  display: flex;
  flex-direction: ${p => (p.$horizontal ? 'row' : 'column')};
  align-items: ${p => p.$align || 'stretch'};
  justify-content: ${p => p.$justify || 'flex-start'};
  gap: ${p => p.theme.layout.space[p.$gap ?? 4]}px;
  ${p => p.$wrap && 'flex-wrap: wrap;'}
`;

export default Stack;
