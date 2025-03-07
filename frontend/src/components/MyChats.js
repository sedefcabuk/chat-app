import { AddIcon } from "@chakra-ui/icons";
import { Box, Stack, Text, Button } from "@chakra-ui/react";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSender } from "../config/ChatLogics";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.REACT_APP_SECRET_KEY;

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState(null);
  const { selectedChat, setSelectedChat, user, chats, setChats } = ChatState();
  const toast = useToast();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("userInfo"));
    setLoggedUser(storedUser);

    if (!storedUser) {
      toast({
        title: "Hata!",
        description: "Kullanıcı bilgileri bulunamadı.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
      return;
    }

    if (!user) {
      console.log("User state güncellenmedi, bekleniyor...");
      return;
    }

    fetchChats();
  }, [fetchAgain, user]);

  const fetchChats = async () => {
    console.log("fetchChats çağrıldı...");
    if (!user?.token) {
      console.log("Token bulunamadı, chatler yüklenmedi.");
      return;
    }

    try {
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.get("/api/chat", config);
      console.log("Sohbetler başarıyla çekildi:", data);
      setChats(data);
    } catch (error) {
      console.error("Chatleri çekerken hata oluştu:", error);
      toast({
        title: "Hata!",
        description: "Sohbetleri yüklerken hata oluştu.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  const decryptMessage = (ciphertext) => {
    try {
      if (!ciphertext || typeof ciphertext !== "string") return ciphertext;
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      return decryptedText || ciphertext;
    } catch (error) {
      console.error("Şifre çözme hatası:", error);
      return ciphertext;
    }
  };

  return (
    <Box
      display={{ base: selectedChat ? "none" : "flex", md: "flex" }}
      flexDir="column"
      alignItems="center"
      p={3}
      bg="white"
      w={{ base: "100%", md: "31%" }}
      borderRadius="lg"
      borderWidth="1px"
    >
      <Box
        pb={3}
        px={3}
        fontSize={{ base: "28px", md: "30px" }}
        fontFamily="Work sans"
        display="flex"
        w="100%"
        justifyContent="space-between"
        alignItems="center"
      >
        Sohbetler
        <GroupChatModal>
          <Button
            display="flex"
            fontSize={{ base: "17px", md: "10px", lg: "17px" }}
            rightIcon={<AddIcon />}
          >
            Yeni Grup
          </Button>
        </GroupChatModal>
      </Box>
      <Box
        display="flex"
        flexDir="column"
        p={3}
        bg="#F8F8F8"
        w="100%"
        h="100%"
        borderRadius="lg"
        overflowY="hidden"
      >
        {chats ? (
          <Stack overflowY="scroll">
            {chats.map((chat) => (
              <Box
                onClick={() => setSelectedChat(chat)}
                cursor="pointer"
                bg={selectedChat === chat ? "#38B2AC" : "#E8E8E8"}
                color={selectedChat === chat ? "white" : "black"}
                px={3}
                py={2}
                borderRadius="lg"
                key={chat._id}
              >
                <Text>
                  {!chat.isGroupChat
                    ? getSender(loggedUser, chat.users)
                    : chat.chatName}
                </Text>
                {chat.latestMessage && (
                  <Text fontSize="xs">
                    <b>
                      {chat.latestMessage.sender.name === loggedUser?.name
                        ? "Siz"
                        : chat.latestMessage.sender.name}
                      :
                    </b>{" "}
                    {decryptMessage(chat.latestMessage.content).length > 50
                      ? decryptMessage(chat.latestMessage.content).substring(
                          0,
                          51
                        ) + "..."
                      : decryptMessage(chat.latestMessage.content)}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <ChatLoading />
        )}
      </Box>
    </Box>
  );
};

export default MyChats;
