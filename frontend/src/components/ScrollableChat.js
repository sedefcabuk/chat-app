import { Avatar } from "@chakra-ui/avatar";
import { Tooltip } from "@chakra-ui/tooltip";
import ScrollableFeed from "react-scrollable-feed";
import {
  isLastMessage,
  isSameSender,
  isSameSenderMargin,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";

// Sabit renk havuzu (sıraya göre atanacak)
const userColors = [
  "#E53E3E", // kırmızı
  "#3182CE", // mavi
  "#38A169", // yeşil
  "#D69E2E", // sarı
  "#805AD5", // mor
  "#DD6B20", // turuncu
  "#319795", // teal
  "#718096", // gri
];

// Her kullanıcıya sabit bir renk atamak için
const generateColorMap = (messages) => {
  const userIdSet = new Set();
  messages.forEach((msg) => userIdSet.add(msg.sender._id));
  const userIds = Array.from(userIdSet);

  const colorMap = {};
  userIds.forEach((id, index) => {
    colorMap[id] = userColors[index % userColors.length];
  });

  return colorMap;
};

const ScrollableChat = ({ messages }) => {
  const { user, selectedChat } = ChatState();

  const colorMap = generateColorMap(messages);

  return (
    <ScrollableFeed>
      {messages &&
        messages.map((m, i) => {
          const messageTime = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const isUserMessage = m.sender._id === user._id;
          const showSenderName =
            selectedChat.isGroupChat &&
            (isSameSender(messages, m, i, user._id) ||
              isLastMessage(messages, i, user._id));

          return (
            <div
              key={m._id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUserMessage ? "flex-end" : "flex-start",
                padding: "5px 10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isUserMessage ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                {!isUserMessage &&
                  (isSameSender(messages, m, i, user._id) ||
                    isLastMessage(messages, i, user._id)) && (
                    <Tooltip
                      label={m.sender.name}
                      placement="bottom-start"
                      hasArrow
                    >
                      <Avatar
                        mt="7px"
                        mr={1}
                        size="sm"
                        cursor="pointer"
                        name={m.sender.name}
                        src={m.sender.pic}
                      />
                    </Tooltip>
                  )}

                <div
                  style={{
                    backgroundColor: isUserMessage ? "#BEE3F8" : "#B9F5D0",
                    marginLeft: isSameSenderMargin(messages, m, i, user._id),
                    marginTop: isSameUser(messages, m, i, user._id) ? 3 : 10,
                    borderRadius: "12px",
                    padding: "10px 15px",
                    maxWidth: "75%",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    wordBreak: "break-word",
                  }}
                >
                  {showSenderName && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "3px",
                        color: colorMap[m.sender._id],
                      }}
                    >
                      {m.sender.name}
                    </span>
                  )}

                  <span>{m.content}</span>

                  <span
                    style={{
                      position: "absolute",
                      bottom: "2px",
                      right: "5px",
                      fontSize: "10px",
                      color: "gray",
                    }}
                  >
                    {messageTime}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
    </ScrollableFeed>
  );
};

export default ScrollableChat;
