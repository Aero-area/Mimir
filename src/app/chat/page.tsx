import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - Mimir',
  description: 'Chat with the internet, chat with Mimir.',
};

const ChatPage = () => {
  return <ChatWindow />;
};

export default ChatPage;
