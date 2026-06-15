import { useRBAC } from '../context/RBACContext';

export default function useHasPermission(module, action = 'view') {
  const { hasPermission } = useRBAC();
  return hasPermission(module, action);
}
