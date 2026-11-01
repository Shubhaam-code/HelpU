import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MoreVertical, Paperclip, Send, ArrowLeft, Search } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { Avatar } from '../components/ui/Avatar';
import { ChatBubble } from '../components/ui/ChatBubble';

const MOCK_CONVERSATIONS = [
  { id: '1', name: 'Aman Verma', avatarId: 'm1', lastMsg: "Yes! I'll be at the main gate by 7:50 AM. 👍", time: '7:25 PM', unread: 0, online: true },
  { id: '2', name: 'Priya Singh', avatarId: 'f1', lastMsg: "See you at the Bhopal railway station exit 2!", time: '5:40 PM', unread: 2, online: true },
  { id: '3', name: 'Karan Raj', avatarId: 'm4', lastMsg: "Is the seat still available for tomorrow?", time: 'Yesterday', unread: 0, online: false },
  { id: '4', name: 'Neha Gupta', avatarId: 'f3', lastMsg: "Thanks for the ride today!", time: '2 days ago', unread: 0, online: false },
];

const INITIAL_MESSAGES = {
  '1': [
    { id: 1, text: 'Hey! Going to Bhopal tomorrow? 8:00 AM, right?', isMe: false, time: '7:24 PM' },
    { id: 2, text: "Yes! I'll be at the main gate by 7:50 AM. 👍", isMe: true, time: '7:25 PM' },
    { id: 3, type: 'location', title: 'VIT Main Gate', subtitle: 'Open in Maps', isMe: false, time: '7:26 PM' },
  ],
  '2': [
    { id: 1, text: 'Hi Priya, we matched for the Bhopal trip this Sunday.', isMe: true, time: '5:30 PM' },
    { id: 2, text: "Hey! That's awesome, I'm taking my i20. There are 2 spots open.", isMe: false, time: '5:35 PM' },
    { id: 3, text: 'See you at the Bhopal railway station exit 2!', isMe: false, time: '5:40 PM' },
  ]
};

export default function ChatConversationPage() {
  const { id = '1' } = useParams();
  const navigate = useNavigate();
  
  const [activeChatId, setActiveChatId] = useState(id);
  const [messages, setMessages] = useState(INITIAL_MESSAGES[id] || INITIAL_MESSAGES['1']);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    setActiveChatId(id);
    setMessages(INITIAL_MESSAGES[id] || INITIAL_MESSAGES['1']);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activePeer = MOCK_CONVERSATIONS.find(c => c.id === activeChatId) || MOCK_CONVERSATIONS[0];

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { 
        id: Date.now(), 
        text: input, 
        isMe: true, 
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
      },
    ]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <ResponsiveShell>
      <div className="px-0 sm:px-6 lg:px-8 py-0 sm:py-6 h-[calc(100vh-65px)] max-h-[850px] flex">
        
        {/* Container */}
        <div className="w-full h-full bg-white sm:rounded-3xl shadow-sm sm:border border-gray-100 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Panel: Conversations List (Hidden on mobile if in active chat) */}
          <div className="hidden md:flex flex-col w-80 lg:w-96 border-r border-gray-100 bg-cream/30">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-black text-navy text-xl">Messages</h2>
              <div className="relative mt-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search co-travellers..."
                  className="w-full bg-white rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-navy placeholder:text-text-secondary border border-gray-100 shadow-2xs focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 p-2 space-y-1">
              {MOCK_CONVERSATIONS.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveChatId(c.id);
                    navigate(`/chat/${c.id}`);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                    activeChatId === c.id ? 'bg-peach/60 shadow-xs' : 'hover:bg-white/80'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar avatarId={c.avatarId} size="md" />
                    {c.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-navy text-sm truncate">{c.name}</span>
                      <span className="text-[10px] text-text-secondary">{c.time}</span>
                    </div>
                    <p className="text-xs text-text-secondary truncate mt-0.5">{c.lastMsg}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-coral text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Conversation View */}
          <div className="flex-1 flex flex-col h-full bg-cream/10">
            {/* Conversation Header */}
            <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-gray-100 z-10 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/home')} 
                  className="md:hidden p-1 -ml-1 text-navy hover:bg-cream rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar avatarId={activePeer.avatarId} size="sm" />
                <div>
                  <div className="font-extrabold text-navy text-sm">{activePeer.name}</div>
                  <div className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span>{activePeer.online ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => alert(`Calling ${activePeer.name}...`)}
                  className="p-2 text-navy hover:bg-cream rounded-xl transition-colors cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2 text-navy hover:bg-cream rounded-xl transition-colors cursor-pointer">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <ChatBubble
                      message={msg.type === 'location' ? msg : msg.text}
                      isMe={msg.isMe}
                      timestamp={msg.time}
                      type={msg.type}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3.5 bg-white border-t border-gray-100">
              <button 
                onClick={() => alert('Attachment modal')}
                className="text-text-secondary hover:text-navy transition cursor-pointer p-1"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-cream/50 rounded-2xl px-4 py-2.5 text-sm text-navy outline-none placeholder:text-text-secondary border border-gray-100 focus:bg-white focus:border-coral/40 transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={sendMessage}
                className="w-10 h-10 bg-navy hover:bg-navy/90 rounded-full flex items-center justify-center shadow-sm shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 text-white" />
              </motion.button>
            </div>

          </div>

        </div>

      </div>
    </ResponsiveShell>
  );
}
