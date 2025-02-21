import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { 
  fetchUsers, 
  fetchMessages, 
  sendMessage, 
  deleteMessage,
  addMessage,
  setSelectedUser,
  markMessagesAsRead
} from "../store/chatSlice";
import { getSocket, initializeSocket } from "../utils/SocketManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// import LoadingSpinner from "@/components/LoadingSpinner";
import { format } from "date-fns";
import { Check, CheckCheck, Trash2, MoreVertical, Loader2 } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";

const Chat = () => {
  const { userToChatId } = useParams(); 
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [messageText, setMessageText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const { user: currentUser } = useSelector((state) => state.auth);
  const { users, messages, selectedUser, error, sending } = useSelector((state) => state.chat);
  const { onlineUsers } = useSelector((state) => state.auth);

  useEffect(() => {
    if (currentUser && currentUser._id) {
      initializeSocket(currentUser._id);
    }
  }, [currentUser]);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    const loadSelectedUser = async () => {
      if (userToChatId) {
        dispatch(fetchMessages({ userToChatId }));
        const foundUser = users.find(u => u._id === userToChatId);
        if (foundUser) {
          dispatch(setSelectedUser(foundUser));
        } else {
          try {
            const response = await axiosInstance.get(`/user/${userToChatId}`);
            dispatch(setSelectedUser(response.data));
          } catch (err) {
            console.error("Error fetching user:", err);
          }
        }
      } else {
        // Reset selectedUser when navigating to /chat without a userToChatId
        dispatch(setSelectedUser(null));
      }
    };
    loadSelectedUser();
  }, [dispatch, userToChatId, users, error]);

  useEffect(() => {
    if (userToChatId && messages.some(m => m.senderId === userToChatId && !m.read)) {
      dispatch(markMessagesAsRead({ senderId: userToChatId }));
    }
  }, [dispatch, userToChatId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      if (
        (newMessage.senderId === userToChatId && newMessage.receiverId === currentUser._id) ||
        (newMessage.senderId === currentUser._id && newMessage.receiverId === userToChatId)
      ) {
        dispatch(addMessage(newMessage));
        if (newMessage.senderId === userToChatId && !newMessage.read) {
          dispatch(markMessagesAsRead({ senderId: userToChatId }));
        }
      }
      dispatch(fetchUsers());
    };

    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [dispatch, userToChatId, currentUser]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() && !selectedImage) return;

    try {
      await dispatch(sendMessage({
        receiverId: userToChatId,
        text: messageText,
        image: selectedImage
      })).unwrap();
      setMessageText("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      dispatch(fetchUsers());
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleUserClick = (user) => {
    dispatch(setSelectedUser(user));
    navigate(`/chat/${user._id}`);
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await dispatch(deleteMessage(messageId)).unwrap();
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const isUserOnline = (userId) => onlineUsers.includes(userId);

  const renderMessageStatus = (message) => {
    if (message.senderId !== currentUser._id) return null;
    return message.read ? (
      <CheckCheck className="h-4 w-4 text-blue-500" />
    ) : (
      <Check className="h-4 w-4 text-gray-500" />
    );
  };

  const getUnreadCount = (userId) => {
    return messages.filter(m => 
      m.senderId === userId && 
      m.receiverId === currentUser._id && 
      !m.read
    ).length;
  };

  return (
    <div className="flex h-[calc(100vh-160px)] border rounded-lg overflow-hidden mt-5">
      {/* Sidebar */}
      <div className="w-1/4 border-r">
        <ScrollArea className="h-full p-2">
          <h2 className="text-lg font-semibold p-2 mb-2">Chats</h2>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground">No conversations yet</p>
          ) : (
            users.map((user) => {
              const unreadCount = getUnreadCount(user._id);
              const online = isUserOnline(user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => handleUserClick(user)}
                  className={`flex items-center p-3 cursor-pointer shadow-md rounded-sm mb-3 border relative ${
                    selectedUser && selectedUser._id === user._id ? "bg-accent" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-14 w-14 mr-3 border-2 dark:border-gray-600">
                      <AvatarImage src={user.profile?.profilePicture} />
                      <AvatarFallback className="uppercase">
                        {user.profile?.firstName?.[0]}{user.profile?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute bottom-1 right-3 h-3 w-3 rounded-full ${
                      online ? 'bg-green-500' : 'bg-gray-400'
                    }`}></span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">
                      {user.profile?.firstName} {user.profile?.lastName}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                      {unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center">
              <div className="relative">
                <Avatar className="h-14 w-14 mr-3 border-2 dark:border-gray-600">
                  <AvatarImage src={selectedUser.profile?.profilePicture} />
                  <AvatarFallback className="uppercase">
                    {selectedUser.profile?.firstName?.[0]}{selectedUser.profile?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute bottom-1 right-3 h-3 w-3 rounded-full ${
                  isUserOnline(selectedUser._id) ? 'bg-green-500' : 'bg-gray-400'
                }`}></span>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold capitalize">
                  {selectedUser.profile?.firstName} {selectedUser.profile?.lastName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isUserOnline(selectedUser._id) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No messages yet, start the conversation</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.senderId === currentUser._id ? "justify-end" : "justify-start"} mb-4`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.senderId === currentUser._id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.senderId === currentUser._id && (
                        <div className="flex justify-end mb-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDeleteMessage(message._id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {message.image && (
                        <img
                          src={message.image}
                          alt="attachment"
                          className="max-w-[300px] mb-2 rounded"
                        />
                      )}
                      <p className="break-words">{message.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-xs opacity-70">
                          {format(new Date(message.createdAt), "HH:mm")}
                        </p>
                        {renderMessageStatus(message)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                  id="file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("file-input").click()}
                >
                  📎
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Sending...
                    </>
                  ) : (
                    "Send"
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            {users.length === 0 ? (
              <p className="text-muted-foreground">No conversations yet, start a conversation with someone</p>
            ) : (
              <p className="text-muted-foreground">Select a user from the sidebar to start chatting</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;