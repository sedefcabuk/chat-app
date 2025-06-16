import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text, HStack } from "@chakra-ui/layout";
import { IconButton, Spinner, useToast } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { ArrowBackIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";
import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import { MdSend } from "react-icons/md";
import { encryptMessage, decryptMessage } from "../utils";

const ENDPOINT =
  process.env.NODE_ENV === "production"
    ? "https://chatterly-lrhs.onrender.com"
    : "http://localhost:5000";

let socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false); // loading state'i geri eklendi
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const toast = useToast();
  const messagesEndRef = useRef(null); // Mesajların sonuna kaydırmak için ref

  const { selectedChat, setSelectedChat, user, notification, setNotification } =
    ChatState();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  // Mesajların sonuna kaydırma fonksiyonu
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getReceiverIndex = (chat, userId, senderId) => {
    if (chat.isGroupChat) {
      const userIndex = chat.users.findIndex((u) => u._id === userId);
      return userIndex >= 0 ? userIndex : 0;
    }
    return senderId === userId ? 0 : 1;
  };

  const getValidPublicKeys = (chat, user) => {
    const keys = chat.isGroupChat
      ? chat.users.map((u) => u.publicKey)
      : [user.publicKey, chat.users.find((u) => u._id !== user._id)?.publicKey];
    return keys.filter((key) => {
      try {
        const parsed = JSON.parse(key);
        return parsed.kty === "RSA" && parsed.n && parsed.e;
      } catch {
        return false;
      }
    });
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        withCredentials: true,
      };
      setMessages([]);

      //setLoading(true); // Yükleme başlıyor

      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );

      const decryptedMessages = await Promise.all(
        data.map(async (message) => {
          const receiverIndex = getReceiverIndex(
            selectedChat,
            user._id,
            message.sender._id
          );
          try {
            let payload;
            try {
              payload = JSON.parse(message.content);
            } catch {
              message.content = "[Mesaj çözülemedi: Geçersiz format]";
              return message;
            }
            if (
              receiverIndex < 0 ||
              receiverIndex >= payload.encryptedAesKeys.length
            ) {
              message.content = "[Mesaj çözülemedi: Geçersiz alıcı indeksi]";
              return message;
            }
            message.content = await decryptMessage(
              message.content,
              receiverIndex
            );
          } catch (error) {
            console.error("Mesaj çözme hatası:", error);
            message.content = "[Mesaj çözülemedi: Anahtar uyumsuzluğu]";
          }
          return message;
        })
      );
      setMessages(decryptedMessages);
      //setLoading(false); // Yükleme bitti
      socket.emit("join chat", selectedChat._id);
      scrollToBottom(); // Mesajlar yüklendiğinde en alta kaydır
    } catch (error) {
      toast({
        title: "Hata!",
        description:
          "Mesajlar yüklenemedi: " + (error.message || "Bilinmeyen hata"),
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      //setLoading(false); // Hata durumunda yükleme bitti
    }
  };

  const sendMessage = async () => {
    if (!newMessage || !selectedChat) return;

    socket.emit("stop typing", selectedChat._id);

    try {
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        withCredentials: true,
      };

      const publicKeys = getValidPublicKeys(selectedChat, user);
      if (publicKeys.length === 0) {
        throw new Error("Hiçbir alıcı için geçerli açık anahtar bulunamadı.");
      }

      //setLoading(true); // Yükleme başlıyor
      const content = await encryptMessage(newMessage, publicKeys);
      setNewMessage("");

      const { data } = await axios.post(
        "/api/message",
        {
          content,
          chatId: selectedChat._id,
        },
        config
      );
      console.log("Backend yanıtı:", { status: data.status, data });

      const receiverIndex = getReceiverIndex(
        selectedChat,
        user._id,
        data.sender._id
      );
      data.content = await decryptMessage(data.content, receiverIndex);

      setMessages((prevMessages) => {
        if (!prevMessages.some((msg) => msg._id === data._id)) {
          return [...prevMessages, data];
        }
        return prevMessages;
      });

      socket.emit("new message", data);
      scrollToBottom(); // Yeni mesaj gönderildiğinde en alta kaydır
    } catch (error) {
      let errorMessage = "Mesaj gönderilemedi: Bilinmeyen hata";
      if (error.response?.status === 403) {
        errorMessage =
          "Bu grupta artık üye olmadığınız için mesaj gönderemezsiniz.";
      } else if (error.message.includes("anahtar")) {
        errorMessage = "Alıcıların anahtarları geçersiz, mesaj gönderilemedi.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        description: errorMessage,
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    } finally {
      setLoading(false); // Yükleme bitti
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }

    const lastTypingTime = new Date().getTime();
    const timerLength = 3000;
    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  useEffect(() => {
    socket = io(ENDPOINT);
    socket.emit("setup", user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages();
      selectedChatCompare = selectedChat;
    }
  }, [selectedChat?._id]);

  useEffect(() => {
    const handleMessageReceived = async (newMessageReceived) => {
      if (
        !selectedChatCompare ||
        selectedChatCompare._id !== newMessageReceived.chat._id
      ) {
        const alreadyExists = notification.some(
          (n) => n._id === newMessageReceived._id
        );
        if (!alreadyExists) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        const receiverIndex = getReceiverIndex(
          selectedChat,
          user._id,
          newMessageReceived.sender._id
        );
        let content = newMessageReceived.content;
        try {
          if (typeof content !== "string") {
            content = JSON.stringify(content);
          }
          if (!content.startsWith("{")) {
            newMessageReceived.content = content;
            setMessages((prev) => {
              if (!prev.some((msg) => msg._id === newMessageReceived._id)) {
                return [...prev, newMessageReceived];
              }
              return prev;
            });
            scrollToBottom(); // Yeni mesaj alındığında en alta kaydır
            return;
          }
          let payload;
          try {
            payload = JSON.parse(content);
          } catch {
            newMessageReceived.content = "[Mesaj çözülemedi: Geçersiz format]";
            setMessages((prev) => {
              if (!prev.some((msg) => msg._id === newMessageReceived._id)) {
                return [...prev, newMessageReceived];
              }
              return prev;
            });
            scrollToBottom(); // Yeni mesaj alındığında en alta kaydır
            return;
          }
          if (
            receiverIndex < 0 ||
            receiverIndex >= payload.encryptedAesKeys.length
          ) {
            newMessageReceived.content =
              "[Mesaj çözülemedi: Geçersiz alıcı indeksi]";
            setMessages((prev) => {
              if (!prev.some((msg) => msg._id === newMessageReceived._id)) {
                return [...prev, newMessageReceived];
              }
              return prev;
            });
            scrollToBottom(); // Yeni mesaj alındığında en alta kaydır
            return;
          }
          newMessageReceived.content = await decryptMessage(
            newMessageReceived.content,
            receiverIndex
          );
          setMessages((prev) => {
            if (!prev.some((msg) => msg._id === newMessageReceived._id)) {
              return [...prev, newMessageReceived];
            }
            return prev;
          });
          scrollToBottom(); // Yeni mesaj alındığında en alta kaydır
        } catch (error) {
          newMessageReceived.content =
            "[Mesaj çözülemedi: Anahtar uyumsuzluğu]";
          setMessages((prev) => {
            if (!prev.some((msg) => msg._id === newMessageReceived._id)) {
              return [...prev, newMessageReceived];
            }
            return prev;
          });
          scrollToBottom(); // Yeni mesaj alındığında en alta kaydır
          console.error("Mesaj çözme hatası:", error);
        }
      }
    };

    socket.on("message received", handleMessageReceived);
    return () => socket.off("message received", handleMessageReceived);
  }, [messages, notification]);

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Work sans"
            display="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
          >
            <IconButton
              display={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat(null)}
            />
            {!selectedChat.isGroupChat ? (
              <>
                {getSender(user, selectedChat.users)}
                <ProfileModal user={getSenderFull(user, selectedChat.users)} />
              </>
            ) : (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal
                  fetchMessages={fetchMessages}
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                />
              </>
            )}
          </Text>
          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#F3F7FFFF" // Eski kodun arka plan rengi
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden" // Eski kodun overflow ayarı
          >
            {loading ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <div className="messages">
                <ScrollableChat messages={messages} />
                <div ref={messagesEndRef} /> {/* Mesajların sonuna referans */}
              </div>
            )}
            <FormControl id="first-name" isRequired mt={3}>
              {isTyping ? (
                <div>
                  <Lottie
                    options={defaultOptions}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              ) : (
                <></>
              )}
              <HStack>
                <Input
                  variant="filled"
                  bg="#E0E0E0"
                  placeholder="Bir mesaj yazın"
                  value={newMessage}
                  onChange={typingHandler}
                  onKeyDown={handleKeyPress}
                  autoComplete="off"
                />
                <IconButton
                  icon={<MdSend />}
                  onClick={sendMessage}
                  colorScheme="blue"
                  aria-label="Send Message"
                />
              </HStack>
            </FormControl>
          </Box>
        </>
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          h="100%"
        >
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Uçtan Uca Şifrelenmiş
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
