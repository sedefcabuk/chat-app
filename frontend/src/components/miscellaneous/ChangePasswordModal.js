import { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  InputGroup,
  InputRightElement,
  FormControl,
  FormLabel,
  Text,
  useDisclosure,
  MenuItem,
} from "@chakra-ui/react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";

const ChangePasswordModal = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setIsDisabled(
      !oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()
    );
  }, [oldPassword, newPassword, confirmPassword]);

  useEffect(() => {
    setMessage("");
  }, [isOpen]);

  const handleClose = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
    setMessageType("error");
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleChangePassword();
    }
  };

  const handleChangePassword = async () => {
    setMessage("");
    setMessageType("error");

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setMessage("Fields cannot be empty!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.put(
        "/api/user/change-password",
        { oldPassword, newPassword },
        config
      );

      setMessage("Password changed successfully!");
      setMessageType("success");

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || "An error occurred!");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MenuItem onClick={onOpen}>Change Password</MenuItem>

      <Modal size="lg" onClose={handleClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="30px" textAlign="center">
            Change Password
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody display="flex" flexDir="column" alignItems="center">
            <FormControl mt={3}>
              <FormLabel>Old Password</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    onClick={() => setShowOld(!showOld)}
                  >
                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>New Password</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>Confirm New Password</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.75rem"
                    size="sm"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>

            {message && (
              <Text
                color={messageType === "error" ? "red.500" : "green.500"}
                mt={2}
              >
                {message}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleClose} mr={3}>
              Close
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleChangePassword}
              isLoading={loading}
              isDisabled={isDisabled}
            >
              Change Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ChangePasswordModal;
