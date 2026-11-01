import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MoreVertical, Paperclip, Send, ArrowLeft } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { ChatBubble } from '../components/ui/ChatBubble';

const MOCK_MESSAGES = [
  { id: 1, text: 'Hey! Going to Bhopal tomorrow? 8:00 AM, right?', isMe: false, time: '7:24 PM' },
  { id: 2, text: "Yes! I'll be at the main gate by 7:50 AM. 👍", isMe: true, time: '7:25 PM' },
  { id: 3, type: 'location', title: 'VIT Main Gate', subtitle: 'Open in Maps', isMe: false, time: '7:26 PM' },
];

export default function ChatConversationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: input, isMe: true, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) },
    ]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Mock peer based on id
  const peer = {
    name: 'Aman Verma',
    avatarId: 'm1',
    online: true,
  };

  return (
    <div className="h-dvh bg-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-gray-100 shadow-sm z-10 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-gray-100 rounded-xl">
          <ArrowLeft className="w-5 h-5 text-navy" />
        </button>
        <Avatar avatarId={peer.avatarId} size="sm" />
        <div className="flex-1">
          <div className="font-bold text-navy text-sm">{peer.name}</div>
          <div className="text-xs text-green-500 font-medium">{peer.online ? '● Online' : 'Offline'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-xl">
            <Phone className="w-4 h-4 text-navy" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-xl">
            <MoreVertical className="w-4 h-4 text-navy" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
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

      {/* Input bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 bg-white border-t border-gray-100">
        <button className="text-text-secondary hover:text-navy transition">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-sm text-navy outline-none placeholder:text-text-secondary focus:bg-gray-100 transition"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={sendMessage}
          className="w-10 h-10 bg-navy rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
        >
          <Send className="w-4 h-4 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
