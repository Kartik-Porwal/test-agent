import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Flex, Heading, HStack, Input, InputGroup, InputLeftElement, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalOverlay, Select, SimpleGrid, Spinner, Text, useToast, VStack } from '@chakra-ui/react';
import { FiSearch, FiStar } from 'react-icons/fi';
import { getTemplates, recordTemplateUse, updateTemplate } from '../api';

const journeys = ['All templates', 'Popular', 'Low use', 'Shipping', 'Returns', 'Onboarding', 'Billing', 'Engagement', 'Transaction', 'Account', 'Product'];
const channels = ['All channels', 'Email', 'Website', 'Mobile', 'Messenger', 'Chat'];

export default function TemplatePickerModal({ isOpen, onClose, onInsert, title = 'Response Templates' }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [journey, setJourney] = useState('All templates');
  const [channel, setChannel] = useState('All channels');
  const [sort, setSort] = useState('Most used');
  const [previewAs, setPreviewAs] = useState('New visitor');
  const [variableValues, setVariableValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getTemplates().then(data => {
      const items = Array.isArray(data) ? data : [];
      setTemplates(items);
      setSelectedId(current => items.some(item => item.id === current) ? current : (items[0]?.id || ''));
    }).catch(error => toast({ title: 'Could not load templates', description: error.response?.data?.message || error.message, status: 'error' })).finally(() => setLoading(false));
  }, [isOpen, toast]);

  const filtered = useMemo(() => templates.filter(item => {
    const matchesSearch = `${item.name} ${item.description || ''} ${item.content} ${item.category} ${item.channel}`.toLowerCase().includes(search.toLowerCase());
    const matchesJourney = journey === 'All templates' || (journey === 'Popular' ? item.isPopular : journey === 'Low use' ? Number(item.uses || 0) < 50 : item.category === journey);
    return matchesSearch && matchesJourney && (channel === 'All channels' || item.channel === channel);
  }).sort((a, b) => sort === 'Recently updated' ? new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0) : Number(b.uses || 0) - Number(a.uses || 0)), [templates, search, journey, channel, sort]);
  const active = filtered.find(item => item.id === selectedId) || filtered[0];
  const activeId = active?.id;
  const activeContent = String(active?.content ?? active?.message ?? active?.body ?? active?.description ?? '');
  const sampleName = previewAs === 'VIP customer' ? 'Jordan' : previewAs === 'Returning customer' ? 'Alex' : 'Avery';
  const metadataNames = (active?.variables || []).map(variable => variable.name).filter(Boolean);
  const metadataSignature = metadataNames.join('|');
  const variableNames = useMemo(() => {
    if (!activeId) return [];
    const fromContent = [...activeContent.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(match => match[1].trim());
    return [...new Set([...metadataSignature.split('|').filter(Boolean), ...fromContent])];
  }, [activeId, activeContent, metadataSignature]);
  useEffect(() => {
    setVariableValues(Object.fromEntries(variableNames.map(name => {
      const normalized = name.toLowerCase();
      return [name, normalized === 'name' ? sampleName : normalized === 'workspace' ? 'Acme' : ''];
    })));
  }, [active?.id, previewAs, sampleName, variableNames]);
  const fillVariables = text => (text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawName) => {
    const name = rawName.trim();
    return variableValues[name] || match;
  });
  const preview = fillVariables(active?.content);

  const togglePopular = async (event, item) => {
    event.stopPropagation();
    const isPopular = !item.isPopular;
    setTemplates(items => items.map(template => template.id === item.id ? { ...template, isPopular } : template));
    try {
      const saved = await updateTemplate(item.id, { isPopular });
      setTemplates(items => items.map(template => template.id === saved.id ? saved : template));
    } catch (error) {
      setTemplates(items => items.map(template => template.id === item.id ? { ...template, isPopular: item.isPopular } : template));
      toast({ title: 'Could not update popular status', description: error.response?.data?.message || error.message, status: 'error' });
    }
  };

  const insert = async () => {
    if (!active) return;
    const missingVariables = variableNames.filter(name => !String(variableValues[name] || '').trim());
    if (missingVariables.length) {
      toast({ title: 'Fill in the template variables', description: missingVariables.join(', '), status: 'warning' });
      return;
    }
    setInserting(true);
    try {
      const saved = await recordTemplateUse(active.id, Number(active.uses || 0));
      const template = { ...active, ...saved };
      setTemplates(items => items.map(item => item.id === template.id ? template : item));
      const content = String(template.content ?? template.message ?? template.body ?? template.description ?? template.name ?? '');
      await onInsert({ ...template, content }, fillVariables(content));
      onClose();
    } catch (error) {
      toast({ title: 'Could not insert template', description: error.response?.data?.message || error.message, status: 'error' });
    } finally { setInserting(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered scrollBehavior="inside"><ModalOverlay bg="blackAlpha.300" /><ModalContent maxH="88vh" borderRadius="20px"><ModalCloseButton zIndex={2} /><ModalBody p={0}><Flex direction={{ base: 'column', md: 'row' }} minH={{ base: '75vh', md: '600px' }}>
    <Box w={{ base: 'full', md: '155px' }} flexShrink={0} p={3} borderRight={{ md: '1px solid #e7e3ef' }}><Text fontSize="xs" fontWeight="bold" mb={3}>TEMPLATE LIBRARY</Text><VStack align="stretch" spacing={1}>{journeys.map(item => <Button key={item} size="xs" justifyContent="start" variant={journey === item ? 'solid' : 'ghost'} onClick={() => setJourney(item)}>{item}</Button>)}</VStack><Text fontSize="xs" fontWeight="bold" color="gray.500" mt={5} mb={2}>BY CHANNEL</Text>{channels.slice(1).map(item => <Button key={item} size="xs" w="full" justifyContent="start" variant={channel === item ? 'solid' : 'ghost'} onClick={() => setChannel(channel === item ? 'All channels' : item)}>{item}</Button>)}</Box>
    <Box flex="1" minW={0} p={4}><Heading size="md">{title}</Heading><Text fontSize="xs" color="gray.500" mb={3}>Choose a reply, preview it, then insert it into the response.</Text><Flex gap={2} mb={3} wrap="wrap"><InputGroup size="sm" flex="1" minW="180px"><InputLeftElement><FiSearch /></InputLeftElement><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, message, or tag" /></InputGroup><Select size="sm" maxW="135px" value={channel} onChange={event => setChannel(event.target.value)}>{channels.map(item => <option key={item}>{item}</option>)}</Select><Select size="sm" maxW="145px" value={sort} onChange={event => setSort(event.target.value)}><option>Most used</option><option>Recently updated</option></Select></Flex><HStack mb={3}><Text fontSize="xs" color="gray.500">{filtered.length} templates</Text></HStack>
      {loading ? <Flex justify="center" p={12}><Spinner /></Flex> : filtered.length ? <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={2}>{filtered.map(item => <Box key={item.id} border="1px solid" borderColor={active?.id === item.id ? '#7860b1' : '#e7e3ef'} borderRadius="12px" p={3} cursor="pointer" onClick={() => setSelectedId(item.id)}><Flex bg="#f8f6fb" p={2} borderRadius="lg" justify="space-between" align="start"><Box><Box h="6px" w="84px" bg="#d8d4e2" borderRadius="full" /><Box h="5px" w="120px" mt={1} bg="#e6e2ed" borderRadius="full" /></Box><Button aria-label={item.isPopular ? 'Remove from popular' : 'Mark as popular'} size="xs" variant="ghost" minW="auto" p={1} color={item.isPopular ? '#7761b0' : '#a9a4b2'} onClick={event => togglePopular(event, item)}><FiStar fill={item.isPopular ? '#7761b0' : 'none'} /></Button></Flex><Text fontSize="sm" fontWeight="bold" mt={2}>{item.name}</Text><Text noOfLines={2} fontSize="xs" color="gray.500">{item.description || item.content}</Text><Flex justify="space-between" mt={2} gap={1} align="center"><HStack><Badge colorScheme="purple">{item.category}</Badge><Badge colorScheme="blue">{item.channel || 'Chat'}</Badge></HStack><Text whiteSpace="nowrap" fontSize="xs" color="gray.500">{item.uses || 0} uses</Text></Flex></Box>)}</SimpleGrid> : <Text textAlign="center" color="gray.500" p={8}>No templates match these filters.</Text>}
    </Box>
    <Box w={{ base: 'full', md: '235px' }} flexShrink={0} p={4} borderLeft={{ md: '1px solid #e7e3ef' }}><Heading size="sm">Preview</Heading><Text fontSize="xs" color="gray.500" mb={3}>Review the selected reply before inserting.</Text><Text fontSize="xs" fontWeight="bold">PREVIEW AS</Text><Select size="sm" mt={2} mb={3} value={previewAs} onChange={event => setPreviewAs(event.target.value)}><option>New visitor</option><option>Returning customer</option><option>VIP customer</option></Select>{variableNames.map(name => <Input key={name} size="sm" mb={2} value={variableValues[name] || ''} onChange={event => setVariableValues(current => ({ ...current, [name]: event.target.value }))} placeholder={name.replace(/[_-]/g, ' ')} aria-label={`Fill ${name}`} />)}<Box bg="#f8f7fa" p={3} borderRadius="lg"><Text fontSize="xs" color="gray.500">Live preview</Text><Box bg="white" p={3} borderRadius="lg" mt={2}><Text fontSize="sm" fontWeight="bold">{active?.name || 'Choose a template'}</Text><Text fontSize="xs" color="gray.500" mt={2}>{preview || 'Select a template to see a preview.'}</Text></Box></Box><Box bg="#e9f7ef" p={3} borderRadius="lg" mt={3}><Text color="green.700" fontSize="xs" fontWeight="bold">✓　{variableNames.length} variable{variableNames.length === 1 ? '' : 's'} ready</Text></Box><Box display={{ base: 'none', md: 'block' }} mt={5}><Button w="full" variant="outline" onClick={onClose}>Cancel</Button><Button w="full" mt={2} onClick={insert} isDisabled={!active} isLoading={inserting}>Insert template</Button></Box></Box>
  </Flex></ModalBody><ModalFooter display={{ base: 'flex', md: 'none' }}><Button variant="outline" mr={2} onClick={onClose}>Cancel</Button><Button onClick={insert} isDisabled={!active} isLoading={inserting}>Insert template</Button></ModalFooter></ModalContent></Modal>;
}
