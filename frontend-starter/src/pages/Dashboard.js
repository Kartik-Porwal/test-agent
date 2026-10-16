import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Flex, Heading, HStack, Link as ChakraLink, Menu,
  MenuButton, MenuItem, MenuList, Progress, SimpleGrid, Table, Tbody, Td,
  Text, Th, Thead, Tr, VStack
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, Tooltip } from 'recharts';
import { useAppData } from '../context/AppDataContext';
import { useWebSocket } from '../context/WebSocketContext';

const ranges = [
  { label: 'Last 30 min', ms: 30 * 60 * 1000 },
  { label: 'Last 2 hours', ms: 2 * 60 * 60 * 1000 },
  { label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: 'All time', ms: Infinity },
];
const panel = { bg: 'white', border: '1px solid #e7e3ef', borderRadius: '16px', p: 3 };
const regionOf = conversation => conversation.region || conversation.customer?.region || 'Unassigned';
const riskOf = conversation => conversation.metrics?.risk ?? Math.max(
  conversation.alertLevel === 'high' ? 90 : conversation.alertLevel === 'medium' ? 65 : 20,
  conversation.metrics?.confidenceScore != null ? Math.round((1 - conversation.metrics.confidenceScore) * 100) : 0
);
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function Dashboard() {
  const { conversations = [], agents = [], loading = {}, dashboardHistory = [] } = useAppData();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const [liveConversations, setLiveConversations] = useState(null);
  const [liveHistory, setLiveHistory] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [rangeLabel, setRangeLabel] = useState('Last 30 min');
  const [regionFilter, setRegionFilter] = useState('All regions');
  useEffect(() => {
    const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:8080').replace(/\/$/, '');
    const stream = new EventSource(`${apiBase}/api/analytics/stream`);
    stream.onopen = () => setSseConnected(true);
    stream.addEventListener('dashboard', event => {
      try {
        const snapshot = JSON.parse(event.data);
        setLiveConversations(snapshot.conversations || []);
        setLiveHistory(previous => [...previous, snapshot].slice(-360));
      } catch (error) {
        console.error('Unable to read dashboard event:', error);
      }
    });
    stream.onerror = () => setSseConnected(false);
    return () => { stream.close(); setSseConnected(false); };
  }, []);
  const dashboardConversations = liveConversations || conversations;
  const history = liveHistory.length ? liveHistory : dashboardHistory;
  const selectedRange = ranges.find(range => range.label === rangeLabel) || ranges[0];
  const cutoff = selectedRange.ms === Infinity ? 0 : Date.now() - selectedRange.ms;
  const availableRegions = [...new Set(dashboardConversations.map(regionOf))].sort();
  const queues = [...new Set(dashboardConversations.map(conversation => conversation.tags?.[0] || conversation.queue || 'Unassigned'))];

  const filtered = dashboardConversations.filter(conversation => {
    const started = new Date(conversation.startTime || conversation.createdAt || 0).getTime();
    const withinRange = selectedRange.ms === Infinity || !started || started >= cutoff;
    const inRegion = regionFilter === 'All regions' || regionOf(conversation) === regionFilter;
    return withinRange && inRegion;
  });
  const active = filtered.filter(conversation => ['active', 'waiting'].includes(conversation.status));
  const atRisk = filtered.filter(conversation => conversation.status !== 'resolved' && conversation.alertLevel === 'high');
  const resolved = filtered.filter(conversation => conversation.status === 'resolved').length;
  const resolutionRate = filtered.length ? `${Math.round(resolved / filtered.length * 100)}%` : '—';
  const responseTimes = filtered.map(conversation => Number(conversation.metrics?.responseTime)).filter(Number.isFinite);
  const averageResponseTime = responseTimes.length ? `${(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(1)}s` : '—';
  const sentiments = filtered.map(conversation => Number(conversation.metrics?.sentiment)).filter(Number.isFinite);
  const averageSentiment = sentiments.length
    ? `${Math.round(sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length * 100)}%`
    : '—';
  const metric = (title, value) => <Box {...panel} p={4}><Text fontSize="xs" color="#77718a" fontWeight="bold">{title}</Text><Flex justify="space-between" align="end"><Heading size="lg" mt={1}>{value}</Heading><Badge colorScheme="green" borderRadius="full" px={2}>Live</Badge></Flex></Box>;

  const chartData = useMemo(() => {
    const now = Date.now();
    const period = selectedRange.ms === Infinity ? 24 * 60 * 60 * 1000 : selectedRange.ms;
    const start = now - period;
    const snapshots = history.filter(snapshot => snapshot.timestamp >= start && snapshot.timestamp <= now);
    const currentRegion = regionFilter === 'All regions' ? null : regionFilter;
    const getCounts = snapshot => {
      const counts = currentRegion ? snapshot.regions?.[currentRegion] : snapshot;
      return counts || { activeCount: 0, slaCount: 0 };
    };
    const latest = history[history.length - 1];
    return Array.from({ length: 6 }, (_, index) => {
      const time = start + period * index / 5;
      const snapshot = snapshots.filter(item => item.timestamp <= time).slice(-1)[0] || snapshots[0] || latest;
      const counts = snapshot ? getCounts(snapshot) : { activeCount: active.length, slaCount: atRisk.length };
      return { time, label: new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), messages: counts.messageCount ?? snapshot?.messageCount ?? 0, risk: counts.slaCount };
    });
  }, [history, selectedRange.ms, regionFilter, active.length, atRisk.length]);

  const ranked = [...filtered].sort((a, b) => riskOf(b) - riskOf(a));
  const queueHealth = Object.entries(filtered.reduce((groups, conversation) => {
    const name = conversation.tags?.[0] || conversation.queue || 'Unassigned';
    if (!groups[name]) groups[name] = { total: 0, risk: 0 };
    groups[name].total += 1;
    if (conversation.status !== 'resolved' && conversation.alertLevel === 'high') groups[name].risk += 1;
    return groups;
  }, {})).map(([name, value]) => ({ name, value, percent: Math.round(value.risk / value.total * 100) }))
    .sort((a, b) => b.percent - a.percent).slice(0, 4);

  const exportReport = () => {
    const header = ['Conversation ID', 'Customer', 'Agent', 'Status', 'Alert level', 'Region', 'Started', 'Response time (seconds)', 'Sentiment', 'Tags'];
    const rows = filtered.map(conversation => [
      conversation.id || conversation._id,
      conversation.customer?.name || conversation.customer,
      conversation.agent?.name,
      conversation.status,
      conversation.alertLevel,
      regionOf(conversation),
      conversation.startTime || conversation.createdAt,
      conversation.metrics?.responseTime,
      conversation.metrics?.sentiment,
      (conversation.tags || []).join('; '),
    ]);
    const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `supervisor-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const takeOver = conversation => navigate(`/conversation/${conversation.id || conversation._id}`);
  const distinctRegions = availableRegions.filter(region => region !== 'Unassigned').length;

  return <Box>
    <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
      <Box><Heading size="lg">Dashboard</Heading><Text fontSize="sm" color="gray.500">Live supervision across {queues.length} queues, {distinctRegions} assigned regions, and {agents.length} AI agents</Text></Box>
      <HStack flexWrap="wrap" justify="flex-end" spacing={2}>
        <Menu><MenuButton as={Button} size="sm" variant="outline">{rangeLabel}</MenuButton><MenuList>{ranges.map(range => <MenuItem key={range.label} onClick={() => setRangeLabel(range.label)}>{range.label}</MenuItem>)}</MenuList></Menu>
        <Menu><MenuButton as={Button} size="sm" variant="outline">{regionFilter}</MenuButton><MenuList><MenuItem onClick={() => setRegionFilter('All regions')}>All regions</MenuItem>{(availableRegions.length ? availableRegions : ['Unassigned']).map(region => <MenuItem key={region} onClick={() => setRegionFilter(region)}>{region === 'Unassigned' ? 'Unassigned region' : region}</MenuItem>)}</MenuList></Menu>
        <Button size="sm" onClick={exportReport}>Export report</Button>
      </HStack>
    </Flex>
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 5 }} spacing={3} mb={4}>
      {metric('ACTIVE LOAD', active.length)}{metric('SLA AT RISK', atRisk.length)}{metric('RESOLUTION RATE', resolutionRate)}{metric('AVG. RESPONSE TIME', averageResponseTime)}{metric('AVG. CUSTOMER SENTIMENT', averageSentiment)}
    </SimpleGrid>

    <SimpleGrid columns={{ base: 1, xl: 12 }} spacing={3} mb={4}>
      <Box {...panel} gridColumn={{ xl: 'span 6' }}><Flex justify="space-between" align="start" wrap="wrap"><Box><Heading size="sm">Live conversation activity</Heading><Text fontSize="xs" color="gray.500" mb={2}>Messages received and current high risk cases over time</Text></Box><Badge colorScheme={sseConnected || isConnected ? 'green' : 'red'}>{sseConnected ? 'Live · 2 sec' : isConnected ? 'Live updates on' : 'Reconnecting'}</Badge></Flex><Box h="190px"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ left: -25, right: 4, top: 8 }}><CartesianGrid stroke="#eeeaf3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label} /><Line type="monotone" dataKey="messages" name="Messages received" stroke="#6653a0" strokeWidth={3} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="risk" name="SLA at risk" stroke="#e9a42d" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></Box><HStack fontSize="xs"><Badge colorScheme="purple">Messages</Badge><Badge colorScheme="orange">SLA at risk</Badge></HStack></Box>
      <Box {...panel} gridColumn={{ xl: 'span 3' }}><Heading size="sm">Queue health</Heading><Text fontSize="xs" color="gray.500" mb={3}>Share of conversations marked high risk</Text>{queueHealth.length ? queueHealth.map(({ name, value, percent }) => { const color = percent >= 50 ? 'red' : percent > 0 ? 'orange' : 'green'; return <Box key={name} mb={3}><Flex justify="space-between" fontSize="xs" mb={1}><Text>{name}</Text><Text color={`${color}.600`} fontWeight="bold">{percent}% · {value.risk}/{value.total}</Text></Flex><Progress value={percent} colorScheme={color} size="sm" borderRadius="full" /></Box>; }) : <Text fontSize="sm" color="gray.500">No conversations in this time range.</Text>}</Box>
      <Box {...panel} gridColumn={{ xl: 'span 3' }}><Heading size="sm">Critical signals</Heading><Text fontSize="xs" color="gray.500" mb={3}>High risk conversations needing attention</Text>{ranked.filter(conversation => conversation.alertLevel === 'high' && conversation.status !== 'resolved').slice(0, 3).map(conversation => <Flex key={conversation.id || conversation._id} bg="red.50" p={3} mb={2} borderRadius="lg" gap={2}><Badge colorScheme="red" borderRadius="full" alignSelf="start">●</Badge><Box><Text fontSize="xs" fontWeight="bold">SLA alert · {conversation.customer?.name || 'Customer'}</Text><Text fontSize="xs" color="gray.500">{conversation.tags?.[0] || conversation.agent?.name || 'Conversation'} · risk {riskOf(conversation)}</Text></Box></Flex>)}{!ranked.some(conversation => conversation.alertLevel === 'high' && conversation.status !== 'resolved') && <Text fontSize="sm" color="gray.500">No high risk conversations right now.</Text>}</Box>
    </SimpleGrid>

    <SimpleGrid columns={{ base: 1, xl: 12 }} spacing={3}>
      <Box {...panel} gridColumn={{ xl: 'span 8' }}><Flex justify="space-between" align="center" mb={2}><Box><Heading size="sm">Priority conversation queue</Heading><Text fontSize="xs" color="gray.500">Sorted by alert level and confidence risk</Text></Box><Button as={Link} to="/conversations" size="xs" variant="outline">View all ↗</Button></Flex><Box overflowX="auto"><Table size="sm"><Thead><Tr>{['CUSTOMER / CASE', 'QUEUE', 'AI OWNER', 'RISK', 'WAIT', 'RECOMMENDED ACTION'].map(header => <Th key={header} fontSize="9px">{header}</Th>)}</Tr></Thead><Tbody>{ranked.slice(0, 5).map(conversation => { const id = conversation.id || conversation._id; const waitMinutes = Math.max(0, Math.floor((Date.now() - new Date(conversation.startTime || Date.now()).getTime()) / 60000)); return <Tr key={id}><Td><ChakraLink as={Link} to={`/conversation/${id}`} fontWeight="bold">{conversation.customer?.name || 'Customer'} · #{String(id).slice(-5)}</ChakraLink></Td><Td>{conversation.tags?.[0] || conversation.queue || 'Unassigned'}</Td><Td>{conversation.agent?.name || 'Unassigned'}</Td><Td><Badge colorScheme={riskOf(conversation) >= 80 ? 'red' : riskOf(conversation) >= 50 ? 'orange' : 'green'}>{riskOf(conversation)}</Badge></Td><Td>{waitMinutes}m</Td><Td><Button size="xs" variant="link" color="#503b89" onClick={() => takeOver(conversation)}>{conversation.status === 'escalated' ? 'Review' : 'Take over'}</Button></Td></Tr>; })}{!ranked.length && <Tr><Td colSpan={6} textAlign="center" color="gray.500">{loading.conversations ? 'Loading conversations…' : 'No conversations match this time and region filter.'}</Td></Tr>}</Tbody></Table></Box></Box>
      <Box {...panel} gridColumn={{ xl: 'span 4' }}><Flex justify="space-between" align="center"><Heading size="sm">Live supervisor feed</Heading><Badge colorScheme={sseConnected || isConnected ? 'green' : 'gray'}>{sseConnected ? 'Auto-refresh · 2s' : isConnected ? 'Auto-refresh' : 'Offline'}</Badge></Flex><Text fontSize="xs" color="gray.500" mb={3}>Latest conversation activity</Text><VStack align="stretch" spacing={3}>{[...filtered].sort((a, b) => new Date(b.updatedAt || b.startTime || 0) - new Date(a.updatedAt || a.startTime || 0)).slice(0, 5).map(conversation => <Flex key={conversation.id || conversation._id} gap={3}><Badge colorScheme={conversation.alertLevel === 'high' ? 'red' : 'purple'} borderRadius="full">●</Badge><Box><Text fontSize="xs" fontWeight="bold">{conversation.status === 'escalated' ? 'Supervisor takeover' : conversation.lastMessage ? 'New message' : `Conversation ${conversation.status || 'updated'}`}</Text><Text fontSize="xs" color="gray.500">{conversation.customer?.name || 'Customer'} · {conversation.tags?.[0] || conversation.agent?.name || 'Support'}</Text></Box></Flex>)}{!filtered.length && <Text fontSize="sm" color="gray.500">No recent conversation activity.</Text>}</VStack></Box>
    </SimpleGrid>
  </Box>;
}
