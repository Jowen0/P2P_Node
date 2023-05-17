import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

// Hook
import useSendToServer from "./hook/useSendToServer";

// Type
import { Data } from "./type";

const VideoCall = () => {
  // 소켓정보를 담을 Ref
  const socketRef = useRef<WebSocket>();
  const { sendToServer } = useSendToServer()

  // 자신의 비디오
  const myVideoRef = useRef<HTMLVideoElement>(null);

  // 다른사람의 비디오
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // peerConnection
  const pcRef = useRef<RTCPeerConnection>();

  // 저는 특정 화면에서 방으로 진입시에 해당 방의 방번호를 url parameter로 전달해주었습니다.
  const { roomName = 'roomName' } = useParams();

  const getMedia = useCallback(async (ws: WebSocket | undefined, pc: RTCPeerConnection | undefined) => {
    try {
      // 자신이 원하는 자신의 스트림정보
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      if (!(ws && pc)) return;

      // 스트림을 peerConnection에 등록
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // iceCandidate 이벤트
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const data = { type: 'candidate', roomName, data: e.candidate };
          console.log("recv candidate", data);

          sendToServer(ws, data);
        }
      };

      // 구 addStream 현 track 이벤트 
      pc.ontrack = (e) => {
        console.log('track')
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };
    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  const createOffer = useCallback(async (ws: WebSocket | undefined) => {
    console.log("create Offer");
    if (!(pcRef.current && socketRef.current)) {
      return;
    }

    try {
      // offer 생성
      const sdp = await pcRef.current.createOffer();

      // 자신의 sdp로 LocalDescription 설정
      await pcRef.current.setLocalDescription(sdp);

      // offer 전달
      // const data = { roomName, ...sdp }; // 안되면 아래 주석으로 실행
      const data = { type: sdp.type, roomName, data: sdp.sdp };
      console.log("sent the offer", data);

      sendToServer(ws, data)

    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  const createAnswer = useCallback(async (ws: WebSocket | undefined, sdp: RTCSessionDescription) => {
    // sdp : PeerA에게서 전달받은 offer

    console.log("createAnswer");
    if (!(pcRef.current && socketRef.current)) {
      return;
    }

    try {
      // PeerA가 전달해준 offer를 RemoteDescription에 등록해 줍시다.
      await pcRef.current.setRemoteDescription(sdp);

      // answer생성해주고
      const answerSdp = await pcRef.current.createAnswer();

      // answer를 LocalDescription에 등록해 줍니다. (PeerB 기준)
      await pcRef.current.setLocalDescription(answerSdp);

      // const data = { roomName, ...answerSdp }; // 안되면 아래 주석으로 실행
      const data = { type: answerSdp.type, roomName, data: answerSdp.sdp };
      console.log("sent the answer", data);

      sendToServer(ws, data)

    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  useEffect(() => {
    console.log('start')
    // 소켓 연결
    // socketRef.current = io("localhost:8080");
    // socketRef.current = new WebSocket('ws://localhost/socket');
    socketRef.current = new WebSocket('ws://bitchat-server.lookthis.co.kr/socket');
    const ws = socketRef.current;

    // peerConnection 생성
    // iceServers는 stun sever설정이며 google의 public stun server를 사용하였습니다.
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });
    const pc = pcRef.current;

    ws.onmessage = async (event) => {
      const { type, data }: Data = event.data;
      const parsingData = JSON.parse(data);

      switch (type) {
        // 기존 유저가 있고, 새로운 유저가 들어왔다면 오퍼생성
        case 'all_users':
          console.log("all_users");
          if ('allUsers' in parsingData && parsingData.allUsers.length > 0) createOffer(ws);

          break;
        case 'getOffer':
          console.log("recv Offer");
          if ('sdp' in parsingData) createAnswer(ws, parsingData.sdp as RTCSessionDescription);

          break;
        case 'getAnswer':
          console.log("recv Answer");
          if ('sdp' in parsingData) await pc.setRemoteDescription(parsingData.sdp as RTCSessionDescription);

          break;
        case 'getCandidate':
          console.log("recv Offer");
          if ('candidate' in parsingData) await pc.addIceCandidate(parsingData.candidate as RTCIceCandidate);

          break;
        default:
          break;
      }
    };

    // const test = async (socketRef: any) => {

    //   await getMedia(ws, pc);

    //   console.log("join_room")
    //   let join_room  = {
    //     type : "join_room",
    //     roomName : "roomName"
    //   }
    //   // 마운트시 해당 방의 roomName을 서버에 전달
    //   socketRef.current.send(JSON.stringify(join_room));
    // }

    // test(socketRef);

    getMedia(ws, pc)
    .then(() => {
      console.log("join_room");
      const data = {
        type: "join_room",
        roomName
      };

      // 마운트시 해당 방의 roomName을 서버에 전달
      sendToServer(ws, data);
    })
    // .catch((error) => {
    //   console.log(error)
    // });

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [sendToServer]);

  return (
    <div>
      <video
        id="myvideo"
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={myVideoRef}
        autoPlay
      />
      <br />
      <video
        id="remotevideo"
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={remoteVideoRef}
        autoPlay
      />
    </div>
  );
};

export default VideoCall;
