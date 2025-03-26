// trycatch function to handle async errors and response

export const tryCatch = async <T, E = Error>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const error = err as E;
    return { data: null, error };
  }
};