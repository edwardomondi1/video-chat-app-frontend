import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ messages = [], onSendMessage }) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !onSendMessage) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 border-l border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gray-750">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs text-white">💬</span>
          </div>
          Chat
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-850">
        {messages.map((msg, i) => {
          const isYou = msg.sender === "You";
          const isSystem = msg.sender === "System";
          
          if (isSystem) {
            return (
              <div key={i} className="text-center py-1">
                <div className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs inline-block">
                  {msg.text}
                </div>
              </div>
            );
          }
          
          return (
            <div key={i} className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%]">
                {!isYou && (
                  <div className="text-xs text-gray-400 mb-1 px-1 font-medium">
                    {msg.sender}
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-lg text-xs shadow-sm ${
                    isYou
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-700 text-white rounded-bl-sm border border-gray-600"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef}></div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700 bg-gray-750">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-white placeholder-gray-400 text-xs"
          />
          <button
            onClick={handleSend}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-xs flex items-center gap-1"
          >
            <span>Send</span>
            <span className="text-xs">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}