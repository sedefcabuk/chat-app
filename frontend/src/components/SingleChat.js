import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text, HStack } from "@chakra-ui/layout";
import { IconButton, Spinner, useToast } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const toast = useToast();

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

      setLoading(true);

      const { data } = await axios.get(
        `/api/message/${selectedChat._id}?page=1&limit=20`,
        config
      );

      // Mesajları paralel olarak gönder
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

      console.log(
        "Mesaj sırası:",
        decryptedMessages.map((m) => ({ id: m._id, createdAt: m.createdAt }))
      );
      setMessages(decryptedMessages);
      setLoading(false);

      socket.emit("join chat", selectedChat._id);
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

      // Alıcıların açık anahtarlarını topla
      const publicKeys = getValidPublicKeys(selectedChat, user);
      if (publicKeys.length === 0) {
        throw new Error("Hiçbir alıcı için geçerli açık anahtar bulunamadı.");
      }

      setLoading(true); // Şifreleme için yükleme göstergesi
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

      // Gönderenin kendi mesajını çöz
      data.content = await decryptMessage(data.content, 0);
      setMessages([...messages, data]);
      socket.emit("new message", data);
    } catch (error) {
      let errorMessage = "Mesaj gönderilemedi.";
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
      setLoading(false);
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
    fetchMessages();
    selectedChatCompare = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    const handleMessageReceived = async (newMessageReceived) => {
      console.log("Socket mesajı:", newMessageReceived);
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
        try {
          let payload;
          let content = newMessageReceived.content;
          // content'in string olduğundan emin ol
          if (typeof content !== "string") {
            console.error("Geçersiz content türü:", typeof content, content);
            content = JSON.stringify(content); // Obje veya dizi ise string'e çevir
          }
          try {
            payload = JSON.parse(content);
          } catch {
            console.error("JSON parse hatası:", content);
            newMessageReceived.content = "[Mesaj çözülemedi: Geçersiz format]";
            setMessages([...messages, newMessageReceived]);
            return;
          }
          if (
            receiverIndex < 0 ||
            receiverIndex >= payload.encryptedAesKeys.length
          ) {
            console.error(
              "Geçersiz receiverIndex:",
              receiverIndex,
              payload.encryptedAesKeys
            );
            newMessageReceived.content =
              "[Mesaj çözülemedi: Geçersiz alıcı indeksi]";
            setMessages([...messages, newMessageReceived]);
            return;
          }
          newMessageReceived.content = await decryptMessage(
            content,
            receiverIndex
          );
        } catch (error) {
          console.error("Mesaj çözme hatası:", error);
          newMessageReceived.content =
            "[Mesaj çözülemedi: Anahtar uyumsuzluğu]";
        }
        setMessages([...messages, newMessageReceived]);
      }
    };

    socket.on("message received", handleMessageReceived);

    return () => {
      socket.off("message received", handleMessageReceived);
    };
  }, [fetchAgain, notification, selectedChat, user, messages]);

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
            justifyContent="flex-start"
            alignItems="center"
            gap={2}
          >
            <IconButton
              display={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
              mr={2}
            />
            {!selectedChat.isGroupChat ? (
              <HStack spacing={2}>
                <Text>{getSender(user, selectedChat.users)}</Text>
                <ProfileModal user={getSenderFull(user, selectedChat.users)} />
              </HStack>
            ) : (
              <HStack spacing={2}>
                <Text>{selectedChat.chatName.toUpperCase()}</Text>
                <UpdateGroupChatModal
                  fetchMessages={fetchMessages}
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                />
              </HStack>
            )}
          </Text>

          <Box
            display="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#F3F7FFFF"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden"
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
                  isLoading={loading}
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
            Uçtan uca şifrelenmiş
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
