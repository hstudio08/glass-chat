import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Send, LogOut } from 'lucide-react';
import { db } from '../services/firebase';
import Login from './Login';

export default function UserChat() {
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    const text = newMessage;
    setNewMessage(""); 

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text,
        sender: "user", 
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // If not logged in, show the Login component
  if (!chatId) {
    return <Login onLogin={setChatId} />;
  }

  // If logged in, show the Chat UI
  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <div className="glass-panel flex flex-col w-full max-w-4xl h-[90vh] overflow-hidden relative">
        
        {/* Header */}
        <div className="h-16 border-b border-glassBorder bg-white/30 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            <h3 className="font-bold text-gray-800">Support Secure Chat</h3>
          </div>
          <button 
            onClick={() => setChatId(null)}
            className="text-gray-600 hover:text-red-500 transition-colors bg-white/40 p-2 rounded-full backdrop-blur-sm"
            title="Disconnect"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 mt-10">Start the conversation...</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`glass-panel px-5 py-3 max-w-[75%] shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-blue-500/20 border-blue-200/30 text-gray-800 rounded-br-none' 
                    : 'bg-white/60 border-white/40 text-gray-800 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-glassBorder bg-white/20 backdrop-blur-xl z-10">
          <form onSubmit={handleSend} className="flex gap-3">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..." 
              className="flex-1 bg-white/50 border border-glassBorder rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-md transition-all text-gray-800 placeholder-gray-500 shadow-inner"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-blue-500/80 hover:bg-blue-600/80 text-white disabled:opacity-50 disabled:bg-gray-400/50 p-3 rounded-full backdrop-blur-md transition-all flex items-center justify-center shadow-md"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}