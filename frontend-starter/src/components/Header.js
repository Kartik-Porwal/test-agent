import React from 'react';
import { Avatar, Flex, Input, InputGroup, InputLeftElement, Text } from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';

export default function Header() {
  return <Flex as="header" bg="#493878" color="white" h="60px" align="center" justify="space-between" px={{ base: 4, md: 7 }} flexShrink={0}>
    <Text fontWeight="bold">ABC Company</Text>
    <Flex align="center" gap={4}><InputGroup maxW="320px"><InputLeftElement pointerEvents="none"><FiSearch color="#ddd7ed" /></InputLeftElement><Input size="sm" placeholder="Search conversations, agents..." bg="#5b4a8b" border="none" color="white" _placeholder={{ color: '#ded8eb' }} /></InputGroup><Avatar size="sm" name="Neha P" bg="#efc49f" color="#493878" /></Flex>
  </Flex>;
}
