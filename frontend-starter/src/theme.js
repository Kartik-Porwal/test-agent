// src/theme.js
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#f4f1fa',
      100: '#e8e2f2',
      200: '#d4c9e8',
      300: '#b7a8d5',
      400: '#7965a5',
      500: '#4d3b80',
      600: '#40316d',
      700: '#36285f',
      800: '#2d224f',
      900: '#221a3d',
    },
  },
  fonts: {
    heading: `'Inter', sans-serif`,
    body: `'Inter', sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'bold',
        borderRadius: 'full',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
          },
          _active: {
            bg: 'brand.700',
          },
        },
        outline: {
          borderColor: 'brand.500',
          color: 'brand.500',
          _hover: {
            bg: 'brand.50',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        p: '4',
        borderRadius: 'lg',
        boxShadow: 'sm',
        bg: 'white',
      },
    },
  },
});

export default theme;
