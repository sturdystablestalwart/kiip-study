const sizes = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
};

export const below = Object.fromEntries(
  Object.entries(sizes).map(([key, value]) => [
    key,
    `@media (max-width: ${value}px)`,
  ])
);

export default sizes;
