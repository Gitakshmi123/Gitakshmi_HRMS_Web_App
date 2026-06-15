export default function useApi(){
  const request = async (endpoint, options = {}) => {
    const res = await fetch(endpoint, options);
    return res.json();
  };
  return { request };
}
