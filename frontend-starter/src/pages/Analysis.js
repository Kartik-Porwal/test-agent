import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Heading, HStack,
  Input, InputGroup, InputLeftElement, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid,
  Spinner, Text, Textarea, useDisclosure, useToast, VStack
} from '@chakra-ui/react';
import { FiArrowRight, FiCheck, FiEdit2, FiSearch, FiStar, FiTrash2 } from 'react-icons/fi';
import { createTemplate, deleteTemplate, getTemplates, recordTemplateUse, updateTemplate } from '../api';

const emptyForm = { title: '', description: '', journey: 'Onboarding', channel: 'Website', content: '', isShared: false };
const categories = ['Shipping', 'Returns', 'Onboarding', 'Billing', 'Engagement', 'Transaction', 'Account', 'Product'];
const channels = ['Email', 'Website', 'Mobile', 'Messenger', 'Chat'];
const libraryDotColors = {
  'All templates': '#8057ff', Popular: '#f2ad34', 'Low use': '#9ca3af',
  Onboarding: '#8057ff', Billing: '#4da8f0', Engagement: '#35b37e', Transaction: '#f36f89',
  Shipping: '#f2ad34', Returns: '#f36f89', Account: '#35b37e', Product: '#4da8f0',
  Email: '#f2a11b', Website: '#718096', Mobile: '#26a9e0', Messenger: '#8057ff', Chat: '#35b37e'
};

function fromApi(template) {
  const title = template.name || template.title || 'Untitled template';
  const content = template.content ?? template.message ?? template.body ?? template.description ?? title;
  return {
    ...template,
    title,
    content: typeof content === 'string' ? content : String(content ?? ''),
    journey: template.category,
    description: template.description || template.content,
    channel: template.channel || 'Chat',
    uses: template.uses || 0,
    isPopular: Boolean(template.isPopular)
  };
}

function toApi(template) {
  return {
    name: template.title.trim(),
    description: template.description.trim(),
    category: template.journey,
    channel: template.channel,
    content: template.content.trim(),
    variables: Array.from(
      new Set(template.content.match(/\{\{\s*([^}]+?)\s*\}\}/g) || []),
      value => ({ name: value.replace(/[{}\s]/g, ''), description: 'Personalized template value' })
    ),
    isShared: Boolean(template.isShared)
  };
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) { /* Fall back for browsers that deny clipboard access. */ }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(field);
  if (!copied) throw new Error('Clipboard access is unavailable');
}

export default function Analysis() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All templates');
  const [scope, setScope] = useState('All templates');
  const [channelFilter, setChannelFilter] = useState('All channels');
  const [sortOrder, setSortOrder] = useState('Most used');
  const [previewAs, setPreviewAs] = useState('New visitor');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewActionOpen, setPreviewActionOpen] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    getTemplates()
      .then(data => {
        const items = (Array.isArray(data) ? data : []).map(fromApi);
        setTemplates(items);
        setSelected(items[0]?.id || '');
      })
      .catch(error => toast({ title: 'Could not load templates', description: error.response?.data?.message || error.message, status: 'error' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    let items = templates.filter(template => {
      const matchesCategory = ['All templates', 'Popular', 'Low use'].includes(categoryFilter) || template.journey === categoryFilter;
      const matchesChannel = channelFilter === 'All channels' || template.channel === channelFilter;
      const matchesScope = scope === 'All templates' || (scope === 'My team' ? !template.isShared : template.uses > 0);
      const matchesSearch = `${template.title} ${template.description} ${template.content} ${template.journey} ${template.channel}`.toLowerCase().includes(search.toLowerCase());
      const matchesPopular = categoryFilter !== 'Popular' || template.isPopular;
      const matchesLowUse = categoryFilter !== 'Low use' || template.uses < 50;
      return matchesCategory && matchesChannel && matchesScope && matchesSearch && matchesPopular && matchesLowUse;
    });
    items = [...items].sort((a, b) => sortOrder === 'Recently updated'
      ? new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      : b.uses - a.uses);
    return items;
  }, [templates, categoryFilter, channelFilter, scope, search, sortOrder]);

  const active = templates.find(template => template.id === selected) || filtered[0] || null;
  const visibleCategories = categories.filter(category => category.toLowerCase().includes(categorySearch.toLowerCase()));
  const previewName = previewAs === 'VIP customer' ? 'Jordan' : previewAs === 'Returning customer' ? 'Alex' : 'Avery';
  const previewVariables = [...new Set((active?.content || '').match(/\{\{\s*([^}]+?)\s*\}\}/g) || [])];
  const previewMessage = (active?.content || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawName) => {
    const variable = rawName.trim().toLowerCase();
    if (variable === 'name' || variable === 'visitor_name') return previewName;
    if (variable === 'workspace' || variable === 'company') return 'Acme';
    return match;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    onOpen();
  };

  const openEdit = template => {
    setEditingId(template.id);
    setForm({ title: template.title, description: template.description, journey: template.journey, channel: template.channel, content: template.content, isShared: Boolean(template.isShared) });
    onOpen();
  };

  const saveTemplate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Add a template name and message before saving', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = toApi(form);
      if (editingId) {
        const saved = fromApi(await updateTemplate(editingId, payload));
        setTemplates(items => items.map(item => item.id === editingId ? saved : item));
        setSelected(saved.id);
        toast({ title: 'Template updated', status: 'success' });
      } else {
        const saved = fromApi(await createTemplate(payload));
        setTemplates(items => [saved, ...items]);
        setSelected(saved.id);
        toast({ title: 'Template created', status: 'success' });
      }
      onClose();
    } catch (error) {
      toast({ title: 'Could not save template', description: error.response?.data?.message || error.message, status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async template => {
    try {
      await deleteTemplate(template.id);
      const remaining = templates.filter(item => item.id !== template.id);
      setTemplates(remaining);
      if (selected === template.id) setSelected(remaining[0]?.id || '');
      toast({ title: 'Template deleted', status: 'success' });
    } catch (error) {
      toast({ title: 'Could not delete template', description: error.response?.data?.message || error.message, status: 'error' });
    }
  };

  const togglePopular = async (event, template) => {
    event.stopPropagation();
    const isPopular = !template.isPopular;
    setTemplates(items => items.map(item => item.id === template.id ? { ...item, isPopular } : item));
    try {
      const saved = fromApi(await updateTemplate(template.id, { isPopular }));
      setTemplates(items => items.map(item => item.id === saved.id ? saved : item));
      toast({ title: isPopular ? 'Marked as popular' : 'Removed from popular', status: 'success' });
    } catch (error) {
      setTemplates(items => items.map(item => item.id === template.id ? { ...item, isPopular: template.isPopular } : item));
      toast({ title: 'Could not update popular status', description: error.response?.data?.message || error.message, status: 'error' });
    }
  };

  const toggleTeamShare = async (event, template) => {
    event.stopPropagation();
    const isShared = !template.isShared;
    setTemplates(items => items.map(item => item.id === template.id ? { ...item, isShared } : item));
    try {
      const saved = fromApi(await updateTemplate(template.id, { isShared }));
      setTemplates(items => items.map(item => item.id === saved.id ? saved : item));
      toast({ title: isShared ? 'Template shared with your team' : 'Team sharing removed', status: 'success' });
    } catch (error) {
      setTemplates(items => items.map(item => item.id === template.id ? { ...item, isShared: template.isShared } : item));
      toast({ title: 'Could not update team sharing', description: error.response?.data?.message || error.message, status: 'error' });
    }
  };

  const toggleFormSharing = () => {
    const isShared = !form.isShared;
    setForm(current => ({ ...current, isShared }));
    toast({ title: isShared ? 'Team sharing enabled' : 'Team sharing disabled', description: 'Save the template to apply this setting.', status: 'info' });
  };

  const insertTemplate = async (template = active) => {
    if (!template) return;
    const sampleName = previewAs === 'VIP customer' ? 'Jordan' : previewAs === 'Returning customer' ? 'Alex' : 'Avery';
    const content = String(template.content ?? template.description ?? template.title ?? '');
    const message = content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawName) => {
      const variable = rawName.trim().toLowerCase();
      if (variable === 'name' || variable === 'visitor_name') return sampleName;
      if (variable === 'workspace' || variable === 'company') return 'Acme';
      return match;
    });
    try {
      await copyText(message);
    } catch (error) {
      toast({ title: 'Could not copy template', description: error.message || 'Allow clipboard access in your browser and try again.', status: 'warning' });
      return;
    }
    try {
      const saved = fromApi(await recordTemplateUse(template.id, template.uses));
      setTemplates(items => items.map(item => item.id === saved.id ? saved : item));
    } catch (_) { /* Copying the message should still succeed if usage tracking is unavailable. */ }
    toast({ title: 'Template copied', description: 'Paste it into the conversation reply.', status: 'success' });
  };

  const panel = { bg: 'white', border: '1px solid #e7e3ef', borderRadius: '16px' };

  return <Box>
    <Flex justify="space-between" align="center" mb={4} gap={3}>
      <Box><Heading size="lg">Template Governance Workspace</Heading><Text fontSize="sm" color="gray.500">Manage content quality, approvals, localization, performance, and lifecycle</Text></Box>
      <Button onClick={openCreate}>Create template</Button>
    </Flex>
    <Flex {...panel} minH="calc(100vh - 150px)" overflow="hidden" direction={{ base: 'column', lg: 'row' }}>
      <Box w={{ lg: '180px' }} flexShrink={0} p={3} borderRight={{ lg: '1px solid #e7e3ef' }}>
        <Text fontSize="xs" fontWeight="bold" mb={2}>TEMPLATE LIBRARY</Text>
        <InputGroup size="sm" mb={4}><InputLeftElement><FiSearch color="#8d879a" /></InputLeftElement><Input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Search categories" /></InputGroup>
        <VStack align="stretch" spacing={1}>{['All templates', 'Popular', 'Low use'].map(item => <Button key={item} size="sm" variant={categoryFilter === item ? 'solid' : 'ghost'} justifyContent="start" onClick={() => setCategoryFilter(item)}><Flex align="center" gap={2}><Box w="7px" h="7px" borderRadius="full" bg={libraryDotColors[item]} flexShrink={0}/><Text>{item}</Text></Flex></Button>)}</VStack>
        <Divider my={3} /><Text fontSize="xs" fontWeight="bold" color="gray.500">BY JOURNEY</Text>
        <VStack align="stretch" spacing={1} mt={2}>{visibleCategories.map(item => <Button key={item} size="sm" variant={categoryFilter === item ? 'solid' : 'ghost'} justifyContent="start" onClick={() => setCategoryFilter(item)}><Flex align="center" gap={2}><Box w="7px" h="7px" borderRadius="full" bg={libraryDotColors[item] || '#9ca3af'} flexShrink={0}/><Text>{item}</Text></Flex></Button>)}</VStack>
        <Divider my={3} /><Text fontSize="xs" fontWeight="bold" color="gray.500">BY CHANNEL</Text>
        {channels.slice(0, 4).map(item => <Button key={item} size="sm" variant="ghost" justifyContent="start" w="full" onClick={() => setChannelFilter(item)}><Flex align="center" gap={2}><Box w="7px" h="7px" borderRadius="full" bg={libraryDotColors[item]} flexShrink={0}/><Text>{item}</Text></Flex></Button>)}
      </Box>

      <Box flex="1" minW={0} p={3}>
        <Heading size="md">Response Templates</Heading><Text fontSize="xs" color="gray.500" mb={3}>Choose a reply and customize it before inserting.</Text>
        <Flex gap={2} mb={3} wrap="wrap">
          <InputGroup maxW="300px" size="sm"><InputLeftElement><FiSearch /></InputLeftElement><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, message, or tag" /></InputGroup>
          <Select size="sm" maxW="145px" value={channelFilter} onChange={e => setChannelFilter(e.target.value)}><option>All channels</option>{channels.map(item => <option key={item}>{item}</option>)}</Select>
          <Select size="sm" maxW="150px" value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option>Most used</option><option>Recently updated</option></Select>
        </Flex>
        <HStack mb={3}>{['All templates', 'My team', 'Recently used'].map(item => <Button key={item} size="xs" variant={scope === item ? 'solid' : 'outline'} onClick={() => setScope(item)}>{item}</Button>)}<Text fontSize="xs" color="gray.500" ml="auto">{filtered.length} results</Text></HStack>
        {loading ? <Flex justify="center" p={12}><Spinner /></Flex> : filtered.length === 0 ? <Box p={8} textAlign="center" color="gray.500">No templates match these filters. <Button size="sm" variant="link" onClick={openCreate}>Create one</Button></Box> :
          <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={3} spacingY={3}>{filtered.map(template => <Box key={template.id} className="group" role="group" tabIndex={0} position="relative" mb={0} {...panel} p={3} cursor="pointer" onFocus={() => setSelected(template.id)} onClick={() => setSelected(template.id)} borderColor={selected === template.id ? '#7860b1' : '#e7e3ef'} transition="all .16s ease, margin-bottom .16s ease" _hover={{ boxShadow: '0 8px 18px rgba(34, 27, 48, .14)', transform: 'translateY(-2px)', borderColor: '#d4c9e8', zIndex: 2, mb: 12 }} _focusWithin={{ boxShadow: '0 8px 18px rgba(34, 27, 48, .14)', borderColor: '#7860b1', zIndex: 2, mb: 12 }}>
            <Flex bg="#f8f6fb" p={2} borderRadius="lg" justify="space-between"><Box><Box h="6px" w="84px" bg="#d8d4e2" borderRadius="full" /><Box h="5px" w="120px" mt={1} bg="#e6e2ed" borderRadius="full" /></Box><Button aria-label={template.isPopular ? 'Remove from popular' : 'Mark as popular'} title={template.isPopular ? 'Remove from popular' : 'Mark as popular'} size="xs" variant="ghost" minW="auto" p={1} color={template.isPopular ? '#7761b0' : '#a9a4b2'} onClick={event => togglePopular(event, template)}><FiStar fill={template.isPopular ? '#7761b0' : 'none'} /></Button></Flex>
            <Text fontSize="sm" fontWeight="bold" mt={2}>{template.title}</Text><Text fontSize="xs" color="gray.500">{template.description}</Text>
            <Flex justify="space-between" mt={2}><HStack spacing={1}><Badge colorScheme="purple" borderRadius="full" px={2.5} py={0.5}>{template.journey}</Badge><Badge colorScheme="blue" borderRadius="full" px={2.5} py={0.5}>{template.channel}</Badge></HStack><Text fontSize="xs" color="gray.500">{template.uses} uses</Text></Flex>
            <HStack position="absolute" left="50%" bottom="-42px" transform="translateX(-50%)" spacing={2} opacity={{ base: 1, md: 0 }} pointerEvents={{ base: 'auto', md: 'none' }} transition="opacity .14s ease" zIndex={3} _groupHover={{ opacity: 1, pointerEvents: 'auto' }} _groupFocusWithin={{ opacity: 1, pointerEvents: 'auto' }}>
              <Button aria-label={`Delete ${template.title}`} title="Delete template" isDisabled={saving} size="sm" w="34px" h="34px" minW="34px" p={0} borderRadius="full" bg="white" boxShadow="md" color="red.500" onClick={event => { event.stopPropagation(); removeTemplate(template); }}><FiTrash2 /></Button>
              <Button aria-label={`Edit ${template.title}`} title="Edit template" size="sm" w="34px" h="34px" minW="34px" p={0} borderRadius="full" bg="white" boxShadow="md" color="blue.500" onClick={event => { event.stopPropagation(); openEdit(template); }}><FiEdit2 /></Button>
              <Button aria-label={template.isShared ? `Remove ${template.title} from team sharing` : `Share ${template.title} with team`} title={template.isShared ? 'Remove from team sharing' : 'Share with team'} size="sm" w="34px" h="34px" minW="34px" p={0} borderRadius="full" bg="white" boxShadow="md" color="green.500" onClick={event => toggleTeamShare(event, template)}>{template.isShared ? <FiCheck /> : <FiArrowRight />}</Button>
            </HStack>
          </Box>)}</SimpleGrid>}
      </Box>

      <Box w={{ lg: '300px' }} p={3} borderLeft={{ lg: '1px solid #e7e3ef' }} flexShrink={0} display="flex" flexDirection="column" minH={{ lg: 'calc(100vh - 150px)' }}>
        <Heading size="sm">Preview</Heading><Text fontSize="xs" color="gray.500" mb={4}>Review the selected reply before inserting.</Text>
        <Text fontSize="xs" fontWeight="bold">PREVIEW AS</Text><Select size="md" mt={2} mb={3} value={previewAs} onChange={e => setPreviewAs(e.target.value)} iconColor="gray.500" borderRadius="xl" bg="white" pl={10} sx={{ backgroundImage: 'radial-gradient(circle, #d9ccff 0 11px, transparent 12px)', backgroundRepeat: 'no-repeat', backgroundPosition: '12px center' }}><option>New visitor</option><option>Returning customer</option><option>VIP customer</option></Select>
        <Box bg="#f8f7fa" p={3} border="1px solid #e7e3ef" borderRadius="xl"><Text fontSize="xs" color="gray.500">Live preview</Text><HStack align="start" spacing={2} mt={2}><Box w={4} h={4} borderRadius="full" bg="#d9ccff" flexShrink={0} mt={1}/><Box bg="white" p={3} borderRadius="xl" flex={1}><Text fontWeight="bold" fontSize="sm">{active?.title || 'Choose a template'}</Text><Text fontSize="xs" color="gray.500" mt={1} whiteSpace="pre-wrap">{previewMessage || 'Select a template to see a preview.'}</Text></Box></HStack><Button size="sm" display="flex" mx="auto" mt={3} minW="75%" borderRadius="full" onClick={() => setPreviewActionOpen(true)}>{active?.channel === 'Email' ? 'View message' : 'View getting started'}</Button></Box>
        <Box bg="#e9f7ef" p={3} borderRadius="xl" mt="auto"><Text color="green.700" fontSize="sm" fontWeight="bold">✓　{previewVariables.length} variable{previewVariables.length === 1 ? '' : 's'} resolved</Text><Text color="green.700" fontSize="xs">{previewVariables.length ? 'Visitor name and workspace' : 'No personalization variables required'}</Text></Box>
        <Divider my={3}/><Text fontSize="xs" color="gray.500">You can edit the message after inserting.</Text>
        <HStack mt={3} justify="end"><Button size="sm" variant="outline" borderRadius="full" onClick={() => setSelected('')}>Cancel</Button><Button size="sm" borderRadius="full" onClick={insertTemplate} isDisabled={!active}>Insert</Button></HStack>
      </Box>
    </Flex>

    <Modal isOpen={previewActionOpen} onClose={() => setPreviewActionOpen(false)} isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="2xl">
        <ModalHeader>{active?.title || 'Template preview'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text color="gray.600">This is the visitor experience preview for this template.</Text>
          <Box bg="#f8f7fa" borderRadius="xl" p={4} mt={3}>
            <Text fontWeight="bold">{active?.title || 'Welcome'}</Text>
            <Text color="gray.600" mt={2}>{previewMessage || 'Select a template to preview its message.'}</Text>
          </Box>
        </ModalBody>
        <ModalFooter><Button onClick={() => setPreviewActionOpen(false)}>Done</Button></ModalFooter>
      </ModalContent>
    </Modal>

    <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered>
      <ModalOverlay bg="rgba(42, 37, 53, .24)" />
      <ModalContent maxW="950px" maxH="88vh" overflowY="auto" bg="#eeedf4" borderRadius="22px" p={{ base: 3, md: 5 }}>
        <ModalHeader px={{ base: 2, md: 2 }} pt={1} pb={3} fontSize="lg" fontWeight="medium">{editingId ? 'Edit Template' : 'Create Template'}</ModalHeader>
        <ModalCloseButton top={5} right={5} />
        <ModalBody px={{ base: 2, md: 2 }} py={0}>
          <SimpleGrid templateColumns={{ base: '1fr', md: '1.25fr .75fr' }} spacing={4} minH={{ md: '390px' }}>
            <VStack align="stretch" bg="white" borderRadius="16px" p={{ base: 4, md: 5 }} spacing={3}>
              <FormControl isRequired><FormLabel fontSize="xs" color="gray.500" mb={1}>Name</FormLabel><Input size="sm" borderRadius="md" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Template name" /></FormControl>
              <FormControl><FormLabel fontSize="xs" color="gray.500" mb={1}>Title</FormLabel><Input size="sm" borderRadius="md" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="A short title for this response" /></FormControl>
              <FormControl><FormLabel fontSize="xs" color="gray.500" mb={1}>Category</FormLabel><Select size="sm" borderRadius="md" value={form.journey} onChange={e => setForm({ ...form, journey: e.target.value })}>{categories.map(item => <option key={item}>{item}</option>)}</Select></FormControl>
              <FormControl><FormLabel fontSize="xs" color="gray.500" mb={1}>Channel</FormLabel><Select size="sm" borderRadius="md" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>{channels.map(item => <option key={item}>{item}</option>)}</Select></FormControl>
              <FormControl isRequired><FormLabel fontSize="xs" color="gray.500" mb={1}>Content</FormLabel><Textarea borderRadius="md" minH="70px" resize="vertical" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Use {{name}} or {{workspace}} for personalized values." /><HStack spacing={0} mt={1} color="gray.600">{['↶','↷','Sans Serif','T','B','I','U','A','☷','☰','↤','↦'].map((tool, index) => <Button key={`${tool}-${index}`} size="xs" variant="ghost" minW={tool === 'Sans Serif' ? '72px' : '27px'} h="26px" px={1} borderRadius="md" fontSize="xs" fontWeight={tool === 'B' ? 'bold' : 'normal'} fontStyle={tool === 'I' ? 'italic' : 'normal'} textDecoration={tool === 'U' ? 'underline' : 'none'}>{tool}</Button>)}</HStack></FormControl>
              <Flex justify="space-between" align="center" mt="auto" pt={3}>
                <Button size="sm" aria-pressed={form.isShared} bg={form.isShared ? '#4d3b80' : 'white'} color={form.isShared ? 'white' : '#4d3b80'} border="1px solid #4d3b80" _hover={{ bg: form.isShared ? '#40316d' : '#f4f1fa' }} onClick={toggleFormSharing}>Share with Team {form.isShared && <span style={{ marginLeft: 8 }}>✓</span>}</Button>
                <HStack spacing={2}><Button size="sm" variant="ghost" bg="#f0eef2" color="#302d37" _hover={{ bg: '#e8e5eb' }} onClick={onClose}>Cancel</Button><Button size="sm" bg="#4d3b80" color="white" _hover={{ bg: '#40316d' }} onClick={saveTemplate} isLoading={saving}>{editingId ? 'Save' : 'Create template'}</Button></HStack>
              </Flex>
            </VStack>
            <Box><Heading size="md" fontWeight="medium" mb={3}>Preview</Heading><Flex bg="white" borderRadius="16px" minH={{ md: '350px' }} h="calc(100% - 34px)" p={3} align="center" justify="center"><Box w="full" border="1px solid #ece9f0" borderRadius="12px" p={3}><HStack align="start" spacing={2}><Badge borderRadius="full" colorScheme="purple">✦ {form.channel}</Badge><Text fontSize="xs" color="gray.600">{form.description || form.title || 'Your response preview'}</Text><Text color="gray.400" ml="auto">⋮</Text></HStack><Text fontSize="sm" mt={2} color="gray.700">{form.content || 'Your template message will appear here as you type.'}</Text></Box></Flex></Box>
          </SimpleGrid>
        </ModalBody>
      </ModalContent>
    </Modal>
  </Box>;
}
