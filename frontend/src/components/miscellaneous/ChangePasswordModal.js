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

  const validatePassword = (password) => {
    return (
      password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
    );
  };

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

    if (!validatePassword(newPassword)) {
      setMessage(
        "Şifreniz en az 8 karakter olmalı ve en az bir harf ve bir rakam içermelidir!"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Şifreler eşleşmiyor!");
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

      setMessage("Şifre başarıyla değiştirildi.");
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
      <MenuItem onClick={onOpen}>Şifreyi Değiştir</MenuItem>

      <Modal size="lg" onClose={handleClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="30px" textAlign="center">
            Şifreyi Değiştir
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody display="flex" flexDir="column" alignItems="center">
            <FormControl mt={3}>
              <FormLabel>Eski Şifre</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
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
              <FormLabel>Yeni Şifre</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
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
              <FormLabel>Yeni Şifre Tekrar</FormLabel>
              <InputGroup size="md">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
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
              Kapat
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleChangePassword}
              isLoading={loading}
              isDisabled={isDisabled}
            >
              Şifreyi Değiştir
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ChangePasswordModal;
