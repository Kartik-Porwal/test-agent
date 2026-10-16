import React, { useState } from 'react';
import { Box, Flex, Icon, Text, VStack } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiMessageSquare, FiBriefcase, FiZap, FiSettings } from 'react-icons/fi';

const items = [
  { label: 'Dashboard', path: '/', icon: FiHome },
  { label: 'Conversations', path: '/conversations', icon: FiMessageSquare },
  { label: 'AI Agents', path: '/agent-config', icon: FiBriefcase },
  { label: 'Templates', path: '/templates', icon: FiZap },
];

export default function Sidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const railWidth = { base: '60px', md: '68px' };
  // This box preserves the sidebar's column in the page layout. The nav itself
  // is fixed to the viewport so long pages cannot move it.
  return <Box position="relative" alignSelf="stretch" minH="calc(100vh - 84px)" w={railWidth} flexShrink={0} mx={{ base: 2, md: 4 }} mt={3} mb={3}>
    <Flex
      as="nav"
      aria-label="Main navigation"
      direction="column"
      position="fixed"
      top="72px"
      bottom={3}
      left={{ base: 2, md: 4 }}
      zIndex={20}
      w={expanded ? '184px' : railWidth}
      overflow="hidden"
      bg="white"
      p={2}
      borderRadius="2xl"
      boxShadow={expanded ? '0 8px 24px rgba(38, 31, 52, .14)' : 'none'}
      transition="width .18s ease, box-shadow .18s ease"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}
    >
      <Box flex="1" minH={0} overflowY="auto" overflowX="hidden">
        <VStack align="stretch" spacing={2}>
          {items.map(({ label, path, icon }) => {
            const active = location.pathname === path || (path === '/conversations' && location.pathname.startsWith('/conversation/')) || (path === '/templates' && location.pathname === '/Analysis');
            return <Flex key={path} as={Link} to={path} aria-label={label} title={expanded ? undefined : label} align="center" justify={expanded ? 'flex-start' : 'center'} gap={3} minH="48px" px={expanded ? 3 : 0} borderRadius="full" bg={active ? '#e7e4ef' : 'transparent'} color={active ? '#493878' : '#514c60'} _hover={{ bg: '#f2f0f7' }}>
              <Icon as={icon} boxSize={5} flexShrink={0} /><Text display={expanded ? 'block' : 'none'} whiteSpace="nowrap" fontSize="sm">{label}</Text>
            </Flex>;
          })}
        </VStack>
      </Box>
      <Flex as={Link} to="/agent-config" aria-label="Settings" title={expanded ? undefined : 'Settings'} align="center" justify={expanded ? 'flex-start' : 'center'} gap={3} minH="48px" mt="auto" flexShrink={0} px={expanded ? 3 : 0} borderRadius="full" color="#514c60" _hover={{ bg: '#f2f0f7' }}>
        <Icon as={FiSettings} boxSize={5} flexShrink={0} /><Text display={expanded ? 'block' : 'none'} whiteSpace="nowrap" fontSize="sm">Settings</Text>
      </Flex>
    </Flex>
  </Box>;
}
