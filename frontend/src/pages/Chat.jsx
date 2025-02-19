// // src/pages/Chat.jsx
// import { useEffect, useState } from 'react';
// import { useDispatch, useSelector } from 'react-redux';
// import { fetchMessages, sendMessage, addMessage } from '../store/chatSlice';
// import useSocket from '../hooks/useSocket';
// import { useParams } from 'react-router-dom';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';

// const Chat = () => {
//   const dispatch = useDispatch();
//   const socket = useSocket();
//   const { userToChatId } = useParams(); // chat partner's ID passed in the URL (e.g., /chat/USER_ID)
//   const { messages, loading, error, sending } = useSelector((state) => state.chat);
//   const currentUserId = useSelector((state) => state.auth.user?.userId);
//   const [text, setText] = useState('');

//   // Fetch the conversation when the chat partner changes
//   useEffect(() => {
//     if (userToChatId && currentUserId) {
//       dispatch(fetchMessages({ userToChatId }));
//     }
//   }, [dispatch, userToChatId, currentUserId]);

//   // Socket: join a room and listen for new messages
//   useEffect(() => {
//     if (!currentUserId || !userToChatId) return;
//     // Create a consistent room id (order doesn't matter)
//     const roomId = [currentUserId, userToChatId].sort().join('_');
//     socket.emit('joinRoom', { roomId, userId: currentUserId, receiverId: userToChatId });

//     const handleNewMessage = (message) => {
//         console.log("Received newMessage event:", message); // DEBUG: log the message
//       // Only add the message if it belongs to this conversation.
//       if (
//         (message.senderId === currentUserId && message.receiverId === userToChatId) ||
//         (message.senderId === userToChatId && message.receiverId === currentUserId)
//       ) {
//         dispatch(addMessage(message));
//       }
//     };

//     socket.on('newMessage', handleNewMessage);

//     return () => {
//       socket.off('newMessage', handleNewMessage);
//     };
//   }, [dispatch, socket, currentUserId, userToChatId]);

//   const handleSend = async () => {
//     if (!text.trim()) return;
//     try {
//       await dispatch(sendMessage({ receiverId: userToChatId, text })).unwrap();
//       setText('');
//     } catch (err) {
//       console.error('Failed to send message:', err);
//     }
//   };

//   return (
//     <div className="p-4 max-w-3xl mx-auto">
//       <h2 className="text-xl font-bold mb-4">Chat</h2>
      
//       <div className="border p-4 h-96 overflow-y-auto">
//         {loading && <p>Loading messages...</p>}
//         {error && <p className="text-red-500">{error}</p>}
//         {messages.map((msg) => (
//           <div key={msg._id} className="mb-2">
//             <p className="text-sm">
//               <strong>{msg.senderId === currentUserId ? 'You' : 'Them'}:</strong> {msg.text}
//             </p>
//             {msg.image && (
//               <img
//                 src={msg.image}
//                 alt="attachment"
//                 className="max-w-xs mt-1"
//               />
//             )}
//           </div>
//         ))}
//       </div>

//       <div className="mt-4 flex">
//         <Input
//           type="text"
//           value={text}
//           onChange={(e) => setText(e.target.value)}
//           placeholder="Type your message..."
//           className="flex-1"
//         />
//         <Button onClick={handleSend} disabled={sending} className="ml-2">
//           {sending ? 'Sending...' : 'Send'}
//         </Button>
//       </div>
//     </div>
//   );
// };

// export default Chat;
