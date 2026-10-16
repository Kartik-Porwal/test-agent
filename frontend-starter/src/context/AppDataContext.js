// // src/context/AppDataContext.js
// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { getConversations, getAgents, getKnowledgeBases } from '../api';
// import { useWebSocket } from './WebSocketContext';

// const AppDataContext = createContext(null);

// export const useAppData = () => useContext(AppDataContext);

// export const AppDataProvider = ({ children }) => {
//   const [conversations, setConversations] = useState([]);
//   const [agents, setAgents] = useState([]);
//   const [knowledgeBases, setKnowledgeBases] = useState([]);
//   const [loading, setLoading] = useState({
//     conversations: true,
//     agents: true,
//     knowledgeBases: true,
//   });
//   const [error, setError] = useState({
//     conversations: null,
//     agents: null,
//     knowledgeBases: null,
//   });
  
//   const { lastMessage } = useWebSocket();
  
//   // Load initial data
//   useEffect(() => {
//     const loadData = async () => {
//       try {
//         const conversationsData = await getConversations();
//         setConversations(conversationsData.data || []);
//         setLoading(prev => ({ ...prev, conversations: false }));
//       } catch (err) {
//         console.error('Error loading conversations:', err);
//         setError(prev => ({ ...prev, conversations: err.message }));
//         setLoading(prev => ({ ...prev, conversations: false }));
//       }
      
//       try {
//         const agentsData = await getAgents();
//         setAgents(agentsData || []);
//         setLoading(prev => ({ ...prev, agents: false }));
//       } catch (err) {
//         console.error('Error loading agents:', err);
//         setError(prev => ({ ...prev, agents: err.message }));
//         setLoading(prev => ({ ...prev, agents: false }));
//       }
      
//       try {
//         const knowledgeBasesData = await getKnowledgeBases();
//         setKnowledgeBases(knowledgeBasesData || []);
//         setLoading(prev => ({ ...prev, knowledgeBases: false }));
//       } catch (err) {
//         console.error('Error loading knowledge bases:', err);
//         setError(prev => ({ ...prev, knowledgeBases: err.message }));
//         setLoading(prev => ({ ...prev, knowledgeBases: false }));
//       }
//     };
    
//     loadData();
//   }, []);
  
//   // Handle WebSocket updates
//   useEffect(() => {
//     if (!lastMessage) return;
    
//     try {
//       switch (lastMessage.type) {
//         case 'conversations_update':
//           setConversations(lastMessage.data);
//           break;
          
//         case 'new_conversation':
//           setConversations(prev => [...prev, lastMessage.data]);
//           break;
          
//         case 'message_update':
//           setConversations(prev => 
//             prev.map(conv => {
//               if (conv.id === lastMessage.conversationId) {
//                 // In a real app, you'd need to handle this more carefully
//                 // Here we're just marking that there's a new message
//                 return {
//                   ...conv,
//                   hasNewMessage: true,
//                   lastMessage: lastMessage.message
//                 };
//               }
//               return conv;
//             })
//           );
//           break;
          
//         case 'metrics_update':
//           setConversations(prev => 
//             prev.map(conv => {
//               if (conv.id === lastMessage.conversationId) {
//                 return {
//                   ...conv,
//                   metrics: {
//                     ...conv.metrics,
//                     ...lastMessage.metrics
//                   }
//                 };
//               }
//               return conv;
//             })
//           );
//           break;
          
//         case 'agent_update':
//           setAgents(prev => 
//             prev.map(agent => {
//               if (agent.id === lastMessage.agentId) {
//                 return {
//                   ...agent,
//                   ...lastMessage.data
//                 };
//               }
//               return agent;
//             })
//           );
//           break;
          
//         default:
//           // Ignore other message types
//           break;
//       }
//     } catch (error) {
//       console.error('Error processing WebSocket message:', error);
//     }
//   }, [lastMessage]);
  
//   // Methods for updating data
//   const updateConversation = (id, data) => {
//     setConversations(prev => 
//       prev.map(conv => {
//         if (conv.id === id) {
//           return { ...conv, ...data };
//         }
//         return conv;
//       })
//     );
//   };
  
//   const updateAgent = (id, data) => {
//     setAgents(prev => 
//       prev.map(agent => {
//         if (agent.id === id) {
//           return { ...agent, ...data };
//         }
//         return agent;
//       })
//     );
//   };
  
//   return (
//     <AppDataContext.Provider
//       value={{
//         conversations,
//         agents,
//         knowledgeBases,
//         loading,
//         error,
//         updateConversation,
//         updateAgent,
//       }}
//     >
//       {children}
//     </AppDataContext.Provider>
//   );
// };
// src/context/AppDataContext.js

// src/context/AppDataContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getConversations, getAgents, getKnowledgeBases, interveneInConversation as requestIntervention } from '../api';
import { useWebSocket } from './WebSocketContext';

const AppDataContext = createContext(null);
export const useAppData = () => useContext(AppDataContext);

export const AppDataProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [dashboardHistory, setDashboardHistory] = useState([]);
  const [agents, setAgents] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [loading, setLoading] = useState({
    conversations: true,
    agents: true,
    knowledgeBases: true,
  });
  const [error, setError] = useState({
    conversations: null,
    agents: null,
    knowledgeBases: null,
  });

  const { lastMessage } = useWebSocket();

  useEffect(() => {
    const loadData = async () => {
      try {
        const conversationsData = await getConversations({ limit: 100 });
        setConversations(conversationsData.data || []);
        setLoading(prev => ({ ...prev, conversations: false }));
      } catch (err) {
        console.error('Error loading conversations:', err);
        setError(prev => ({ ...prev, conversations: err.message }));
        setLoading(prev => ({ ...prev, conversations: false }));
      }

      try {
        const agentsData = await getAgents();
        setAgents(Array.isArray(agentsData) ? agentsData : (agentsData.data || []));
        setLoading(prev => ({ ...prev, agents: false }));
      } catch (err) {
        console.error('Error loading agents:', err);
        setError(prev => ({ ...prev, agents: err.message }));
        setLoading(prev => ({ ...prev, agents: false }));
      }

      try {
        const knowledgeBasesData = await getKnowledgeBases();
        setKnowledgeBases(Array.isArray(knowledgeBasesData) ? knowledgeBasesData : (knowledgeBasesData.data || []));
        setLoading(prev => ({ ...prev, knowledgeBases: false }));
      } catch (err) {
        console.error('Error loading knowledge bases:', err);
        setError(prev => ({ ...prev, knowledgeBases: err.message }));
        setLoading(prev => ({ ...prev, knowledgeBases: false }));
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      switch (lastMessage.type) {
        case 'conversations_update':
          setConversations(prev => {
            const incoming = Array.isArray(lastMessage.data) ? lastMessage.data : [];
            const incomingIds = new Set(incoming.map(conv => String(conv.id || conv._id)));
            const merged = incoming.map(conv => {
              const existing = prev.find(item => String(item.id || item._id) === String(conv.id || conv._id));
              return existing ? { ...existing, ...conv, messages: conv.messages?.length ? conv.messages : existing.messages } : conv;
            });
            return [...merged, ...prev.filter(conv => !incomingIds.has(String(conv.id || conv._id)))];
          });
          break;

        case 'new_conversation':
          setConversations(prev => prev.some(conv => String(conv.id || conv._id) === String(lastMessage.data.id || lastMessage.data._id))
            ? prev.map(conv => String(conv.id || conv._id) === String(lastMessage.data.id || lastMessage.data._id) ? { ...conv, ...lastMessage.data } : conv)
            : [lastMessage.data, ...prev]);
          break;

        case 'message_update':
          setConversations(prev =>
            prev.map(conv =>
              String(conv.id || conv._id) === String(lastMessage.conversationId)
                ? {
                    ...conv,
                    hasNewMessage: true,
                    lastMessage: lastMessage.message,
                    messages: [...(conv.messages || []), lastMessage.message],
                  }
                : conv
            )
          );
          break;

        case 'metrics_update':
          setConversations(prev =>
            prev.map(conv =>
              String(conv.id || conv._id) === String(lastMessage.conversationId)
                ? {
                    ...conv,
                    metrics: {
                      ...conv.metrics,
                      ...lastMessage.metrics,
                    },
                  }
                : conv
            )
          );
          break;

        case 'agent_update':
          setAgents(prev =>
            prev.map(agent =>
              String(agent.id || agent._id) === String(lastMessage.agentId)
                ? { ...agent, ...lastMessage.data }
                : agent
            )
          );
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [lastMessage]);

  useEffect(() => {
    if (!conversations.length) return;
    const regions = {};
    conversations.forEach(conversation => {
      const region = conversation.region || conversation.customer?.region || 'Unassigned';
      if (!regions[region]) regions[region] = { activeCount: 0, slaCount: 0, total: 0, messageCount: 0 };
      regions[region].total += 1;
      regions[region].messageCount += conversation.messages?.length || 0;
      if (conversation.status === 'active' || conversation.status === 'waiting') regions[region].activeCount += 1;
      if (conversation.status !== 'resolved' && conversation.alertLevel === 'high') regions[region].slaCount += 1;
    });
    setDashboardHistory(previous => [...previous, {
      timestamp: Date.now(),
      activeCount: conversations.filter(conversation => conversation.status === 'active' || conversation.status === 'waiting').length,
      slaCount: conversations.filter(conversation => conversation.status !== 'resolved' && conversation.alertLevel === 'high').length,
      messageCount: conversations.reduce((sum, conversation) => sum + (conversation.messages?.length || 0), 0),
      regions,
    }].slice(-360));
  }, [conversations]);

  const updateConversation = (id, data) => {
    setConversations(prev =>
      prev.map(conv => (String(conv.id || conv._id) === String(id) ? { ...conv, ...data } : conv))
    );
  };

  const updateAgent = (id, data) => {
    setAgents(prev =>
      prev.map(agent => (agent.id === id ? { ...agent, ...data } : agent))
    );
  };

  const interveneInConversation = async (conversationId) => {
    await requestIntervention(conversationId, 'supervisor');
    updateConversation(conversationId, { status: 'escalated' });
  };

  return (
    <AppDataContext.Provider
      value={{
        conversations,
        dashboardHistory,
        agents,
        knowledgeBases,
        loading,
        error,
        updateConversation,
        updateAgent,
        interveneInConversation,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};
