import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Badge, Box, Button, Flex, Heading, Input, Text, Textarea, VStack, HStack, Divider, Progress, useToast, Select, useDisclosure, IconButton } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiMic, FiMicOff } from 'react-icons/fi';
import { useAppData } from '../context/AppDataContext';
import { addMessage, updateConversationStatus, releaseIntervention } from '../api';
import TemplatePickerModal from '../components/TemplatePickerModal';

export default function ConversationView() {
  const { id } = useParams(); const navigate = useNavigate(); const toast = useToast();
  const { conversations, interveneInConversation, updateConversation } = useAppData();
  const conversation = useMemo(() => conversations.find(c => String(c.id || c._id) === String(id)) || (!id ? conversations[0] : null), [conversations,id]);
  const conversationId = conversation?.id || conversation?._id;
  const [draft,setDraft]=useState(''); const [note,setNote]=useState(''); const [takingOver,setTakingOver]=useState(false); const [sending,setSending]=useState(false);
  const [isListening,setIsListening]=useState(false); const recognitionRef=useRef(null);
  const [slaNow, setSlaNow] = useState(Date.now());
  const [listSearch,setListSearch]=useState(''); const [listStatus,setListStatus]=useState('all'); const [listAlert,setListAlert]=useState('all');
  const templatePicker=useDisclosure();
  const visibleConversations=conversations.filter(c=>{const name=typeof c.customer==='string'?c.customer:c.customer?.name||'';return name.toLowerCase().includes(listSearch.toLowerCase())&&(listStatus==='all'||c.status===listStatus)&&(listAlert==='all'||c.alertLevel===listAlert);});
  useEffect(()=>{ if(!conversation && id && conversations.length) navigate('/conversations',{replace:true}); },[conversation,id,conversations.length,navigate]);
  useEffect(()=>()=>recognitionRef.current?.stop(),[]);
  useEffect(() => {
    const timer = window.setInterval(() => setSlaNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!conversation) return <Text>Loading conversation…</Text>;
  const customer = typeof conversation.customer === 'string' ? { name: conversation.customer } : (conversation.customer || {});
  const messages = conversation.messages || [];
  const latestCustomerMessage = [...messages].reverse().find(message => ['customer', 'user'].includes(String(message.sender || message.role || '').toLowerCase()));
  const providedDeadline = conversation.slaDeadline || conversation.slaDueAt || conversation.metrics?.slaDeadline;
  const alertLevel = String(conversation.alertLevel || 'medium').toLowerCase();
  const slaWindowMs = ({ high: 5, medium: 10, low: 15 }[alertLevel] || 10) * 60 * 1000;
  const lastCustomerTime = latestCustomerMessage?.timestamp || latestCustomerMessage?.time || conversation.lastCustomerMessageAt;
  const parsedLastCustomerTime = lastCustomerTime ? new Date(lastCustomerTime).getTime() : NaN;
  const inferredDeadline = Number.isFinite(parsedLastCustomerTime) && slaNow - parsedLastCustomerTime < 24 * 60 * 60 * 1000
    ? parsedLastCustomerTime + slaWindowMs
    : slaNow + slaWindowMs;
  const deadlineMs = providedDeadline ? new Date(providedDeadline).getTime() : inferredDeadline;
  const slaSeconds = Number.isFinite(deadlineMs) ? Math.ceil((deadlineMs - slaNow) / 1000) : null;
  const formatDuration = seconds => {
    const value = Math.abs(seconds);
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  };
  const isResolved = conversation.status === 'resolved';
  const slaColor = isResolved ? 'green' : slaSeconds <= 0 ? 'red' : slaSeconds <= 120 ? 'orange' : 'yellow';
  const slaTitle = isResolved ? 'SLA stopped · conversation resolved'
    : slaSeconds <= 0 ? `SLA breached ${formatDuration(slaSeconds)} ago`
      : slaSeconds <= 120 ? `SLA breach likely in ${formatDuration(slaSeconds)}`
        : `Response due in ${formatDuration(slaSeconds)}`;
  const slaDescription = isResolved ? 'This conversation has been resolved.'
    : latestCustomerMessage ? `Based on the latest customer message${conversation.tags?.length ? ` about ${conversation.tags[0].replace(/[_-]/g, ' ')}` : ''} and ${alertLevel} alert priority.`
      : `Estimated ${alertLevel}-priority response window; no customer reply timestamp is available.`;
  const takeover = async () => { try { await interveneInConversation(conversationId); setTakingOver(true); toast({title:'You have taken over this conversation',status:'success'}); } catch(e) { toast({title:'Could not take over conversation',description:e.message,status:'error'}); } };
  const send = async () => { if(!draft.trim())return; setSending(true); try { await addMessage(conversationId,{text:draft,sender:'supervisor'}); updateConversation(conversationId,{messages:[...messages,{text:draft,sender:'supervisor',timestamp:new Date().toISOString()}]}); setDraft(''); } catch(e) { toast({title:'Could not send reply',description:e.message,status:'error'}); } finally {setSending(false);} };
  const resolve = async () => { try { await updateConversationStatus(conversationId,'resolved'); updateConversation(conversationId,{status:'resolved'}); toast({title:'Conversation marked resolved',status:'success'}); } catch(e){toast({title:'Could not update status',status:'error'});} };
  const release = async () => { try { await releaseIntervention(conversationId,note); setTakingOver(false); updateConversation(conversationId,{status:'active'}); toast({title:'Control returned to AI',status:'success'});} catch(e){toast({title:'Could not return control',status:'error'});} };
  const toggleVoiceInput = () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { toast({ title: 'Voice input is unavailable', description: 'Use a browser with Web Speech recognition support.', status: 'warning' }); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const spokenText = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript.trim()).filter(Boolean).join(' ');
      if (spokenText) setDraft(current => `${current}${current.trim() ? ' ' : ''}${spokenText}`);
    };
    recognition.onerror = event => {
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') toast({ title: 'Voice input failed', description: event.error === 'not-allowed' ? 'Allow microphone access in your browser.' : event.error, status: 'warning' });
    };
    recognition.onend = () => setIsListening(false);
    try { recognition.start(); setIsListening(true); }
    catch (error) { setIsListening(false); toast({ title: 'Could not start voice input', description: error.message, status: 'warning' }); }
  };
  const panel={bg:'white',border:'1px solid #e7e3ef',borderRadius:'14px',p:3};
  return <Box><Flex gap={3} align="stretch" direction={{base:'column',xl:'row'}} minH="calc(100vh - 104px)">
      <Box {...panel} w={{xl:'220px'}} flexShrink={0} bg="#fbfaff"><Heading size="sm" mb={1}>Customer Conversations</Heading><Text fontSize="xs" color="gray.500" mb={3}>Active cases needing review</Text><Input size="sm" bg="white" placeholder="Search customer or case…" mb={2} value={listSearch} onChange={e=>setListSearch(e.target.value)}/><HStack mb={3}><Select bg="white" size="xs" value={listStatus} onChange={e=>setListStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="waiting">Waiting</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></Select><Select bg="white" size="xs" value={listAlert} onChange={e=>setListAlert(e.target.value)}><option value="all">All alerts</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></HStack><VStack align="stretch" spacing={2}>{visibleConversations.map((c,i)=>{const name=typeof c.customer==='string'?c.customer:c.customer?.name || 'Customer';return <Box key={c.id||c._id||i} as="button" textAlign="left" onClick={()=>navigate(`/conversation/${c.id||c._id}`)} border="1px solid" borderColor={(c.id||c._id)===conversationId?'#8067ba':'#e5dff0'} p={2.5} borderRadius="lg" bg={(c.id||c._id)===conversationId?'#f1edfa':'white'}><HStack><Avatar size="xs" name={name} bg="#d9b18f"/><Text fontSize="xs" fontWeight="bold" noOfLines={1}>{name}</Text></HStack><Text fontSize="xs" color="gray.500" mt={1} noOfLines={1}>{c.tags?.[0] || c.status || 'Customer support'}</Text><Flex justify="space-between" align="center" mt={2}><Badge borderRadius="full" colorScheme={c.alertLevel==='high'?'red':c.alertLevel==='medium'?'orange':'blue'}>{c.alertLevel || 'Watch'}</Badge><Text fontSize="9px" color="gray.500">{c.status || 'active'}</Text></Flex></Box>})}</VStack></Box>
      <Box {...panel} flex="1" minW={0} display="flex" flexDirection="column"><Flex justify="space-between" align="center" bg="#faf8fc" p={2.5} borderRadius="lg"><HStack><Avatar size="sm" name={customer.name} bg="#d9b18f"/><Box><Text fontWeight="bold" fontSize="sm">{customer.name || 'Customer'} · Case #{String(id).slice(-5)}</Text><Text fontSize="xs" color="gray.500">{conversation.tags?.join(' • ') || 'Customer support'} · {customer.language || 'Web chat'} · {conversation.status || 'active'}</Text></Box></HStack><HStack><Badge borderRadius="full" colorScheme={conversation.alertLevel==='high'?'red':'orange'}>{conversation.alertLevel || 'Priority'}</Badge>{takingOver?<Button size="sm" onClick={release}>Return to AI</Button>:<Button size="sm" onClick={takeover}>Take over</Button>}</HStack></Flex>
        <Flex bg={isResolved ? 'green.50' : slaSeconds <= 0 ? 'red.50' : slaSeconds <= 120 ? 'orange.50' : '#fff4c9'} p={3} mt={2} borderRadius="lg" gap={2}><Text color={`${slaColor}.500`}>●</Text><Box><Text fontSize="sm" fontWeight="bold">{slaTitle}</Text><Text fontSize="xs" color="gray.600">{slaDescription}</Text></Box></Flex>
        <VStack data-testid="message-list" className="conversation-messages" align="stretch" spacing={3} py={4} px={1} flex="1" minH="260px" maxH="42vh" overflowY="auto">{messages.length ? messages.map((m,i)=>{const fromAgent=['agent','ai','assistant'].includes(String(m.sender||m.role).toLowerCase());return <Flex key={m._id||i} justify={fromAgent?'flex-end':'flex-start'}><Box bg={fromAgent?'#ebe5f6':'#f5f2f8'} p={3} maxW="76%" borderRadius="xl"><Text fontSize="9px" color="gray.500" textTransform="uppercase">{m.sender||m.role||'Customer'} · {m.timestamp?new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Today'}</Text><Text fontSize="xs" mt={1}>{m.text||m.content}</Text></Box></Flex>}) : <Text color="gray.500" textAlign="center" m="auto">No message history is available for this case yet.</Text>}</VStack>
        <Box bg="#faf8fc" border="1px solid #e8e1f2" p={3} borderRadius="lg" mb={2}><Flex justify="space-between"><Text fontWeight="bold" fontSize="sm">Co-pilot recommendation</Text><Badge borderRadius="full" colorScheme="green">Confidence 88%</Badge></Flex><Text fontSize="xs" mt={2}>Approve expedited refund of ₹8,420 and waive the standard review period.</Text><Text fontSize="9px" color="gray.500" mt={1}>Evidence: return scan received · Item category eligible · Customer lifetime value: high</Text><HStack mt={2} spacing={1}><Button size="xs" onClick={()=>{setDraft('I’ve reviewed your return evidence and approved an expedited refund of ₹8,420. You should receive the refund shortly.');toast({title:'Recommendation approved',description:'Review the reply before sending.',status:'success'});}}>Approve action</Button><Button size="xs" variant="outline" onClick={()=>{setDraft('I’ve reviewed the return evidence and can help with your refund. I’m checking the expected timing now.');toast({title:'Response ready to edit',status:'info'});}}>Edit response</Button><Button size="xs" variant="outline" onClick={takeover}>Escalate policy</Button></HStack></Box>
        <Box bg="white" border="1px solid #e7e3ef" p={2.5} borderRadius="lg"><Flex justify="space-between" align="center" mb={2}><Text fontSize="xs" fontWeight="bold">Supervisor response</Text><Button size="xs" h="24px" px={2} borderRadius="full" bg="#f0eef4" color="#514083" _hover={{bg:'#e8e4ef'}} onClick={templatePicker.onOpen}><Avatar size="2xs" name="Neha P." mr={1}/>Template<span style={{marginLeft:4}}>⌄</span></Button></Flex><Flex gap={2} align="end"><Textarea flex="1" resize="none" rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a response to the customer…"/><IconButton aria-label={isListening ? 'Stop voice input' : 'Start voice input'} title={isListening ? 'Stop voice input' : 'Speak a reply'} icon={isListening ? <FiMicOff /> : <FiMic />} colorScheme={isListening ? 'red' : 'purple'} variant={isListening ? 'solid' : 'outline'} onClick={toggleVoiceInput} /><Button onClick={send} isLoading={sending}>Send reply</Button></Flex>{isListening && <Text fontSize="xs" color="red.500" mt={1}>Listening… speak your reply.</Text>}{takingOver&&<Flex gap={2} mt={2}><Input size="sm" value={note} onChange={e=>setNote(e.target.value)} placeholder="Guidance for the AI before returning control"/><Button size="sm" variant="outline" onClick={release}>Return control</Button></Flex>}</Box>
      </Box>
      <Box {...panel} w={{xl:'270px'}} flexShrink={0} display="flex" flexDirection="column"><Heading size="sm">Customer intelligence</Heading><HStack my={3}><Avatar size="sm" name={customer.name} bg="#d9b18f"/><Box><Text fontWeight="bold" fontSize="sm">{customer.name||'Customer'}</Text><Text fontSize="xs" color="gray.500">{customer.tier || 'VIP • returning customer'}</Text></Box></HStack><Divider/><Flex><SimpleStat label="Lifetime value" value={customer.lifetimeValue||'₹1.24L'}/><SimpleStat label="Orders" value={customer.orders||'38'}/></Flex><Flex><SimpleStat label="Return rate" value={customer.returnRate||'5.2%'}/><SimpleStat label="Sentiment" value={conversation.metrics?.sentiment ?? '−0.62'}/></Flex><Divider my={2}/><Heading size="sm">Case diagnostics</Heading><Text fontSize="xs" color="gray.500">Signals contributing to risk</Text>{[['Repeat contact',92,'red'],['Negative sentiment',78,'orange'],['Policy exception',66,'blue'],['Churn propensity',58,'purple']].map(([l,v,c])=><Box key={l} my={2}><Flex justify="space-between" fontSize="xs"><Text>{l}</Text><Text>{v}%</Text></Flex><Progress value={v} colorScheme={c} size="xs" mt={1}/></Box>)}<Divider my={2}/><Text fontSize="xs" color="gray.500" mb={2} mt="auto">Feedback Notes</Text><Textarea value={note} onChange={e=>setNote(e.target.value)} bg="#ffeca5" minH="105px" placeholder="Write here…"/><Button w="full" mt={3} onClick={resolve}>Mark as Resolved</Button></Box>
    </Flex>
    <TemplatePickerModal isOpen={templatePicker.isOpen} onClose={templatePicker.onClose} onInsert={(_template, message) => { setDraft(message); toast({ title: 'Template inserted', description: 'You can edit it before sending.', status: 'success' }); }} />
  </Box>;
}
function SimpleStat({label,value}) { return <Box display="inline-block" w="50%" py={3}><Text fontSize="9px" color="gray.500" textTransform="uppercase">{label}</Text><Text fontWeight="bold">{value}</Text></Box>; }
