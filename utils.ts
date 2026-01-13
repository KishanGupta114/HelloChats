
export const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
