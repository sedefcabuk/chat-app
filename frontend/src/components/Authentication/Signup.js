import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input, InputGroup, InputRightElement } from "@chakra-ui/input";
import { VStack } from "@chakra-ui/layout";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useState } from "react";
import { useHistory } from "react-router";
import { ChatState } from "../../Context/ChatProvider";
import { Eye, EyeOff } from "lucide-react";
import { generateKeys } from "../../utils";

const Signup = () => {
  const [show, setShow] = useState(false);
  const handleClick = () => setShow(!show);
  const toast = useToast();
  const history = useHistory();
  const { setUser } = ChatState();
  const [name, setName] = useState();
  const [userName, setUserName] = useState();
  const [email, setEmail] = useState();
  const [confirmpassword, setConfirmpassword] = useState();
  const [password, setPassword] = useState();
  const [pic, setPic] = useState();
  const [picLoading, setPicLoading] = useState(false);

  const validateEmail = (email) => {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return regex.test(email);
  };

  const validatePassword = (password) => {
    return (
      password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password)
    );
  };

  const submitHandler = async () => {
    setPicLoading(true);
    if (!name || !userName || !email || !password || !confirmpassword) {
      toast({
        title: "Lütfen bütün alanları doldurun!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "E-posta şu formatta olmalı: example@email.com",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      toast({
        title:
          "Şifreniz en az 8 karakter olmalı ve en az bir harf ve rakam içermelidir.",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }
    if (password !== confirmpassword) {
      setPicLoading(true);
      toast({
        title: "Şifreler eşleşmiyor!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }

    const { publicKey } = await generateKeys();
    console.log(name, userName, email, password, pic);
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      const { data } = await axios.post(
        "/api/user",
        {
          name,
          userName,
          email,
          password,
          pic,
          publicKey,
        },
        config
      );
      console.log(data);
      toast({
        title: "Kayıt başarılı",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      localStorage.setItem("token", data.token);
      localStorage.removeItem("userInfo");
      localStorage.setItem("userInfo", JSON.stringify(data));

      setUser(data);
      setPicLoading(false);
      history.push("/chats");
    } catch (error) {
      toast({
        title: "Error Occured!",
        description: error.response.data.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
    }
  };

  const postDetails = (pics) => {
    setPicLoading(true);
    if (pics === undefined) {
      toast({
        title: "Görsel jpeg veya png fromatında olmalı!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }
    console.log(pics);
    if (pics.type === "image/jpeg" || pics.type === "image/png") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "mern-chat");
      data.append("cloud_name", "dtjdbkgef");
      fetch("https://api.cloudinary.com/v1_1/dtjdbkgef/image/upload", {
        method: "post",
        body: data,
      })
        .then((res) => res.json())
        .then((data) => {
          setPic(data.url.toString());
          console.log(data.url.toString());
          setPicLoading(false);
        })
        .catch((err) => {
          console.log(err);
          setPicLoading(false);
        });
    } else {
      toast({
        title: "Görsel jpeg veya png formatında olmalı!",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setPicLoading(false);
      return;
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      submitHandler();
    }
  };

  return (
    <VStack spacing="5px">
      <FormControl id="first-name" isRequired>
        <FormLabel>Ad</FormLabel>
        <Input
          placeholder=""
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </FormControl>
      <FormControl id="userName" isRequired>
        <FormLabel>Kullanıcı Adı</FormLabel>
        <Input
          placeholder=""
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </FormControl>
      <FormControl id="email" isRequired>
        <FormLabel>E-posta</FormLabel>
        <Input
          type="email"
          placeholder=""
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </FormControl>
      <FormControl id="password" isRequired>
        <FormLabel>Şifre</FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder=""
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <InputRightElement width="4.5rem">
            <Button h="1.75rem" size="sm" onClick={handleClick}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </InputRightElement>
        </InputGroup>
      </FormControl>
      <FormControl id="password" isRequired>
        <FormLabel>Şifre Tekrar</FormLabel>
        <InputGroup size="md">
          <Input
            type={show ? "text" : "password"}
            placeholder=""
            onChange={(e) => setConfirmpassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <InputRightElement width="4.5rem">
            <Button h="1.75rem" size="sm" onClick={handleClick}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </InputRightElement>
        </InputGroup>
      </FormControl>
      <FormControl id="pic">
        <FormLabel>Profil Fotoğrafı</FormLabel>
        <Input
          type="file"
          p={1.5}
          accept="image/*"
          onChange={(e) => postDetails(e.target.files[0])}
        />
      </FormControl>
      <Button
        colorScheme="blue"
        width="100%"
        style={{ marginTop: 15 }}
        onClick={submitHandler}
        isLoading={picLoading}
      >
        Kaydol
      </Button>
    </VStack>
  );
};

export default Signup;
