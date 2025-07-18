import { AddIcon } from "@chakra-ui/icons";
import {
  Box,
  Stack,
  Text,
  Button,
  Avatar,
  AvatarGroup,
} from "@chakra-ui/react";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSender } from "../config/ChatLogics";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import { decryptMessage } from "../utils";

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState(null);
  const { selectedChat, setSelectedChat, user, chats, setChats } = ChatState();
  const toast = useToast();

  const getReceiverIndex = (chat, userId, senderId) => {
    if (chat.isGroupChat) {
      const userIndex = chat.users.findIndex((u) => u._id === userId);
      return userIndex >= 0 ? userIndex : 0;
    }
    return senderId === userId ? 0 : 1;
  };

  const getChatAvatars = (chat) => {
    if (!chat.isGroupChat) {
      const otherUser = chat.users.find((u) => u._id !== loggedUser?._id);
      return [otherUser?.pic];
    } else {
      const filteredUsers = chat.users.filter((u) => u._id !== loggedUser?._id);
      return filteredUsers.slice(0, 3).map((u) => u.pic);
    }
  };

  const fetchChats = async () => {
    if (!user?.token) return;

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("/api/chat", config);

      const decryptedChats = await Promise.all(
        data.map(async (chat) => {
          if (chat.latestMessage) {
            let content = chat.latestMessage.content;

            if (Array.isArray(content)) {
              content = content[0] || "";
            }

            const receiverIndex = getReceiverIndex(
              chat,
              user._id,
              chat.latestMessage.sender._id
            );

            try {
              let payload;
              try {
                payload = JSON.parse(content);
              } catch {
                chat.latestMessage = null;
                return chat;
              }

              if (
                receiverIndex < 0 ||
                receiverIndex >= payload.encryptedAesKeys.length
              ) {
                chat.latestMessage = null;
                return chat;
              }

              const decrypted = await decryptMessage(content, receiverIndex);
              chat.latestMessage.content = decrypted;
            } catch {
              chat.latestMessage = null;
            }
          }
          return chat;
        })
      );

      setChats(decryptedChats);
    } catch (error) {
      toast({
        title: "Hata!",
        description: "Sohbetleri yüklerken bir hata oluştu.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("userInfo"));
    setLoggedUser(storedUser);
    if (!storedUser) return;

    if (!user) return;
    fetchChats();
  }, [fetchAgain, user]);

  return (
    <Box
      display={{ base: selectedChat ? "none" : "flex", md: "flex" }}
      flexDir="column"
      alignItems="center"
      p={3}
      bg="white"
      w={{ base: "100%", md: "31%" }}
      borderRadius="lg"
      borderWidth="2px"
      borderColor="blue.400"
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
        borderColor="blue.200"
      >
        {chats ? (
          <Stack overflowY="scroll">
            {chats.map((chat) => {
              const avatars = getChatAvatars(chat);

              return (
                <Box
                  onClick={() => setSelectedChat(chat)}
                  cursor="pointer"
                  bg={selectedChat === chat ? "blue.100" : "#E8E8E8"}
                  color="black"
                  px={3}
                  py={2}
                  borderRadius="lg"
                  key={chat._id}
                  display="flex"
                  alignItems="center"
                  gap={3}
                >
                  {chat.isGroupChat ? (
                    <AvatarGroup size="sm" max={2}>
                      {avatars.map((pic, i) => (
                        <Avatar key={i} src={pic} />
                      ))}
                    </AvatarGroup>
                  ) : (
                    <Avatar src={avatars[0]} size="sm" />
                  )}

                  <Box>
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
                        {chat.latestMessage.content.length > 50
                          ? chat.latestMessage.content.substring(0, 51) + "..."
                          : chat.latestMessage.content}
                      </Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <ChatLoading />
        )}
      </Box>
    </Box>
  );
};

export default MyChats;
