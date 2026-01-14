
export const generateId = () => {
  const parts = [
    Math.random().toString(36).substring(2, 7),
    Math.random().toString(36).substring(2, 7),
    Date.now().toString(36).slice(-4)
  ];
  return parts.join('-');
};

export const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
