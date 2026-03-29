/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

const SearchPaletteContext = createContext(null);

export const useSearchPalette = () => useContext(SearchPaletteContext);
export default SearchPaletteContext;
