import { useCallback } from "react";

type Data = {
    type: string,
    data: unknown,
    callBackFn: (() => void) | (() => Promise<void>)
};
const useRecieveFromServer = () => {
    const reviceFromServer = useCallback((recieveData:Data) => {
        const  { type, data } = recieveData;

        switch (type) {
            case 'all_users':
                
                break;
        
            default:
                break;
        }
    },[])

    return { reviceFromServer };
}
 
export default useRecieveFromServer;