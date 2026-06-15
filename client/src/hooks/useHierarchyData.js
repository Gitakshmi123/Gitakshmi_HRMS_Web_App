import { useCallback, useEffect, useState } from 'react';
import hierarchyService from '../services/hierarchyService';

export default function useHierarchyData() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await hierarchyService.getHierarchyTree();
      setTree(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load hierarchy tree');
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return { tree, setTree, loading, error, refetch: fetchTree };
}
