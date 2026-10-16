import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Flex, Heading, Text, SimpleGrid, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Switch, HStack, VStack, Badge, useToast, Select, Input, Spinner } from '@chakra-ui/react';
import { useAppData } from '../context/AppDataContext';
import { updateAgentConfig } from '../api';

const defaults = { temperature: .68, speed: .72, empathy: .84, stability: .82, maxTokens: 512, capabilities: {}, knowledgeBases: {}, escalation: { noResponse: 90, sentiment: -.55, refundValue: 5000, confidence: .64 } };
const cases = [
  { prompt: 'My refund is delayed and I need the money today. Can you override policy?', intent: 'Refund delay', sentiment: 'Urgent negative', policy: 'Refund exception review', risk: 'Refund exceeds autonomous limit' },
  { prompt: 'The tracking link says delivered, but I never received my package.', intent: 'Missing delivery', sentiment: 'Frustrated', policy: 'Delivery investigation', risk: 'Evidence required before replacement' },
  { prompt: 'I want to change the email address on my account.', intent: 'Account update', sentiment: 'Neutral', policy: 'Identity verification', risk: 'Account change capability setting' },
  { prompt: 'Can you explain the difference between the two plans?', intent: 'Product question', sentiment: 'Neutral', policy: 'Product knowledge lookup', risk: 'Knowledge source availability' },
  { prompt: 'I have contacted support three times and still have no answer.', intent: 'Repeat contact', sentiment: 'Negative', policy: 'Supervisor escalation', risk: 'Sentiment escalation threshold' }
];

function configForAgent(agent) {
  if (!agent) return defaults;
  return {
    ...defaults,
    temperature: agent.parameters?.temperature ?? defaults.temperature,
    speed: agent.parameters?.top_p ?? defaults.speed,
    maxTokens: agent.parameters?.max_tokens ?? defaults.maxTokens,
    capabilities: Object.fromEntries((agent.capabilities || []).map(x => [x.id, Boolean(x.enabled)])),
    knowledgeBases: Object.fromEntries((agent.knowledgeBases || []).map(x => [x.id, Boolean(x.enabled)])),
    escalation: {
      ...defaults.escalation,
      noResponse: agent.escalationThresholds?.responseTime ?? defaults.escalation.noResponse,
      sentiment: agent.escalationThresholds?.negativeSentiment ?? defaults.escalation.sentiment,
      confidence: agent.escalationThresholds?.lowConfidence ?? defaults.escalation.confidence
    }
  };
}

function enabledCount(values, fallback = 0) {
  const items = Object.values(values || {});
  return items.length ? items.filter(Boolean).length : fallback;
}

function assess(config, agent, scenario) {
  const enabledCapabilities = enabledCount(config.capabilities, (agent?.capabilities || []).filter(x => x.enabled).length);
  const enabledKnowledge = enabledCount(config.knowledgeBases, (agent?.knowledgeBases || []).filter(x => x.enabled).length);
  const score = Math.max(40, Math.min(100, Math.round(68 + config.empathy * 14 + config.stability * 8 + Math.min(6, enabledCapabilities * 2) + Math.min(6, enabledKnowledge * 2) - Math.abs(config.temperature - .5) * 10)));
  const escalates = scenario.intent.toLowerCase().includes('refund') && Number(config.escalation.confidence) >= .6;
  const response = escalates
    ? 'I’m sorry this is taking longer than expected. I’ll review the available refund evidence and escalate this for a supervisor because it may exceed my approval limits.'
    : `I’m sorry you’re dealing with this. I’ll use the ${enabledKnowledge ? 'available support guidance' : 'conversation details'} to check the next step and help resolve it.`;
  return { score, enabledCapabilities, enabledKnowledge, escalates, response };
}

export default function AgentConfig() {
  const { agents, updateAgent } = useAppData();
  const toast = useToast();
  const [agentId, setAgentId] = useState('');
  const [config, setConfig] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [tab, setTab] = useState('Parameters');
  const [caseIndex, setCaseIndex] = useState(0);
  const [evaluation, setEvaluation] = useState(null);
  const [savedConfig, setSavedConfig] = useState(null);
  const agent = agents.find(a => String(a.id || a._id) === agentId);
  const scenario = cases[caseIndex % cases.length];

  useEffect(() => {
    if (!agentId && agents.length) setAgentId(String(agents[0].id || agents[0]._id));
  }, [agents, agentId]);

  useEffect(() => {
    if (!agent) return;
    const next = configForAgent(agent);
    setConfig(next);
    setSavedConfig(JSON.stringify(next));
    setEvaluation(null);
  }, [agent]);

  const isDirty = savedConfig !== null && JSON.stringify(config) !== savedConfig;
  const result = useMemo(() => assess(config, agent, scenario), [config, agent, scenario]);
  const change = (key, value) => setConfig(current => ({ ...current, [key]: value }));
  const toggleItem = (key, id, enabled) => setConfig(current => ({ ...current, [key]: { ...current[key], [id]: enabled } }));

  const save = async () => {
    if (!agent) return toast({ title: 'Select an available agent before saving', status: 'warning' });
    setSaving(true);
    const payload = {
      parameters: { temperature: Number(config.temperature), top_p: Number(config.speed), max_tokens: Number(config.maxTokens) },
      capabilities: (agent.capabilities || []).map(x => ({ id: x.id, enabled: Boolean(config.capabilities[x.id] ?? x.enabled) })),
      knowledgeBases: (agent.knowledgeBases || []).map(x => ({ id: x.id, enabled: Boolean(config.knowledgeBases[x.id] ?? x.enabled) })),
      escalationThresholds: { responseTime: Number(config.escalation.noResponse), negativeSentiment: Number(config.escalation.sentiment), lowConfidence: Number(config.escalation.confidence) }
    };
    try {
      const response = await updateAgentConfig(agent.id || agent._id, payload);
      const updated = response.agent || response;
      updateAgent(agent.id || agent._id, updated);
      const next = configForAgent(updated);
      setConfig(next);
      setSavedConfig(JSON.stringify(next));
      toast({ title: 'Configuration saved and deployed', status: 'success' });
    } catch (error) {
      toast({ title: 'Could not save configuration', description: error.response?.data?.message || error.message, status: 'error' });
    } finally { setSaving(false); }
  };

  const runEvaluation = () => {
    setEvaluating(true);
    setEvaluation(null);
    window.setTimeout(() => {
      setEvaluation({ ...result, caseIndex, timestamp: new Date().toLocaleTimeString() });
      setEvaluating(false);
      toast({ title: `Evaluation complete · ${result.score}/100`, status: result.score >= 85 ? 'success' : 'warning' });
    }, 450);
  };

  const nextCase = () => {
    setCaseIndex(index => (index + 1) % cases.length);
    setEvaluation(null);
  };
  const panel = { bg: 'white', border: '1px solid #e7e3ef', borderRadius: '16px', p: 4 };
  const range = (title, key, min = 0, max = 1, step = .01) => <Box mb={4} key={key}><Flex justify="space-between" mb={1}><Text fontSize="sm" fontWeight="medium">{title}</Text><Text fontSize="sm" color="#4d3c83">{Number(config[key]).toFixed(2)}</Text></Flex><Slider value={Number(config[key])} min={min} max={max} step={step} onChange={value => change(key, value)}><SliderTrack bg="#eeeaf3"><SliderFilledTrack bg="#65519b" /></SliderTrack><SliderThumb bg="#514083" /></Slider><Flex justify="space-between"><Text fontSize="xs" color="gray.400">Precise</Text><Text fontSize="xs" color="gray.400">Exploratory</Text></Flex></Box>;

  return <Box><Flex justify="space-between" align="center" mb={4} gap={3}><Box><Heading size="lg">{agent?.name || 'Agent'} · Control Room</Heading><Text color="gray.500" fontSize="sm">Edit a draft, evaluate it against scenarios, then deploy the saved configuration.</Text></Box><HStack><Button variant="outline" onClick={runEvaluation} isLoading={evaluating} isDisabled={!agent}>Run evals</Button><Button onClick={save} isLoading={saving} isDisabled={!agent || !isDirty}>Review &amp; deploy</Button></HStack></Flex>
    <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={3} alignItems="stretch">
      <Box {...panel} gridColumn={{ lg: 'span 4' }}><Flex justify="space-between" align="center"><Heading size="sm">Behavior configuration</Heading><Badge colorScheme={isDirty ? 'yellow' : 'green'}>{isDirty ? 'Draft changes' : 'Saved'}</Badge></Flex><Select mt={3} size="sm" value={agentId} onChange={event => setAgentId(event.target.value)} placeholder="Select agent">{agents.map(item => <option key={item.id || item._id} value={item.id || item._id}>{item.name}</option>)}</Select><HStack mt={3} mb={4}>{['Parameters', 'Capabilities', 'Knowledge'].map(item => <Button key={item} size="xs" variant={tab === item ? 'solid' : 'ghost'} onClick={() => setTab(item)}>{item}</Button>)}</HStack>
        {tab === 'Parameters' ? <>{range('Creativity / Temperature', 'temperature')}{range('Response speed (top-p)', 'speed')}{range('Empathy (evaluation)', 'empathy')}{range('Stability (evaluation)', 'stability')}<HStack><Text fontSize="sm">Max tokens</Text><Input w="90px" size="sm" type="number" min={1} value={config.maxTokens} onChange={event => change('maxTokens', Number(event.target.value))} /></HStack><Heading size="sm" mt={5} mb={3}>Escalation policy</Heading>{[['No agent response', 'noResponse', 'seconds'], ['Customer sentiment', 'sentiment', 'score'], ['Confidence score', 'confidence', 'score']].map(([label, key, helper]) => <Flex key={key} justify="space-between" align="center" py={2} borderBottom="1px solid #f0edf4"><Text fontSize="sm">{label}</Text><HStack><Input w="82px" size="sm" type="number" value={config.escalation[key]} onChange={event => change('escalation', { ...config.escalation, [key]: Number(event.target.value) })} /><Text fontSize="xs" color="gray.500">{helper}</Text></HStack></Flex>)}</> : <VStack align="stretch" spacing={3}>{(tab === 'Capabilities' ? (agent?.capabilities || []) : (agent?.knowledgeBases || [])).map(item => { const key = tab === 'Capabilities' ? 'capabilities' : 'knowledgeBases'; return <Flex key={item.id} justify="space-between" align="center" py={2} borderBottom="1px solid #f0edf4"><Box><Text fontSize="sm">{item.name}</Text><Text fontSize="xs" color="gray.500">{tab === 'Capabilities' ? 'Allow agent to use this skill' : 'Allow retrieval from this knowledge source'}</Text></Box><Switch isChecked={Boolean(config[key][item.id] ?? item.enabled)} onChange={event => toggleItem(key, item.id, event.target.checked)} colorScheme="purple" /></Flex>; })}{agent && !(tab === 'Capabilities' ? agent.capabilities : agent.knowledgeBases)?.length && <Text fontSize="sm" color="gray.500">No {tab.toLowerCase()} are configured for this agent.</Text>}</VStack>}
        <Button mt={5} variant="outline" size="sm" onClick={() => setConfig(configForAgent(agent))} isDisabled={!agent}>Reset draft</Button>
      </Box>

      <Box {...panel} gridColumn={{ lg: 'span 5' }}><Heading size="sm" mb={3}>Performance &amp; guardrails</Heading><Text fontSize="xs" color="gray.500" mb={3}>Run evals to score the current draft configuration.</Text><SimpleGrid columns={2} spacing={3} mb={5}>{[['ENABLED CAPABILITIES', result.enabledCapabilities], ['KNOWLEDGE SOURCES', result.enabledKnowledge], ['DRAFT TEMPERATURE', Number(config.temperature).toFixed(2)], ['MAX TOKENS', config.maxTokens]].map(([label, value]) => <Box key={label} p={3} bg="#f8f6fa" borderRadius="lg"><Text fontSize="9px" color="gray.500">{label}</Text><Heading size="md">{value}</Heading></Box>)}</SimpleGrid><Flex justify="space-between" align="center"><Heading size="sm">Evaluation result</Heading>{evaluation && <Badge colorScheme="green">Last run {evaluation.timestamp}</Badge>}</Flex><Text fontSize="xs" color="gray.500" mb={3}>Scenario {caseIndex + 1} of {cases.length} · uses your current draft</Text>{[['Response quality', Math.min(100, Math.round(75 + config.empathy * 25))], ['Policy handling', result.escalates ? 94 : 78], ['Capability coverage', Math.min(100, result.enabledCapabilities * 20)], ['Knowledge coverage', Math.min(100, result.enabledKnowledge * 25)]].map(([label, value]) => <Flex key={label} align="center" gap={3} my={3}><Text fontSize="xs" w="125px">{label}</Text><Box flex="1"><Box h="6px" bg="#eeeaf3" borderRadius="full"><Box h="6px" bg={value >= 85 ? 'green.500' : value >= 70 ? 'orange.400' : 'red.500'} w={`${value}%`} borderRadius="full" transition="width .2s" /></Box></Box><Text fontSize="xs">{evaluation ? `${value}%` : 'Draft'}</Text><Badge colorScheme={evaluation ? (value >= 85 ? 'green' : 'orange') : 'gray'}>{evaluation ? (value >= 85 ? 'Pass' : 'Review') : 'Not run'}</Badge></Flex>)}<Box mt={5} p={3} bg={evaluation ? (evaluation.score >= 85 ? 'green.50' : 'orange.50') : '#f8f6fa'} borderRadius="lg"><Flex align="center" gap={2}>{evaluating && <Spinner size="sm" />}<Heading size="sm">{evaluating ? 'Evaluating draft…' : evaluation ? `${evaluation.score >= 85 ? 'PASS' : 'REVIEW'} · ${evaluation.score}/100` : 'No evaluation run'}</Heading></Flex><Text fontSize="xs" mt={1}>{evaluation ? `Scenario ${evaluation.caseIndex + 1} evaluated against draft parameters, capabilities, and knowledge sources.` : 'Run evals to calculate a score for the currently selected scenario.'}</Text></Box></Box>

      <Box {...panel} gridColumn={{ lg: 'span 3' }}><Flex justify="space-between"><Heading size="sm">Simulation console</Heading><Badge colorScheme="blue">Scenario {caseIndex + 1}/{cases.length}</Badge></Flex><Box p={3} bg="#f8f6fa" borderRadius="lg" mt={3}><Text fontSize="9px" color="gray.500">CUSTOMER PROMPT</Text><Text fontSize="sm" mt={2}>“{scenario.prompt}”</Text></Box><Box p={3} bg="#eee9f8" borderRadius="lg" mt={3}><Text fontSize="9px" color="#654c9e">DRAFT AGENT RESPONSE</Text><Text fontSize="sm" mt={2}>{result.response}</Text></Box><Heading size="sm" mt={5}>Decision trace</Heading>{[['Intent', `${scenario.intent} · ${scenario.intent.toLowerCase().includes('refund') ? '0.96' : '0.87'}`], ['Sentiment', scenario.sentiment], ['Policy node', scenario.policy], ['Risk gate', scenario.risk], ['Enabled sources', `${result.enabledKnowledge} knowledge · ${result.enabledCapabilities} capabilities`]].map(([label, value]) => <Flex key={label} justify="space-between" gap={2} py={2} borderBottom="1px solid #f0edf4" fontSize="xs"><Text color="gray.500">{label}</Text><Text textAlign="right">{value}</Text></Flex>)}<Button mt={3} w="full" onClick={nextCase}>Run next case</Button><Text fontSize="xs" color="gray.500" mt={2}>Scenario preview is a local simulation; it does not call an LLM.</Text></Box>
    </SimpleGrid>
  </Box>;
}
