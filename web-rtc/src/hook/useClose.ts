import { useCallback } from "react";

// Const
import { CLOSE_REASON } from "../const";

// Type
import { CloseCode } from "../type";


const useClose = () => {
    const getWsCloseReason = useCallback((code: CloseCode) => {
        return CLOSE_REASON[code];
    }, []);

    const closeWebocket = useCallback((code: CloseCode, ws: WebSocket | undefined) => {
        const wsCloseReason = getWsCloseReason(code);

        ws?.close(code, wsCloseReason);
    }, [getWsCloseReason]);

    const closeRTC = useCallback((pc: RTCPeerConnection | undefined) => {
        pc?.close();
    }, []);

    const closeAll = useCallback((code: CloseCode, ws: WebSocket | undefined, pc: RTCPeerConnection | undefined) => {
        closeWebocket(code, ws);

        closeRTC(pc);

    }, [closeWebocket, closeRTC, closeRTC]);

    return { closeWebocket, closeRTC, closeAll };
}
 
export default useClose;