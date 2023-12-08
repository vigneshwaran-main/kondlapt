import React, { useState, useEffect, Fragment } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator, StatusBar, ScrollView, Platform } from 'react-native';

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { SafeAreaView } from 'react-native';
import { Audio } from 'expo-av';
import { Icon } from 'react-native-elements'; // or any other icon library
import AppLoading from 'expo-app-loading';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
 
const ChatGPTApp = () => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordings, setRecordings] = useState([]);

  const saveMessagesToStorage = async (newMessages) => {
    try {
      const jsonValue = JSON.stringify(newMessages);
      await AsyncStorage.setItem('chatMessages', jsonValue);
    } catch (e) {
      console.error('Error saving messages to storage:', e);
    }
  };

  useEffect(() => {
    console.log('clearing chat');
    clearChat();
  },[])

  const startRecording = async () => {
    console.log('recording started');
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        const newRecording = new Audio.Recording();
        // await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recordingOptions = {
          ios: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          android: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          web: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          }
        };

        await newRecording.prepareToRecordAsync(recordingOptions);
        await newRecording.startAsync();
        setRecording(newRecording);
      } else {
        Alert.alert('Permissions were not granted');
      }
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  const stopRecording = async () => {
    console.log('recording ended');
    try {
      await recording.stopAndUnloadAsync();
      console.log(recording);
      const uri = recording.getURI();
      setRecordings([...recordings, uri]);
      setRecording(null);
      // Send the recording file to the backend here if needed
      sendAudioFile(uri);
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const saveRecording = async (uri) => {
    if (Platform.OS === 'web') {
      // Handle web-specific file saving
      // For example, download the file to the user's device
      downloadFile(uri, 'yourRecordingName.wav');
    } else {
      // Mobile implementation
      const newUri = FileSystem.documentDirectory + 'yourRecordingName.wav';
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });
      return newUri;
    }
  };
  
  const downloadFile = (uri, filename) => {
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const playAudio = async (uri) => {
    const playbackObject = new Audio.Sound();
    saveRecording(uri);

    try {
        await playbackObject.loadAsync({ uri: uri });
        await playbackObject.playAsync();
        // The audio is now playing!

        // Optional: Add listener to know when the playback has finished
        playbackObject.setOnPlaybackStatusUpdate((playbackStatus) => {
            if (playbackStatus.didJustFinish) {
                // The audio has finished playing
                // Perform any action after completion, if necessary
            }
        });
    } catch (error) {
        console.error('Error loading or playing audio', error);
    }
  };

  const convertBlobUrlToBlob = async (blobUrl) => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return blob;
  };

  const sendAudioFile = async (uri) => {
    try {
      setIsLoading(true);
      // playAudio(uri);
      // formData.append('file', {
      //   uri: uri,
      //   type: 'audio/x-wav', // MIME type for .wav files
      //   name: 'recording.wav',
      // });  

      const blob = await convertBlobUrlToBlob(uri);
      const formData = new FormData();

      formData.append('file', blob, 'recording.wav'); // 'recording.wav' is a placeholder name

      // Log the FormData contents (for debugging)
      for (let [key, value] of formData.entries()) {
          console.log(`${key}:`, value); // This should now show the blob object and not [object Object]
      }

      const response = await axios.post('http://127.0.0.1:8000/send-audio', formData, {
        headers: {
               'Content-Type': 'multipart/form-data',
            },
      });
      if (response.status == 200) {
        console.log(response.data.message);
      const newUserMessage = { text: response.data.question, sender: 'user' }
      setMessages(currentMessages => [...currentMessages, newUserMessage]);
      setInputText('');
      const thingToSay = '1';
      Speech.speak(response.data.message);
      typeChatGPTResponse(response.data.message);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error('Error uploading file:', error);
    }
  };

  const clearChat = async () => {
    try {
      setIsLoading(true);
      const response = await axios({
        method: 'post',
        url: 'http://18.117.180.168:8000/clear',
        data: {
          firstName: 'Fred',
          lastName: 'Flintstone'
        }
      });
      setIsLoading(false);
      if (response.status == 200) {
        setMessages([]);
        await AsyncStorage.clear();
        console.log("clear chat");

      } else {
        console.log("error");
      }
    } catch (err) {
      console.log(err);
      setIsLoading(false);
    }
  }  

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('chatMessages');
        if (jsonValue != null) {
          return JSON.parse(jsonValue);
        } else {
          return []; // If there's no stored data, return an empty array
        }
      } catch (e) {
        console.error('Error loading messages:', e);
        return []; // In case of an error, return an empty array to avoid crashing the app
      }
    };
  
    loadMessages().then(storedMessages => {
      setMessages(storedMessages);
    });
  }, []);

  const sendMessage = async () => {
    setIsLoading(true);
    if (inputText.trim() !== '') {
      const newUserMessage = { text: inputText, sender: 'user' };
      try {
        const response = await axios.post('http://18.117.180.168:8000/send-text', newUserMessage);
        setIsLoading(false);
        if (response.status == 200) {
          console.log(response.data.message);
          setMessages(currentMessages => [...currentMessages, newUserMessage]);
          setInputText('');
          typeChatGPTResponse(response.data.message);
        }
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        setIsLoading(false);
        // Handle error or show an error message to the user
      }
    }
  };

  const typeChatGPTResponse = (responseText) => {
    let typedText = '';
    const typeCharacterByCharacter = () => {
      if (typedText.length < responseText.length) {
        console.log("Typing Started");
        typedText += responseText.charAt(typedText.length);
        setMessages(currentMessages => {
          const newMessages = [...currentMessages];
          const lastMessageIndex = newMessages.length - 1;
  
          // Update the last message if it's from ChatGPT, otherwise, add a new message
          if (newMessages[lastMessageIndex] && newMessages[lastMessageIndex].sender === 'chatgpt') {
            newMessages[lastMessageIndex] = { ...newMessages[lastMessageIndex], text: typedText };
          } else {
            newMessages.push({ text: typedText, sender: 'chatgpt' });
          }
  
          return newMessages;
        });
  
        setTimeout(typeCharacterByCharacter, 50); // Set typing speed
      } else {
        // Save to local storage after the entire message is typed out
        console.log("Typing completed");
        setMessages(currentMessages => {
          saveMessagesToStorage(currentMessages);
          return currentMessages;
        });
      }
    };
  
    typeCharacterByCharacter();
  };
  

  const toggleSwitch = () => setIsDarkMode(previousState => !previousState);

  // const dynamicStyles = styles(isDarkMode);

  return (
<SafeAreaView style={{ flex: 1 }}>
  {isLoading ? (
    <ActivityIndicator style={[loaderStyles.container, loaderStyles.horizontal]} size="large" color="#3A8F97" />
  ) : (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Ionicons name="beer-outline" size={24} color="#fff" />
        <Text style={styles.headerTitle}>KONDLAPT</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={clearChat}>
          <MaterialIcons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <View
            key={index} // Replace with a unique key if available
            style={[
              styles.message,
              msg.sender === 'user' ? styles.question : styles.answer,
            ]}>
            <Text style={styles.messageText}>{msg.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          onChangeText={setInputText}
          value={inputText}
          placeholder="Type your message here..."
          placeholderTextColor={"#ccc"}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <MaterialIcons name="send" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={recording ? styles.sendButtonDisabled : styles.sendButton} onPress={recording ? stopRecording : startRecording}>
          <MaterialIcons name="mic" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )}
</SafeAreaView>

  );
};

const loaderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#2C2F33'
  },
  horizontal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C2F33',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#23272A',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 20,
    padding: 2,
  },
  refreshButton: {
    color: '#fff',
    marginLeft: 10,
    fontWeight: 'bold',
    border: '1px solid white',
    padding: 2,
    borderRadius: 50
  },
  messagesContainer: {
    marginTop: 5,
    flex: 1,
  },
  message: {
    padding: 8,
    borderRadius: 10,
    margin: 10,
    maxWidth: '80%'
  },
  question: {
    backgroundColor: '#3A8F97',
    alignSelf: 'flex-end',
  },
  answer: {
    backgroundColor: '#39454F',
    alignSelf: 'flex-start',
  },
  messageText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'flex-end',
    backgroundColor: '#2C2F33', // Match the background color of the container
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#40444B',
    color: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    justifyContent: 'space-between', // Add space between the elements
    backgroundColor: '#23272A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#D5A3B7',
    marginLeft: 5,
    borderRadius: 20
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#11A6B8',
    marginLeft: 5,
    borderRadius: 20
  },
});

export default ChatGPTApp;
