import { useContext } from 'react';
import { UIContext } from '../context/UIContext';

export default function useToast(){
  const { toast, setToast } = useContext(UIContext);
  const show = (message) => setToast(message);
  const hide = () => setToast(null);
  return { toast, show, hide };
}
