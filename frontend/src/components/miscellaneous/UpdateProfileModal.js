import { useState, useEffect } from "react";
import { MenuItem } from "@chakra-ui/react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  Image,
  Input,
  FormControl,
  FormLabel,
  Text,
} from "@chakra-ui/react";
import axios from "axios";

const UpdateProfileModal = ({ setUser }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const getStoredUser = () => {
    return JSON.parse(localStorage.getItem("userInfo")) || null;
  };

  const [user, setUserState] = useState(getStoredUser());
  const [name, setName] = useState(user?.name || "");
  const [userName, setUserName] = useState(user?.userName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [pic, setPic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isDisabled, setIsDisabled] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  useEffect(() => {
    const isNameChanged = name.trim() !== user?.name?.trim();
    const isUserNameChanged = userName.trim() !== user?.userName?.trim();
    const isEmailChanged = email.trim() !== user?.email?.trim();
    const isPicChanged = pic !== null;

    if (isNameChanged || isUserNameChanged || isEmailChanged || isPicChanged) {
      setIsDisabled(false);
    } else {
      setIsDisabled(true);
    }
  }, [name, userName, email, pic, user]);

  useEffect(() => {
    if (isOpen) {
      const updatedUser = getStoredUser();
      if (updatedUser) {
        setName(updatedUser.name || "");
        setUserName(updatedUser.userName || "");
        setEmail(updatedUser.email || "");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("userInfo", JSON.stringify(user));
    }
  }, [user]);
  useEffect(() => {
    setMessage("");
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleUpdate();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserState((prev) => ({ ...prev, pic: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async () => {
    setMessage("");

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

    if (!userName.trim()) {
      setMessage("Kullanıcı adı boş bırakılamaz!");
      return;
    }
    if (!email.trim()) {
      setMessage("E-posta boş bırakılamaz!");
      return;
    }
    if (!emailRegex.test(email)) {
      setMessage("E-posta şu formatta olmalı: example@email.com!");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = user?.pic;

      if (pic) {
        const formData = new FormData();
        formData.append("file", pic);
        formData.append("upload_preset", "mern-chat");
        formData.append("cloud_name", "dtjdbkgef");

        const cloudinaryResponse = await axios.post(
          `https://api.cloudinary.com/v1_1/dtjdbkgef/image/upload`,
          formData
        );

        imageUrl = cloudinaryResponse.data.secure_url;
      }

      const updatedData = { name, userName, email, pic: imageUrl };
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.put(
        "/api/user/profile",
        updatedData,
        config
      );

      localStorage.setItem("userInfo", JSON.stringify(response.data));
      setUserState(response.data);
      setUser(response.data);

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        setToken(response.data.token);
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      if (error.response?.data?.message === "Username already exists!") {
        setMessage("Bu kullanıcı adı alınamaz!");
      } else if (error.response?.data?.message === "Email already exists!") {
        setMessage("Bu e-posta kullanılıyor!");
      } else if (
        error.response?.data?.message === "Geçersiz e-posta formatı!"
      ) {
        setMessage("E-posta şu formatta olmalı: example@email.com");
      } else {
        setMessage("Profil güncellenirken hata oluştu!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MenuItem onClick={onOpen}>Profili Güncelle</MenuItem>

      <Modal size="lg" onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="30px" textAlign="center">
            Profili Güncelle
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody display="flex" flexDir="column" alignItems="center">
            <Image
              borderRadius="full"
              boxSize="120px"
              src={user?.pic || "https://via.placeholder.com/120"}
              alt={user?.name || "Profil Fotoğrafı"}
              mb={4}
            />

            <FormControl>
              <FormLabel>Ad</FormLabel>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>Kullanıcı Adı</FormLabel>
              <Input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </FormControl>
            <FormControl mt={3}>
              <FormLabel>E-posta</FormLabel>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>Profil Fotoğrafı</FormLabel>
              <Input type="file" onChange={handleFileChange} />
            </FormControl>

            {message && (
              <Text color="red" mt={2}>
                {message}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} mr={3}>
              Kapat
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpdate}
              isLoading={loading}
              isDisabled={isDisabled}
              opacity={isDisabled ? 0.5 : 1}
            >
              Güncelle
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateProfileModal;
