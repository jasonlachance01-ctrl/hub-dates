export const isDebugEnabled = (key: string): boolean => {
  try {
    const value = localStorage.getItem(key);
    return value === "true" || value === "1";
  } catch {
    return false;
  }
};

export const debugGroup = (label: string, fn: () => void) => {
  try {
    console.groupCollapsed(label);
    fn();
  } finally {
    console.groupEnd();
  }
};
