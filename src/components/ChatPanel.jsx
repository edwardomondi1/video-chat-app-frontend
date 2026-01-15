<div className="w-full md:w-80 bg-white border-l flex flex-col h-full">
  <div className="p-4 font-semibold text-blue-600 border-b">Chat</div>

  {/* Messages */}
  <div className="flex-1 overflow-y-auto p-3 space-y-2">
    {messages.map((msg, i) => (
      <div key={i} className="text-sm">
        <span className="font-semibold text-blue-600">{msg.sender}:</span>{" "}
        {msg.text}
      </div>
    ))}
  </div>

  {/* Input */}
  <div className="p-3 border-t flex gap-2">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Type a message..."
      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    />
    <button
      onClick={sendMessage}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold"
    >
      Send
    </button>
  </div>
</div>
