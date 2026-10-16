import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }) {
  return <Flex minH="100vh" bg="#f7f6fa" color="#282538" direction="column">
    <Header />
    <Flex flex="1" minH={0}>
      <Sidebar />
      <Box as="main" flex="1" minW={0} p={{ base: 4, lg: 6 }}>{children}</Box>
    </Flex>
  </Flex>;
}
