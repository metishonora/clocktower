export function memoizeLatestJsonRequest<Input, Output>(
  request: (serializedInput: string) => Promise<Output>,
): (input: Input) => Promise<Output> {
  let latestSerializedInput: string | undefined;
  let latestRequest: Promise<Output> | undefined;

  return (input) => {
    const serializedInput = JSON.stringify(input);
    if (serializedInput === latestSerializedInput && latestRequest) return latestRequest;

    const pending = request(serializedInput);
    latestSerializedInput = serializedInput;
    latestRequest = pending;
    void pending.catch(() => {
      if (latestRequest !== pending) return;
      latestSerializedInput = undefined;
      latestRequest = undefined;
    });
    return pending;
  };
}
