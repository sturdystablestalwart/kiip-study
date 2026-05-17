import styled from 'styled-components';

/**
 * Issue #187 — standard CSS pattern for content visible only to
 * assistive tech (screen readers, voice control).  Used for aria-live
 * regions, skip-links, off-screen labels, and any other content that
 * mustn't render visually but must still be in the accessibility tree.
 *
 * Renders as <span> by default; pass `as="div"` etc. when block-level
 * is needed.
 *
 *   <VisuallyHidden aria-live="polite">{statusMessage}</VisuallyHidden>
 */
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export default VisuallyHidden;
