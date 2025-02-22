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
  const [pic, setPic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isDisabled, setIsDisabled] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  useEffect(() => {
    const isNameChanged = name.trim() !== user?.name?.trim();
    const isUserNameChanged = userName.trim() !== user?.userName?.trim();
    const isPicChanged = pic !== null;

    if (isNameChanged || isUserNameChanged || isPicChanged) {
      setIsDisabled(false); // Gerçek bir değişiklik varsa butonu aktif yap
    } else {
      setIsDisabled(true); // Değişiklik yoksa butonu pasif yap
    }
  }, [name, userName, pic, user]);

  useEffect(() => {
    if (isOpen) {
      const updatedUser = getStoredUser();
      if (updatedUser) {
        setName(updatedUser.name || "");
        setUserName(updatedUser.userName || "");
      }
    }
  }, [isOpen]); // ✅ Sonsuz döngüyü önledik

  useEffect(() => {
    if (user) {
      localStorage.setItem("userInfo", JSON.stringify(user));
    }
  }, [user]);

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
    setMessage(""); // Önceki mesajları temizle

    // Kullanıcı adı boşsa uyarı ver
    if (!userName.trim()) {
      setMessage("Kullanıcı adı boş olamaz!");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = user?.pic;

      // Eğer yeni bir resim seçildiyse, Cloudinary'ye yükle
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

      // **Eksik tanımlanan değişkenler eklendi!**
      const updatedData = { name, userName, pic: imageUrl };
      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.put(
        "http://localhost:5000/api/user/profile",
        updatedData,
        config
      );

      console.log("API'den Dönen Yanıt:", response.data);
      console.log("Yeni Token:", response.data.token);

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
      console.error("Hata:", error);
      setMessage(
        error.response?.data?.message || "Profil güncellenirken hata oluştu!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MenuItem onClick={onOpen}>Profile</MenuItem>

      <Modal size="lg" onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="30px" textAlign="center">
            Update Profile
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
              <FormLabel>Name</FormLabel>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>Username</FormLabel>
              <Input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </FormControl>

            <FormControl mt={3}>
              <FormLabel>Profile Photo</FormLabel>
              <Input type="file" onChange={handleFileChange} />
            </FormControl>

            {message && (
              <Text color="green.500" mt={2}>
                {message}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} mr={3}>
              Close
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpdate}
              isLoading={loading}
              isDisabled={isDisabled} // Butonu aktif/pasif yap
              opacity={isDisabled ? 0.5 : 1} // Soluk görünmesini sağla
            >
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateProfileModal;
