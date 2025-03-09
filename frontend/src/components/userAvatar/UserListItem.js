import { Avatar } from "@chakra-ui/react";
import { Box, Text } from "@chakra-ui/layout";

const UserListItem = ({ user, handleFunction, isSelected }) => {
  return (
    <Box
      onClick={handleFunction}
      cursor="pointer"
      bg={isSelected ? "#38B2AC" : "#E8E8E8"}
      _hover={{
        background: "#38B2AC",
        color: "white",
      }}
      w="100%"
      display="flex"
      alignItems="center"
      color="black"
      px={3}
      py={2}
      mb={2}
      borderRadius="lg"
    >
      <Avatar
        mr={2}
        size="sm"
        cursor="pointer"
        name={user.name}
        src={user.pic}
      />
      <Box>
        <Text>{user.name}</Text>
        <Text fontSize="xs">
          <b>Kullanıcı Adı: </b>
          {user.userName}
        </Text>
      </Box>
    </Box>
  );
};

export default UserListItem;
