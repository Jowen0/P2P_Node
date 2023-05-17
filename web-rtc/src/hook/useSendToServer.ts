import { useCallback } from "react";

const useSendToServer = () => {
    const sendToServer = useCallback((ws:WebSocket | undefined, data: Record<string, unknown> ) => {
        ws?.send(JSON.stringify(data));
    },[])

    return { sendToServer };
}
 
export default useSendToServer;